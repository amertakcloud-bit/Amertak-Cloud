// Pure-JS WAV reader + energy analysis (no ffmpeg needed → works on Vercel).
// The browser sends 16-bit PCM mono WAV chunks (16 kHz) — see frontend lib/audio.
import { AppError } from "../../lib/AppError.js";

export const FRAME_SEC = 0.01; // 10 ms analysis frames

// Parses a RIFF/WAVE buffer. Throws AppError(400) for anything that is not
// uncompressed 16-bit mono PCM.
export function parseWav(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 44) {
    throw new AppError(400, "INVALID_AUDIO", "The audio chunk is empty or too small.");
  }
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new AppError(400, "INVALID_AUDIO", "The audio chunk is not a WAV file.");
  }

  let fmt = null;
  let dataOffset = -1;
  let dataLength = 0;
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === "fmt " && body + 16 <= buf.length) {
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      dataOffset = body;
      // Some encoders write 0 / 0xFFFFFFFF as the size → use what is really there.
      dataLength = size === 0 || body + size > buf.length ? buf.length - body : size;
      break;
    }
    pos = body + size + (size % 2);
  }

  if (!fmt || dataOffset < 0) throw new AppError(400, "INVALID_AUDIO", "The WAV header is incomplete.");
  if (fmt.format !== 1 || fmt.bits !== 16) {
    throw new AppError(400, "INVALID_AUDIO", "Only 16-bit PCM WAV audio is supported for chunks.");
  }
  if (fmt.channels !== 1) throw new AppError(400, "INVALID_AUDIO", "Chunks must be mono.");
  if (fmt.sampleRate < 8000 || fmt.sampleRate > 48000) {
    throw new AppError(400, "INVALID_AUDIO", "The sample rate must be between 8 kHz and 48 kHz.");
  }

  const sampleCount = Math.floor(dataLength / 2);
  return {
    sampleRate: fmt.sampleRate,
    sampleCount,
    duration: sampleCount / fmt.sampleRate,
    dataOffset,
  };
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = Float32Array.from(arr).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0;
}

// RMS per 10 ms frame.
export function frameEnergy(buf, info) {
  const frameSamples = Math.max(1, Math.round(info.sampleRate * FRAME_SEC));
  const frames = Math.ceil(info.sampleCount / frameSamples);
  const rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const start = f * frameSamples;
    const end = Math.min(info.sampleCount, start + frameSamples);
    let sum = 0;
    for (let i = start; i < end; i++) {
      const v = buf.readInt16LE(info.dataOffset + i * 2) / 32768;
      sum += v * v;
    }
    rms[f] = Math.sqrt(sum / Math.max(1, end - start));
  }
  return rms;
}

// Adaptive voice-activity detection from frame energy.
export function detectSpeech(rms) {
  const floor = percentile(rms, 0.1);
  const loud = percentile(rms, 0.95);
  const threshold = Math.max(floor * 3, loud * 0.08, 0.002);
  const speech = Array.from(rms, (v) => v > threshold);
  const gapFrames = 15; // bridge gaps shorter than 150 ms
  let i = 0;
  while (i < speech.length) {
    if (!speech[i]) {
      let j = i;
      while (j < speech.length && !speech[j]) j++;
      if (i > 0 && j < speech.length && j - i < gapFrames) for (let k = i; k < j; k++) speech[k] = true;
      i = j;
    } else i++;
  }
  return { speech, threshold, silent: loud < 0.003 };
}

export function speechRatio(speech, start, end) {
  const a = Math.max(0, Math.floor(start / FRAME_SEC));
  const b = Math.min(speech.length, Math.ceil(end / FRAME_SEC));
  if (b <= a) return 0;
  let n = 0;
  for (let i = a; i < b; i++) if (speech[i]) n++;
  return n / (b - a);
}

export function analyzeWav(buf) {
  const info = parseWav(buf);
  const rms = frameEnergy(buf, info);
  const { speech, silent } = detectSpeech(rms);
  return { ...info, rms, speech, silent };
}
