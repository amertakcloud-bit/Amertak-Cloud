import { transcribeFile } from "../srtClient.js";
import { toolsApi, withRetry, ApiError } from "../../services/toolsApi.js";
import { makeMediaClip, uid } from "./model.js";
import { sliceToWav } from "../audio/decode.js";

// AI flows used by the video editor. All network + browser APIs are injected/local so the
// logic stays readable. Costs: transcription = ceil(MB × 5) whole tokens (charged by /srt/start);
// translation is free; voices (Gemini TTS) cost 1 token per 200 characters (paid up-front through a voice job).

// 1) captions from a media file → cues in SOURCE-media time
export async function captionsFromFile(file, { settings, onProgress, onCharged, signal }) {
  const r = await transcribeFile(file, { settings, onProgress, onCharged, signal });
  return { cues: r.cues.map((c) => ({ start: c.start, end: c.end, text: c.text })), cost: r.cost };
}

// 2) Khmer translation, in batches of 120 lines
// With { speakers: true } it also returns the speaker's gender per line ("m" | "f") so the voice can be chosen automatically.
export async function translateLines(lines, from, signal, { speakers = false, onProgress } = {}) {
  const out = [], genders = [];
  for (let i = 0; i < lines.length; i += 120) {
    const batch = lines.slice(i, i + 120);
    const res = await withRetry(() => toolsApi.editorTranslate(batch, from, signal, speakers), { signal });
    out.push(...res.data.lines);
    if (speakers) genders.push(...(res.data.genders || batch.map(() => "m")));
    onProgress?.(Math.min(lines.length, i + batch.length), lines.length);
  }
  return speakers ? { lines: out, genders } : out;
}

// Gemini TTS voices (the server validates them). m = male, f = female.
export const VOICE_LIST = [
  { value: "Puck", gender: "m" }, { value: "Charon", gender: "m" }, { value: "Fenrir", gender: "m" }, { value: "Orus", gender: "m" },
  { value: "Kore", gender: "f" }, { value: "Zephyr", gender: "f" }, { value: "Aoede", gender: "f" }, { value: "Leda", gender: "f" },
];
export const VOICES = { m: "Puck", f: "Kore" };
export const voiceForGender = (g) => (g === "f" ? VOICES.f : VOICES.m);
// projects saved with the old Edge voices keep working
export const legacyVoice = (v) => (/piseth/i.test(v || "") ? VOICES.m : /sreymom/i.test(v || "") ? VOICES.f : VOICE_LIST.some((x) => x.value === v) ? v : VOICES.m);
// billing counts characters the same way the server does (whitespace collapsed)
export const voiceChars = (text) => String(text || "").replace(/\s+/g, " ").trim().length;

let ac = null;
export async function audioDuration(blob) {
  const AC = window.AudioContext || window.webkitAudioContext;
  ac = ac || new AC();
  const buf = await ac.decodeAudioData(await blob.arrayBuffer());
  return buf.duration;
}

// Speeds audio up (pitch rises a little) — used to fit speech into its caption slot without a second paid request.
export async function speedUpBlob(blob, factor) {
  const AC = window.AudioContext || window.webkitAudioContext;
  ac = ac || new AC();
  const buf = await ac.decodeAudioData(await blob.arrayBuffer());
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.length / factor)), buf.sampleRate);
  const src = off.createBufferSource();
  src.buffer = buf; src.playbackRate.value = factor; src.connect(off.destination); src.start();
  const out = await off.startRendering();
  const wav = sliceToWav(out.getChannelData(0), 0, out.length, out.sampleRate);
  return { blob: new Blob([wav], { type: "audio/wav" }), duration: out.length / out.sampleRate };
}

// 3) Khmer voice for one cue (Gemini TTS, paid through `job`): one request; if the speech is longer than its
// slot it is sped up locally (max 1.5×) — free, no second generation.
export async function voiceForCue({ text, voice, slot, signal, job }) {
  const res = await withRetry(() => toolsApi.tts({ text, voice: legacyVoice(voice), style: "natural" }, signal, { job }), { signal });
  let blob = res.blob;
  let dur = await audioDuration(blob);
  let rate = 0;
  const factor = slot > 0 && dur > slot * 1.02 ? Math.min(1.5, dur / slot) : 1;
  if (factor > 1.02) {
    const fast = await speedUpBlob(blob, factor);
    blob = fast.blob; dur = fast.duration; rate = Math.round((factor - 1) * 100);
  }
  return { blob, duration: dur, rate };
}

// Runs `worker` over items with limited concurrency; stops at the first error.
export async function pool(items, limit, worker, signal) {
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      if (signal?.aborted) throw new ApiError("Cancelled", { code: "ABORTED" });
      const i = next++;
      await worker(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

// Builds a media entry + clip for a generated voice file.
export function voiceMedia(name, duration, size) {
  return { id: uid("m"), name, kind: "audio", source: "voice", duration, width: 0, height: 0, size };
}
export const voiceClip = (media, start) => makeMediaClip(media, { start, lane: "voice" });
