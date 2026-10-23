import { AppError } from "../lib/AppError.js";
import {
  getModels,
  isValidKeyFormat,
  serverKeyConfigured,
  validateGeminiKey,
  mapGeminiError,
} from "../lib/geminiClient.js";
import { RATES, refundJob, startJob, tokensForBytes, verifyJob } from "../lib/billing.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import { MAX_CHUNK_SECONDS, transcribeChunk } from "../services/srt/chunk.js";
import { alignTextToWords, buildCues, cleanWords, cuesFromSegments, DEFAULTS, sanitizeSettings } from "../services/srt/subtitles.js";
import { buildSrt, validateCues } from "../services/srt/srtFormat.js";

// GET /api/srt/status — public: what the browser needs to configure itself.
export const getStatus = (req, res) => {
  const models = getModels();
  res.json({
    success: true,
    data: {
      transcribeModel: models.transcribe,
      fallbackModel: models.general,
      serverKeyAvailable: serverKeyConfigured(),
      serverKeyNeedsLogin: true,
      loggedIn: Boolean(req.user),
      chunk: { targetSeconds: 90, maxSeconds: MAX_CHUNK_SECONDS, sampleRate: 16000 },
      defaults: DEFAULTS,
      rates: { captionPerMB: RATES.captionPerMB },
    },
  });
};

// POST /api/srt/validate-key — header x-gemini-api-key (the user's own key)
export const validateKey = asyncHandler(async (req, res) => {
  const key = String(req.get("x-gemini-api-key") || "").trim();
  if (!key) throw new AppError(400, "NO_API_KEY", "Send your Gemini API key in the x-gemini-api-key header.");
  if (!isValidKeyFormat(key)) {
    throw new AppError(400, "INVALID_API_KEY_FORMAT", "The Gemini API key looks invalid (too short, or contains spaces).");
  }
  try {
    const result = await validateGeminiKey(key);
    res.json({ success: true, data: result });
  } catch (err) {
    throw mapGeminiError(err);
  }
});

// POST /api/srt/start  { sizeBytes } (login required) — charges ceil(MB × 5) whole tokens and
// returns a job token that the chunk requests must carry in the x-job header.
export const startJobHandler = asyncHandler(async (req, res) => {
  const sizeBytes = Number(req.body?.sizeBytes);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > 4 * 1024 * 1024 * 1024) {
    throw new AppError(400, "INVALID_SIZE", '"sizeBytes" must be the size of the file in bytes.');
  }
  const cost = tokensForBytes(sizeBytes, RATES.captionPerMB);
  const job = await startJob(req.user._id, "caption", cost);
  res.json({ success: true, data: { job: job.token, cost: job.cost, tokens: job.balance } });
});

// POST /api/srt/refund  { job } — gives the tokens back (once) when the whole job failed.
export const refundJobHandler = asyncHandler(async (req, res) => {
  const refunded = await refundJob(req.body?.job, req.user._id, "caption");
  res.json({ success: true, data: { refunded } });
});

// Chunk requests must belong to a paid job of this user.
export async function requireJob(req, _res, next) {
  try {
    await verifyJob(req.get("x-job"), req.user?._id, "caption");
    next();
  } catch (err) {
    next(err);
  }
}

// POST /api/srt/chunk — multipart: audio (16-bit mono WAV), offset, [mode]
export const transcribeChunkHandler = asyncHandler(async (req, res) => {
  if (!req.file?.buffer?.length) {
    throw new AppError(400, "NO_FILE", 'Attach the audio chunk in the "audio" field.');
  }
  const offset = Number(req.body?.offset ?? 0);
  if (!Number.isFinite(offset) || offset < 0 || offset > 24 * 3600) {
    throw new AppError(400, "INVALID_OFFSET", '"offset" must be a number of seconds ≥ 0.');
  }
  const preferredMode = req.body?.mode === "segment" ? "segment" : "word";

  const result = await transcribeChunk({
    apiKey: req.gemini.key,
    wav: req.file.buffer,
    offset,
    preferredMode,
  });
  res.json({ success: true, data: { ...result, keySource: req.gemini.source } });
});

function readWords(list, name) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw new AppError(400, "INVALID_BODY", `"${name}" must be an array.`);
  if (list.length > 60000) throw new AppError(400, "INVALID_BODY", `"${name}" is too large.`);
  return list;
}

// POST /api/srt/cues — { words?, segments?, duration?, settings? } → sentence-level cues
export const buildCuesHandler = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const settings = sanitizeSettings(body.settings || {});
  const duration = Number(body.duration) > 0 ? Number(body.duration) : Number.MAX_SAFE_INTEGER;
  const words = readWords(body.words, "words");
  const segments = readWords(body.segments, "segments");
  const warnings = [];

  let cues;
  let timing;
  let timeline = [];
  if (words.length) {
    const cleaned = cleanWords(words, duration);
    timeline = cleaned.words;
    if (cleaned.dropped) warnings.push(`${cleaned.dropped} word(s) without a valid timestamp were dropped.`);
    cues = buildCues(timeline, settings);
    timing = "word-level";
  } else if (segments.length) {
    const cleaned = cleanWords(segments, duration);
    timeline = cleaned.words;
    cues = cuesFromSegments(timeline, settings);
    timing = "segment-level";
    warnings.push("Word-level timestamps were not available — timing is segment-level (less precise). Please check the subtitles against the audio.");
  } else {
    throw new AppError(422, "EMPTY_TRANSCRIPT", "No transcript was produced — the audio may contain no speech.");
  }
  if (!cues.length) throw new AppError(422, "EMPTY_TRANSCRIPT", "No subtitles could be built from the transcript.");

  res.json({ success: true, data: { cues, timeline, timing, warnings, settings } });
});

// POST /api/srt/align — { cues:[{text,start?,end?}], words:[{text,start,end}] }
export const alignHandler = asyncHandler(async (req, res) => {
  const { cues, words } = req.body || {};
  if (!Array.isArray(cues) || !cues.length) throw new AppError(400, "INVALID_CUES", '"cues" must be a non-empty array.');
  if (cues.length > 20000) throw new AppError(400, "INVALID_CUES", "Too many subtitles.");
  const timeline = cleanWords(readWords(words, "words")).words;
  if (!timeline.length) {
    throw new AppError(422, "NO_TIMELINE", 'Send the "timeline" returned by /api/srt/cues (word timestamps) to align against.');
  }
  const lines = cues.map((c) => ({ text: String(c?.text ?? ""), start: c?.start, end: c?.end }));
  const result = alignTextToWords(lines, timeline);
  res.json({ success: true, data: { cues: result.cues, warnings: result.warnings } });
});

// POST /api/srt/export — { cues:[{start,end,text}], bom?, filename? } → .srt (UTF-8)
export const exportSrt = asyncHandler(async (req, res) => {
  const cues = validateCues(req.body?.cues);
  let body = buildSrt(cues);
  if (req.body?.bom) body = "﻿" + body;
  const base = String(req.body?.filename || "subtitles")
    .replace(/\.srt$/i, "")
    .replace(/[^\w\-ក-៿ ]+/g, "_")
    .slice(0, 80) || "subtitles";
  res.set({
    "Content-Type": "application/x-subrip; charset=utf-8",
    "Content-Disposition": `attachment; filename="subtitles.srt"; filename*=UTF-8''${encodeURIComponent(base)}.srt`,
    "Cache-Control": "no-store",
  });
  res.send(body);
});
