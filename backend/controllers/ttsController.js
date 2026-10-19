import { AppError } from "../lib/AppError.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import { KHMER_VOICES, synthesizeSpeech } from "../lib/edgeTts.js";

export const MAX_TEXT_LENGTH = 3000;

export function getTtsStatus(_req, res) {
  res.json({
    success: true,
    online: true,
    service: "Khmer TTS API",
    voices: KHMER_VOICES,
    maxCharacters: MAX_TEXT_LENGTH,
    ranges: { rate: [-50, 100], pitch: [-50, 50], volume: [-50, 50] },
  });
}

export const synthesizeText = asyncHandler(async (req, res) => {
  const { text = "", voice = "piseth", rate = 0, pitch = 0, volume = 0 } = req.body || {};
  const safe = String(text).replace(/\s+/g, " ").trim();
  if (!safe) throw new AppError(400, "EMPTY_TEXT", "Please enter some text to convert to speech.");
  if (safe.length > MAX_TEXT_LENGTH) {
    throw new AppError(400, "TEXT_TOO_LONG", `Text is too long. Please keep it under ${MAX_TEXT_LENGTH} characters.`);
  }
  const out = await synthesizeSpeech(safe, { voice, rate, pitch, volume });
  res.set({
    "Content-Type": out.contentType,
    "Content-Disposition": 'inline; filename="khmer-voice.mp3"',
    "Cache-Control": "no-store",
    "X-Voice": out.voice,
  });
  res.send(out.audio);
});
