import { decodeToMono16k, sliceToWav } from "./audio/decode.js";
import { planChunks } from "./audio/chunker.js";
import { toolsApi, withRetry, ApiError } from "../services/toolsApi.js";

// Browser side of the SRT tool:
//   file → decode (mono 16 kHz) → silence-aware chunks (≤ 60 s, ≈ 2 MB each) →
//   POST /api/srt/chunk (sequential, retried) → merge → POST /api/srt/cues
// Chunking keeps every request under Vercel's 4.5 MB body limit.

const CONCURRENCY = 5;

export async function transcribeFile(file, { settings, onProgress = () => {}, onCharged = () => {}, signal } = {}) {
  onProgress({ stage: "decode", percent: 2 });
  const { samples, rate, duration } = await decodeToMono16k(file);
  if (signal?.aborted) throw new ApiError("Cancelled", { code: "ABORTED" });

  const plan = planChunks(samples, rate);
  if (!plan.length) throw new ApiError("The audio is empty.", { code: "EMPTY_AUDIO" });

  // Tokens are charged when the job starts (after the file decoded fine): ceil(MB × 5).
  const started = (await toolsApi.srtStart(file.size)).data;
  onCharged({ cost: started.cost, tokens: started.tokens });
  const job = started.job;
  let done = false;
  try {
  const words = [];
  const segments = [];
  const warnings = [];
  let mode = "word";
  let model = null;
  let silentChunks = 0;
  let inSilence = 0;

  // Chunks run in parallel (5 at a time) — a 5-minute file takes ~1 chunk of time instead of 3.
  const results = new Array(plan.length);
  const frac = new Array(plan.length).fill(0); // 0..1 per chunk → live percent
  const report = () => onProgress({ stage: "transcribe", chunks: plan.length, percent: 5 + Math.round((frac.reduce((a, b) => a + b, 0) / plan.length) * 85) });
  report();
  let next = 0;
  const worker = async () => {
    while (next < plan.length) {
      if (signal?.aborted) throw new ApiError("Cancelled", { code: "ABORTED" });
      const i = next++;
      const { start, end } = plan[i];
      const wav = sliceToWav(samples, start, end, rate);
      const offset = Number((start / rate).toFixed(3));
      frac[i] = 0.1; report(); // sent
      const res = await withRetry(() => toolsApi.srtChunk(wav, offset, mode, signal, job), { signal });
      if (res.data.mode === "segment") mode = "segment";
      results[i] = res.data;
      frac[i] = 1; report();
    }
  };
  const first = worker();
  await Promise.all([first, ...Array.from({ length: Math.min(CONCURRENCY, plan.length) - 1 }, worker)]);
  results.forEach((d, i) => {
    if (d.silent) silentChunks++;
    model = d.model || model;
    inSilence += d.quality?.inSilence || 0;
    words.push(...d.words);
    segments.push(...d.segments);
    for (const w of d.warnings || []) warnings.push(`[${i + 1}/${plan.length}] ${w}`);
  });

  onProgress({ stage: "cues", percent: 94 });
  const useWords = words.length > 0;
  const cuesRes = await toolsApi.srtCues({ words: useWords ? words : undefined, segments: useWords ? undefined : segments, duration, settings }, signal);
  const out = cuesRes.data;
  if (inSilence > 0) warnings.push(`${inSilence} word(s) were timed inside silent parts of the audio — please review those subtitles.`);
  onProgress({ stage: "done", percent: 100 });

  done = true;
  return {
    cost: started.cost,
    cues: out.cues,
    timeline: out.timeline,
    timing: out.timing,
    duration,
    model,
    chunks: plan.length,
    silentChunks,
    warnings: [...warnings, ...(out.warnings || [])],
    settings: out.settings,
  };
  } finally {
    // Failed (not cancelled by the user) → give the tokens back, once.
    if (!done && !signal?.aborted) toolsApi.srtRefund(job).then(() => onCharged({ refunded: true })).catch(() => {});
  }
}
