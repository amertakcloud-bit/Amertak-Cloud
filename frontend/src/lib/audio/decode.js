import { encodeWav } from "./wav.js";

export const TARGET_RATE = 16000;
export const MAX_MINUTES = 60;

export class DecodeError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// Decodes any audio/video file the browser understands into mono Float32 at 16 kHz.
const decodedCache = new WeakMap();
// Remember samples already decoded for a File so the same audio is never decoded twice.
export const primeDecoded = (file, result) => { try { decodedCache.set(file, result); } catch { /* not cacheable */ } };

export async function decodeToMono16k(file, { maxMinutes = MAX_MINUTES } = {}) {
  const hit = decodedCache.get(file);
  if (hit) return hit;
  const out = await decodeFresh(file, maxMinutes);
  primeDecoded(file, out);
  return out;
}

async function decodeFresh(file, maxMinutes) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new DecodeError("NO_AUDIO_API", "This browser cannot decode audio.");
  const arr = await file.arrayBuffer();
  const ctx = new Ctx();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(arr);
  } catch {
    throw new DecodeError("DECODE_FAILED", "This file could not be decoded. Try MP3, WAV, M4A, OGG, MP4 or WebM.");
  } finally {
    ctx.close?.().catch?.(() => {});
  }
  if (decoded.duration > maxMinutes * 60) {
    throw new DecodeError("TOO_LONG", `Audio longer than ${maxMinutes} minutes is not supported in the browser.`);
  }
  const frames = Math.ceil(decoded.duration * TARGET_RATE);
  const off = new OfflineAudioContext(1, frames, TARGET_RATE); // mono mix-down + resample
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return { samples: rendered.getChannelData(0), rate: TARGET_RATE, duration: decoded.duration };
}

export const sliceToWav = (samples, start, end, rate = TARGET_RATE) => encodeWav([samples.subarray(start, end)], rate);

// Full-quality decode for the Export-audio tool (keeps channels + original rate).
export async function decodeFull(file, { maxMinutes = 120 } = {}) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new DecodeError("NO_AUDIO_API", "This browser cannot decode audio.");
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
    if (decoded.duration > maxMinutes * 60) throw new DecodeError("TOO_LONG", `Files longer than ${maxMinutes} minutes are not supported.`);
    const channels = Array.from({ length: Math.min(2, decoded.numberOfChannels) }, (_, i) => decoded.getChannelData(i));
    return { channels, rate: decoded.sampleRate, duration: decoded.duration };
  } catch (e) {
    if (e instanceof DecodeError) throw e;
    throw new DecodeError("DECODE_FAILED", "This file could not be decoded. It may have no audio track or an unsupported format.");
  } finally {
    ctx.close?.().catch?.(() => {});
  }
}
