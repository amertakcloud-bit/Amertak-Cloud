// Pure editing helpers for subtitle cues (unit-tested).
export const MIN_CUE = 0.3;

export const fmt = (sec) => {
  const ms = Math.round(Math.max(0, sec) * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
};

// "00:01:02,500" | "1:02.5" | "62.5" → seconds (or null)
export function parseClock(v) {
  const s = String(v).trim().replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (!m) return null;
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

let uid = 0;
export const withIds = (cues) => cues.map((c) => ({ ...c, id: c.id ?? `c${++uid}` }));

// Problems per cue: overlap with the next one, too short, empty text, end before start.
export function cueIssues(cues) {
  return cues.map((c, i) => {
    const issues = [];
    if (!String(c.text || "").trim()) issues.push("empty");
    if (!(c.end > c.start)) issues.push("order");
    else if (c.end - c.start < 0.2) issues.push("short");
    const next = cues[i + 1];
    if (next && c.end > next.start + 0.001) issues.push("overlap");
    return issues;
  });
}

export function updateCue(cues, id, patch) {
  return cues.map((c) => (c.id === id ? { ...c, ...patch, edited: true } : c));
}

export function removeCue(cues, id) {
  return cues.filter((c) => c.id !== id);
}

// Split in the middle of the text; time is split proportionally to the text length.
export function splitCue(cues, id, atChar) {
  const i = cues.findIndex((c) => c.id === id);
  if (i < 0) return cues;
  const c = cues[i];
  const chars = Array.from(c.text);
  const at = atChar ?? Math.floor(chars.length / 2);
  const a = chars.slice(0, at).join("").trim();
  const b = chars.slice(at).join("").trim();
  if (!a || !b) return cues;
  const t = c.start + ((c.end - c.start) * at) / chars.length;
  const first = { ...c, id: `${c.id}a${++uid}`, text: a, end: t, words: undefined, edited: true };
  const second = { ...c, id: `${c.id}b${++uid}`, text: b, start: t, words: undefined, edited: true };
  return [...cues.slice(0, i), first, second, ...cues.slice(i + 1)];
}

export function mergeWithNext(cues, id) {
  const i = cues.findIndex((c) => c.id === id);
  if (i < 0 || i === cues.length - 1) return cues;
  const a = cues[i], b = cues[i + 1];
  const merged = { ...a, id: `${a.id}m${++uid}`, text: `${a.text}\n${b.text}`.replace(/\n+/g, "\n"), end: b.end, words: undefined, edited: true };
  return [...cues.slice(0, i), merged, ...cues.slice(i + 2)];
}

export function shiftAll(cues, delta) {
  return cues.map((c) => ({ ...c, start: Math.max(0, c.start + delta), end: Math.max(MIN_CUE / 10, c.end + delta), edited: true }));
}

// Clamp overlaps (end → next start) without inventing new times elsewhere.
export function fixOverlaps(cues) {
  return cues.map((c, i) => {
    const n = cues[i + 1];
    return n && c.end > n.start ? { ...c, end: Math.max(c.start + 0.05, n.start), edited: true } : c;
  });
}

export const toPayload = (cues) => cues.map(({ start, end, text }) => ({ start, end, text }));
