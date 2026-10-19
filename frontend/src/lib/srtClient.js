import { decodeToMono16k, sliceToWav } from "./audio/decode.js";
import { planChunks } from "./audio/chunker.js";
import { toolsApi, withRetry, ApiError } from "../services/toolsApi.js";

// Browser side of the SRT tool:
//   file → decode (mono 16 kHz) → silence-aware chunks (≤ 100 s, ≈ 3 MB each) →
//   POST /api/srt/chunk (sequential, retried) → merge → POST /api/srt/cues
// Chunking keeps every request under Vercel's 4.5 MB body limit.

export async function transcribeFile(file, { settings, onProgress = () => {}, signal } = {}) {
  onProgress({ stage: "decode", percent: 2 });
  const { samples, rate, duration } = await decodeToMono16k(file);
  if (signal?.aborted) throw new ApiError("Cancelled", { code: "ABORTED" });

  const plan = planChunks(samples, rate);
  if (!plan.length) throw new ApiError("The audio is empty.", { code: "EMPTY_AUDIO" });

  const words = [];
  const segments = [];
  const warnings = [];
  let mode = "word";
  let model = null;
  let silentChunks = 0;
  let inSilence = 0;

  for (let i = 0; i < plan.length; i++) {
    if (signal?.aborted) throw new ApiError("Cancelled", { code: "ABORTED" });
    const { start, end } = plan[i];
    onProgress({ stage: "transcribe", chunk: i + 1, chunks: plan.length, percent: 5 + Math.round((i / plan.length) * 85) });

    const wav = sliceToWav(samples, start, end, rate);
    const offset = Number((start / rate).toFixed(3));
    const res = await withRetry(() => toolsApi.srtChunk(wav, offset, mode, signal), { signal });
    const d = res.data;
    if (d.mode === "segment" && mode === "word") mode = "segment";
    if (d.silent) silentChunks++;
    model = d.model || model;
    inSilence += d.quality?.inSilence || 0;
    words.push(...d.words);
    segments.push(...d.segments);
    for (const w of d.warnings || []) warnings.push(`[${i + 1}/${plan.length}] ${w}`);
  }

  onProgress({ stage: "cues", percent: 94 });
  const useWords = words.length > 0;
  const cuesRes = await toolsApi.srtCues({ words: useWords ? words : undefined, segments: useWords ? undefined : segments, duration, settings }, signal);
  const out = cuesRes.data;
  if (inSilence > 0) warnings.push(`${inSilence} word(s) were timed inside silent parts of the audio — please review those subtitles.`);
  onProgress({ stage: "done", percent: 100 });

  return {
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
}
