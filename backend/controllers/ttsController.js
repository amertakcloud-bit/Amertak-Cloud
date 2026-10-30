import { AppError } from "../lib/AppError.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import { KHMER_VOICES, diagnose, synthesizeSpeech } from "../lib/edgeTts.js";
import { DEFAULT_VOICES, GEMINI_VOICES, STYLES, synthesizeGemini } from "../lib/geminiTts.js";
import { jobHasBudget, jobSpend } from "../lib/billing.js";

export const MAX_TEXT_LENGTH = 3000;

const provider = () => (process.env.TTS_PROVIDER || "gemini").toLowerCase(); // "gemini" (default) | "edge" (legacy)

export function getTtsStatus(_req, res) {
  const gem = provider() === "gemini";
  res.json({
    success: true,
    online: true,
    service: gem ? "Khmer AI Voice (Gemini TTS)" : "Khmer TTS API",
    provider: provider(),
    voices: gem ? GEMINI_VOICES : KHMER_VOICES,
    styles: gem ? Object.keys(STYLES) : [],
    needsOwnKey: false,
    maxCharacters: MAX_TEXT_LENGTH,
    ranges: gem ? {} : { rate: [-50, 100], pitch: [-50, 50], volume: [-50, 50] },
  });
}

export const synthesizeText = asyncHandler(async (req, res) => {
  const { text = "", voice = provider() === "gemini" ? DEFAULT_VOICES.m : "piseth", style = "natural", rate = 0, pitch = 0, volume = 0 } = req.body || {};
  const safe = String(text).replace(/\s+/g, " ").trim();
  if (!safe) throw new AppError(400, "EMPTY_TEXT", "Please enter some text to convert to speech.");
  if (safe.length > MAX_TEXT_LENGTH) {
    throw new AppError(400, "TEXT_TOO_LONG", `Text is too long. Please keep it under ${MAX_TEXT_LENGTH} characters.`);
  }
  let out;
  if (provider() === "gemini") {
    if (req.voiceJob) await jobHasBudget(req.voiceJob, req.user._id, "voice", safe.length);
    out = await synthesizeGemini({ apiKey: req.gemini.key, text: safe, voice, style });
    if (req.voiceJob) await jobSpend(req.voiceJob, req.user._id, "voice", safe.length);
  } else {
    out = await synthesizeSpeech(safe, { voice, rate, pitch, volume });
  }
  res.set({
    "Content-Type": out.contentType,
    "Content-Disposition": `inline; filename="khmer-voice.${out.contentType === "audio/wav" ? "wav" : "mp3"}"`,
    "Cache-Control": "no-store",
    "X-Voice": out.voice,
    "X-TTS-Provider": out.provider || "edge",
  });
  res.send(out.audio);
});

export const ttsDiagnose = asyncHandler(async (_req, res) => {
  const results = await diagnose();
  res.json({ success: true, working: results.some((r) => r.ok && r.provider !== "google"), googleOnly: !results.some((r) => r.ok && r.provider !== "google") && results.some((r) => r.ok), results });
});
