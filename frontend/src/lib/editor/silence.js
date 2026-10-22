// Finds silent stretches in decoded audio (pure, unit-tested) and decodes a media file to PCM.
// Returns ranges in SOURCE seconds: [[start, end], …]
export function findSilences(samples, sampleRate, { thresholdDb = -38, minSilence = 0.5, pad = 0.08, windowMs = 30 } = {}) {
  const win = Math.max(1, Math.round((sampleRate * windowMs) / 1000));
  const thr = 10 ** (thresholdDb / 20);
  const flags = [];
  for (let i = 0; i < samples.length; i += win) {
    let sum = 0;
    const end = Math.min(samples.length, i + win);
    for (let j = i; j < end; j++) sum += samples[j] * samples[j];
    flags.push(Math.sqrt(sum / (end - i)) < thr);
  }
  const out = [];
  let start = -1;
  const sec = (w) => (w * win) / sampleRate;
  for (let w = 0; w <= flags.length; w++) {
    if (w < flags.length && flags[w]) { if (start < 0) start = w; continue; }
    if (start >= 0) {
      const s = sec(start), e = sec(w);
      if (e - s >= minSilence) { const a = s + pad, b = e - pad; if (b - a > 0.1) out.push([Math.round(a * 1000) / 1000, Math.round(b * 1000) / 1000]); }
      start = -1;
    }
  }
  return out;
}

// Decode any audio/video blob to a mono Float32Array (browser only).
export async function decodeMono(blob) {
  const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const buf = await blob.arrayBuffer();
  const ctx = new AC(1, 1, 16000);
  const audio = await new Promise((res, rej) => ctx.decodeAudioData(buf, res, rej));
  const ch = audio.numberOfChannels;
  const out = new Float32Array(audio.length);
  for (let c = 0; c < ch; c++) { const d = audio.getChannelData(c); for (let i = 0; i < d.length; i++) out[i] += d[i] / ch; }
  return { samples: out, sampleRate: audio.sampleRate };
}
