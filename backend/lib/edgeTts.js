import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppError } from "./AppError.js";

// Real Microsoft Edge neural voices via the pure-JS `node-edge-tts` package
// (no Python / no binaries → works on Vercel). Audio is MP3.
// If the voice service cannot be reached we FAIL with a clear error — we never return
// fake "beep" audio.

export const KHMER_VOICES = [
  { value: "km-KH-PisethNeural", label: "Piseth", gender: "Male" },
  { value: "km-KH-SreymomNeural", label: "Sreymom", gender: "Female" },
];
export const KHMER_TTS_VOICES = { piseth: KHMER_VOICES[0].value, sreymom: KHMER_VOICES[1].value, default: KHMER_VOICES[0].value };

export const deps = {
  async createTts(options) {
    const mod = await import("node-edge-tts");
    return new mod.EdgeTTS(options);
  },
};

export function normalizeVoice(voice) {
  const raw = String(voice || "").trim();
  const key = raw.toLowerCase();
  if (!key) return KHMER_TTS_VOICES.default;
  if (key.includes("piseth")) return KHMER_VOICES[0].value;
  if (key.includes("sreymom") || key.includes("syreymom")) return KHMER_VOICES[1].value;
  throw new AppError(400, "INVALID_VOICE", "Unknown voice. Use Piseth or Sreymom.");
}

const pct = (n, lo, hi, unit) => {
  const v = Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
  return `${v >= 0 ? "+" : ""}${v}${unit}`;
};
export const ratePct = (n) => pct(n, -50, 100, "%");
export const pitchHz = (n) => pct(n, -50, 50, "Hz");
export const volumePct = (n) => pct(n, -50, 50, "%");

export async function synthesizeSpeech(text, { voice, rate = 0, pitch = 0, volume = 0, timeout = 25000 } = {}) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) throw new AppError(400, "EMPTY_TEXT", "Please enter some text to convert to speech.");
  const v = normalizeVoice(voice);
  const file = join(tmpdir(), `tts-${randomUUID()}.mp3`);
  try {
    const tts = await deps.createTts({
      voice: v,
      lang: "km-KH",
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
      rate: ratePct(rate),
      pitch: pitchHz(pitch),
      volume: volumePct(volume),
      timeout,
    });
    await tts.ttsPromise(clean, file);
    const audio = await readFile(file);
    if (!audio.length) throw new Error("empty audio");
    return { audio, voice: v, contentType: "audio/mpeg" };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, "TTS_UNAVAILABLE", "The voice service (Microsoft Edge TTS) could not be reached. Please try again in a moment.");
  } finally {
    rm(file, { force: true }).catch(() => {});
  }
}
