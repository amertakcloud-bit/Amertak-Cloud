// Transcribes ONE audio chunk sent by the browser (≤ ~100 s of 16 kHz mono PCM WAV).
// Chunking is what keeps every request under Vercel's 4.5 MB body limit and Gemini's
// 30-minute timestamp limit, and lets long audio be processed with short function calls.
import { AppError } from "../../lib/AppError.js";
import { deps, getModels, mapGeminiError } from "../../lib/geminiClient.js";
import { transcribeSegments, transcribeWords } from "../../lib/gemini/transcribe.js";
import { analyzeWav, FRAME_SEC } from "./wav.js";
import { cleanWords } from "./subtitles.js";

export const MAX_CHUNK_SECONDS = Number(process.env.SRT_MAX_CHUNK_SECONDS || 130);

function isModelUnavailable(err) {
  return err instanceof AppError && ["MODEL_NOT_FOUND", "KEY_FORBIDDEN"].includes(err.code);
}

// preferredMode: "word" (default) | "segment" (after a previous chunk had to fall back)
export async function transcribeChunk({ apiKey, wav, offset = 0, preferredMode = "word" }) {
  const analysis = analyzeWav(wav);
  if (analysis.duration > MAX_CHUNK_SECONDS) {
    throw new AppError(413, "CHUNK_TOO_LONG", `Chunks must be at most ${MAX_CHUNK_SECONDS} seconds long.`);
  }
  const base = { duration: analysis.duration, offset, warnings: [], model: null };

  // No speech → skip Gemini completely (saves quota and avoids hallucinated text).
  if (analysis.silent) {
    return { ...base, mode: preferredMode, silent: true, words: [], segments: [], quality: { words: 0, inSilence: 0, zeroDuration: 0 } };
  }

  const client = await deps.createClient(apiKey);
  const models = getModels();
  let mode = preferredMode;
  let words = [];
  let segments = [];

  if (mode === "word") {
    try {
      const res = await transcribeWords(client, wav);
      words = res.words;
      base.model = models.transcribe;
      if (!words.length) {
        base.warnings.push("The model returned no word timestamps for this chunk — switching to segment timestamps.");
        mode = "segment";
      }
    } catch (err) {
      if (!isModelUnavailable(err)) throw err;
      base.warnings.push(`Model "${models.transcribe}" is not available for this key — using "${models.general}" (segment-level timing only).`);
      mode = "segment";
    }
  }

  if (mode === "segment") {
    try {
      segments = await transcribeSegments(client, wav);
      base.model = models.general;
    } catch (err) {
      throw mapGeminiError(err);
    }
  }

  // Quality checks against the REAL audio energy of this chunk.
  const clean = cleanWords(words, analysis.duration);
  words = clean.words;
  let inSilence = 0;
  let zeroDuration = 0;
  for (const w of words) {
    if (w.end - w.start <= 0.001) zeroDuration++;
    const mid = Math.floor((w.start + w.end) / 2 / FRAME_SEC);
    if (mid < analysis.speech.length && !analysis.speech[mid]) inSilence++;
  }
  if (clean.dropped) base.warnings.push(`${clean.dropped} word(s) without a valid timestamp were dropped.`);

  const shift = (v) => Number((v + offset).toFixed(3));
  return {
    ...base,
    mode,
    silent: false,
    words: words.map((w) => ({ text: w.text, start: shift(w.start), end: shift(w.end) })),
    segments: segments
      .map((s) => ({ text: s.text, start: shift(Math.max(0, s.start)), end: shift(Math.min(analysis.duration, s.end)) }))
      .filter((s) => s.end > s.start),
    quality: { words: words.length, inSilence, zeroDuration },
  };
}
