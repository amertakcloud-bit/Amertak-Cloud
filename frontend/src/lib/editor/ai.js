import { transcribeFile } from "../srtClient.js";
import { toolsApi, withRetry, ApiError } from "../../services/toolsApi.js";
import { makeMediaClip, ttsRateFor, uid } from "./model.js";

// AI flows used by the video editor. All network + browser APIs are injected/local so the
// logic stays readable. Costs: transcription = ceil(MB × 5) whole tokens (charged by /srt/start);
// translation and voices are free.

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

export const VOICES = { m: "km-KH-PisethNeural", f: "km-KH-SreymomNeural" };
export const voiceForGender = (g) => (g === "f" ? VOICES.f : VOICES.m);

let ac = null;
export async function audioDuration(blob) {
  const AC = window.AudioContext || window.webkitAudioContext;
  ac = ac || new AC();
  const buf = await ac.decodeAudioData(await blob.arrayBuffer());
  return buf.duration;
}

// 3) Khmer voice for one cue: synthesize, and if the speech is longer than the slot, speed it up once.
export async function voiceForCue({ text, voice, slot, signal }) {
  let res = await withRetry(() => toolsApi.tts({ text, voice, rate: 0 }, signal), { signal });
  let dur = await audioDuration(res.blob);
  const rate = ttsRateFor(dur, slot);
  if (rate > 0) {
    res = await withRetry(() => toolsApi.tts({ text, voice, rate }, signal), { signal });
    dur = await audioDuration(res.blob);
  }
  return { blob: res.blob, duration: dur, rate };
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
