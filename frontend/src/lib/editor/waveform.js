import { decodeToMono16k } from "../audio/decode.js";

// Audio peaks for the timeline waveform: PPS buckets per second, values 0..1. Cached per media id.
export const PPS = 50;
const cache = new Map();

export function peaksFromSamples(samples, rate, pps = PPS) {
  const per = Math.max(1, Math.floor(rate / pps));
  const n = Math.ceil(samples.length / per);
  const out = new Float32Array(n);
  let max = 1e-6;
  for (let i = 0; i < n; i++) {
    let m = 0;
    const end = Math.min(samples.length, (i + 1) * per);
    for (let j = i * per; j < end; j++) { const v = Math.abs(samples[j]); if (v > m) m = v; }
    out[i] = m; if (m > max) max = m;
  }
  for (let i = 0; i < n; i++) out[i] = Math.min(1, out[i] / max);
  return out;
}

export function getPeaks(mediaId, getBlob) {
  if (!cache.has(mediaId)) {
    cache.set(mediaId, (async () => {
      const blob = await getBlob(mediaId);
      if (!blob) throw new Error("missing");
      const { samples, rate } = await decodeToMono16k(blob, { maxMinutes: 60 });
      return peaksFromSamples(samples, rate);
    })().catch((e) => { cache.delete(mediaId); throw e; }));
  }
  return cache.get(mediaId);
}
export const forgetPeaks = (mediaId) => cache.delete(mediaId);
