import { AppError } from "./AppError.js";
import { deps as geminiDeps, mapGeminiError } from "./geminiClient.js";
import { convertToAudio } from "../services/audio/convert.js";

// Text-to-speech with Gemini TTS (Google AI Studio models, Khmer supported — detected automatically).
// Interactions API: https://ai.google.dev/gemini-api/docs/interactions/speech-generation
// The reply is base64 WAV (24 kHz, mono, 16-bit PCM); it is converted to MP3 with the bundled ffmpeg
// through pipes (no temp files → safe on Vercel).
export const ttsModel = () => process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";

// Prebuilt Gemini voices used by the app (gender per Google's voice descriptions as far as known — adjust here).
export const GEMINI_VOICES = [
  { value: "Kore", label: "Kore", gender: "Female" },
  { value: "Zephyr", label: "Zephyr", gender: "Female" },
  { value: "Aoede", label: "Aoede", gender: "Female" },
  { value: "Leda", label: "Leda", gender: "Female" },
  { value: "Puck", label: "Puck", gender: "Male" },
  { value: "Charon", label: "Charon", gender: "Male" },
  { value: "Fenrir", label: "Fenrir", gender: "Male" },
  { value: "Orus", label: "Orus", gender: "Male" },
];
export const DEFAULT_VOICES = { f: "Kore", m: "Puck" };

// Delivery style (the model reads it as an instruction; it is not spoken).
export const STYLES = {
  natural: "",
  warm: "warm and friendly",
  calm: "calm and slow",
  cheerful: "cheerful and upbeat",
  serious: "serious, clear and confident",
  fast: "speaking a little faster than normal",
};

export function normalizeGeminiVoice(voice) {
  const raw = String(voice || "").trim();
  if (!raw) return DEFAULT_VOICES.m;
  const hit = GEMINI_VOICES.find((v) => v.value.toLowerCase() === raw.toLowerCase());
  if (hit) return hit.value;
  const k = raw.toLowerCase(); // old Edge voice names (saved projects) keep working
  if (k.includes("piseth")) return DEFAULT_VOICES.m;
  if (k.includes("sreymom") || k.includes("syreymom")) return DEFAULT_VOICES.f;
  throw new AppError(400, "INVALID_VOICE", `Unknown voice. Use one of: ${GEMINI_VOICES.map((v) => v.value).join(", ")}.`);
}
export const normalizeStyle = (s) => (Object.hasOwn(STYLES, String(s || "natural")) ? String(s || "natural") : "natural");

// ── tiny WAV helpers (PCM 16-bit) ──
function pcmOf(wav) {
  let o = 12;
  while (o + 8 <= wav.length) {
    const id = wav.toString("latin1", o, o + 4);
    const size = wav.readUInt32LE(o + 4);
    if (id === "data") return wav.subarray(o + 8, size === 0 || o + 8 + size > wav.length ? wav.length : o + 8 + size);
    o += 8 + size + (size % 2);
  }
  throw new Error("not a WAV file");
}
function rateOf(wav) { return wav.length > 28 ? wav.readUInt32LE(24) : 24000; }
export function wavFrom(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// Long text → pieces of ≤ max characters, cut at Khmer / Latin sentence ends, then spaces, then hard.
export function splitText(text, max = 900) {
  const out = [];
  let rest = String(text).trim();
  while (rest.length > max) {
    const win = rest.slice(0, max);
    let cut = Math.max(win.lastIndexOf("។"), win.lastIndexOf("៕"), win.lastIndexOf(". "), win.lastIndexOf("? "), win.lastIndexOf("! "), win.lastIndexOf("\n"));
    if (cut < max * 0.4) cut = win.lastIndexOf(" ");
    if (cut < max * 0.4) cut = max - 1;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

function audioFrom(res) {
  const direct = res?.output_audio?.data ?? res?.outputAudio?.data;
  if (direct) return direct;
  for (const step of res?.steps ?? []) {
    for (const c of step?.content ?? []) if (c?.type === "audio" && c.data) return c.data;
  }
  return null;
}

async function one(client, { text, voice, style }) {
  const prompt = { type: "text", text };
  if (style) prompt.annotations = [{ type: "speech_metadata", style }];
  const res = await client.interactions.create({
    model: ttsModel(),
    input: [{ type: "user_input", content: [prompt] }],
    response_format: { type: "audio" },
    generation_config: { speech_config: [{ voice }] },
  });
  const b64 = audioFrom(res);
  if (!b64) throw new AppError(502, "TTS_EMPTY", "Gemini returned no audio for this text. Try a shorter or different text.");
  return Buffer.from(b64, "base64");
}

// → { audio: Buffer, contentType, voice, provider: "gemini", chars }
export async function synthesizeGemini({ apiKey, text, voice, style = "natural" }) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) throw new AppError(400, "EMPTY_TEXT", "Please enter some text to convert to speech.");
  const v = normalizeGeminiVoice(voice);
  const st = normalizeStyle(style);
  const client = await geminiDeps.createClient(apiKey);
  let wav;
  try {
    const parts = [];
    for (const piece of splitText(clean)) {
      let lastErr;
      for (let a = 0; a < 2; a++) { // one retry: the TTS model occasionally returns an empty/odd answer
        try { parts.push(await one(client, { text: piece, voice: v, style: STYLES[st] })); lastErr = null; break; } catch (e) { lastErr = e; }
      }
      if (lastErr) throw lastErr;
    }
    wav = parts.length === 1 ? parts[0] : wavFrom(Buffer.concat(parts.map(pcmOf)), rateOf(parts[0]));
  } catch (err) {
    throw mapGeminiError(err);
  }
  try {
    const mp3 = await convertToAudio(wav, { format: "mp3", bitrate: 96 });
    return { audio: mp3.audio, contentType: "audio/mpeg", voice: v, provider: "gemini", chars: clean.length };
  } catch {
    return { audio: wav, contentType: "audio/wav", voice: v, provider: "gemini", chars: clean.length }; // ffmpeg unavailable → still works
  }
}
