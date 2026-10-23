// Splits audio into chunks for the SRT API, cutting at the quietest moment near the target
// length so words are never sliced in half. Pure function (no DOM) → unit-testable.
//
//   samples : Float32Array (mono)   rate : sample rate (16000)
//   returns : [{ start, end }] in SAMPLES, contiguous, covering the whole signal.
export function planChunks(samples, rate, { target = 90, max = 100, min = 20, windowSec = 12 } = {}) {
  const total = samples.length;
  const maxS = Math.floor(max * rate);
  if (total <= maxS) return total ? [{ start: 0, end: total }] : [];

  const frame = Math.floor(rate * 0.02); // 20 ms
  const energyAt = (from) => {
    let e = 0;
    const to = Math.min(total, from + frame);
    for (let i = from; i < to; i++) e += samples[i] * samples[i];
    return e / Math.max(1, to - from);
  };

  const chunks = [];
  let start = 0;
  while (start < total) {
    if (total - start <= maxS) { chunks.push({ start, end: total }); break; }
    const ideal = start + Math.floor(target * rate);
    const lo = Math.max(start + Math.floor(min * rate), ideal - Math.floor(windowSec * rate));
    const hi = Math.min(start + maxS - frame, ideal + Math.floor((max - target - 1) * rate));
    // smoothed energy over 5 frames → most silent point wins; ties → closest to ideal
    let best = ideal, bestE = Infinity;
    for (let p = lo; p <= hi; p += frame) {
      let e = 0;
      for (let k = -2; k <= 2; k++) e += energyAt(Math.max(0, p + k * frame));
      e += Math.abs(p - ideal) / rate * 1e-9; // tiny bias toward ideal
      if (e < bestE) { bestE = e; best = p; }
    }
    chunks.push({ start, end: best });
    start = best;
  }
  return chunks;
}
