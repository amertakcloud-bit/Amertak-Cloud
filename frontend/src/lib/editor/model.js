// Pure project model for the video editor (no DOM, unit-tested).
//
// project = { version, width, height, fps, media: { [id]: MediaMeta }, clips: Clip[], captionStyle }
// MediaMeta = { id, name, kind: "video"|"audio"|"image", duration, width, height, size, source }
// Clip      = { id, lane, type, start, dur, mediaId?, offset?, volume?, x?, y?, scale?, opacity?, text?, style? }
//
// Lanes (top → bottom on the timeline; visual lanes are drawn bottom-to-top in this order):
export const LANES = [
  { id: "overlay", kind: "visual", types: ["image", "video"] },
  { id: "text", kind: "text", types: ["text"] },
  { id: "caption", kind: "text", types: ["caption"] },
  { id: "video", kind: "visual", types: ["video", "image"] },
  { id: "audio", kind: "audio", types: ["audio", "video"] },
  { id: "voice", kind: "audio", types: ["audio"] },
];
export const MIN_DUR = 0.1;
export const IMAGE_DEFAULT_DUR = 5;
export const TEXT_DEFAULT_DUR = 4;

export const DEFAULT_TEXT_STYLE = { size: 7, color: "#ffffff", bg: "rgba(0,0,0,0)", bold: true, outline: true, align: "center" };
export const DEFAULT_CAPTION_STYLE = { size: 5.2, color: "#ffffff", bg: "rgba(0,0,0,0.55)", bold: true, outline: false, align: "center" };

let counter = 0;
export const uid = (p = "c") => `${p}${Date.now().toString(36)}${(++counter).toString(36)}`;

export function newProject({ width = 1280, height = 720 } = {}) {
  return { version: 1, width, height, fps: 30, media: {}, clips: [], captionStyle: { ...DEFAULT_CAPTION_STYLE } };
}

export const round3 = (n) => Math.round(n * 1000) / 1000;
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const clipEnd = (c) => c.start + c.dur;

export function projectDuration(p) {
  return round3(p.clips.reduce((m, c) => Math.max(m, clipEnd(c)), 0));
}

// ── clip factories ──
export function makeMediaClip(media, { start = 0, lane, dur } = {}) {
  const isImage = media.kind === "image";
  const d = dur ?? (isImage ? IMAGE_DEFAULT_DUR : Math.max(MIN_DUR, media.duration || 1));
  const laneId = lane || (media.kind === "audio" ? (media.source === "voice" ? "voice" : "audio") : "video");
  return {
    id: uid(), lane: laneId, type: media.kind, mediaId: media.id,
    start: round3(Math.max(0, start)), dur: round3(d), offset: 0,
    volume: 1, x: 0.5, y: 0.5, scale: 1, opacity: 1,
  };
}

export function makeTextClip({ text = "Text", start = 0, dur = TEXT_DEFAULT_DUR, lane = "text", type = "text", style } = {}) {
  return {
    id: uid(), lane, type, start: round3(Math.max(0, start)), dur: round3(dur), text,
    x: 0.5, y: type === "caption" ? 0.88 : 0.5, style: { ...(type === "caption" ? DEFAULT_CAPTION_STYLE : DEFAULT_TEXT_STYLE), ...(style || {}) },
  };
}

// ── immutable edits (each returns a NEW project) ──
const mapClip = (p, id, fn) => ({ ...p, clips: p.clips.map((c) => (c.id === id ? fn(c) : c)) });

export const addMedia = (p, media) => ({ ...p, media: { ...p.media, [media.id]: media } });
export const addClip = (p, clip) => ({ ...p, clips: [...p.clips, clip] });
export const removeClip = (p, id) => ({ ...p, clips: p.clips.filter((c) => c.id !== id) });
export const updateClip = (p, id, patch) => mapClip(p, id, (c) => ({ ...c, ...patch }));

export function moveClip(p, id, start) {
  return mapClip(p, id, (c) => ({ ...c, start: round3(Math.max(0, start)) }));
}

// Source length available for a media clip (Infinity for images/text).
function sourceLimit(p, c) {
  if (c.type === "image" || c.type === "text" || c.type === "caption") return Infinity;
  const m = p.media[c.mediaId];
  return m?.duration > 0 ? m.duration : Infinity;
}

// Trim the left edge to timeline time `t` (the clip's source offset moves with it).
export function trimStart(p, id, t) {
  return mapClip(p, id, (c) => {
    const end = clipEnd(c);
    let nt = clamp(t, 0, end - MIN_DUR);
    const hasSource = c.type === "video" || c.type === "audio";
    if (hasSource && c.offset + (nt - c.start) < 0) nt = c.start - c.offset; // cannot go before the source start
    const delta = nt - c.start;
    return { ...c, start: round3(nt), dur: round3(end - nt), ...(hasSource ? { offset: round3((c.offset || 0) + delta) } : {}) };
  });
}

// Trim the right edge to timeline time `t`.
export function trimEnd(p, id, t) {
  return mapClip(p, id, (c) => {
    const limit = sourceLimit(p, c);
    const maxDur = limit === Infinity ? Infinity : limit - (c.offset || 0);
    return { ...c, dur: round3(clamp(t - c.start, MIN_DUR, maxDur)) };
  });
}

// Split a clip at timeline time `t` into two clips. Returns { project, ids } (ids = [left, right]).
export function splitClip(p, id, t) {
  const c = p.clips.find((x) => x.id === id);
  if (!c || t <= c.start + MIN_DUR || t >= clipEnd(c) - MIN_DUR) return { project: p, ids: null };
  const left = { ...c, dur: round3(t - c.start) };
  const right = { ...c, id: uid(), start: round3(t), dur: round3(clipEnd(c) - t) };
  if (c.type === "video" || c.type === "audio") right.offset = round3((c.offset || 0) + (t - c.start));
  return { project: { ...p, clips: p.clips.flatMap((x) => (x.id === id ? [left, right] : [x])) }, ids: [left.id, right.id] };
}

export function duplicateClip(p, id) {
  const c = p.clips.find((x) => x.id === id);
  if (!c) return { project: p, id: null };
  const copy = { ...c, id: uid(), start: round3(clipEnd(c)) };
  return { project: addClip(p, copy), id: copy.id };
}

// Clips that are visible/audible at time t.
export const clipsAt = (p, t) => p.clips.filter((c) => t >= c.start - 1e-6 && t < clipEnd(c) - 1e-6);

// Draw order: lanes bottom → top (video first, then overlay, then text/captions on top).
const DRAW_ORDER = ["video", "overlay", "text", "caption"];
export const drawOrder = (clips) =>
  clips.filter((c) => DRAW_ORDER.includes(c.lane)).sort((a, b) => DRAW_ORDER.indexOf(a.lane) - DRAW_ORDER.indexOf(b.lane) || a.start - b.start);

// Snap `t` to nearby points (playhead, other clip edges). Returns the snapped time.
export function snap(p, t, { points = [], threshold = 0.08, ignoreId } = {}) {
  const cands = [0, ...points];
  for (const c of p.clips) if (c.id !== ignoreId) cands.push(c.start, clipEnd(c));
  let best = t, bd = threshold;
  for (const x of cands) { const d = Math.abs(x - t); if (d < bd) { bd = d; best = x; } }
  return round3(best);
}

// ── captions ⇄ SRT ──
export function parseSrt(text) {
  const src = String(text || "").replace(/^﻿/, "").replace(/\r/g, "").trim();
  if (!src) return [];
  const toSec = (s) => {
    const m = /^(\d+):(\d{1,2}):(\d{1,2})[,.](\d{1,3})$/.exec(s.trim());
    return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000 : null;
  };
  const cues = [];
  for (const block of src.split(/\n{2,}/)) {
    const lines = block.split("\n").map((l) => l.trimEnd());
    const ti = lines.findIndex((l) => l.includes("-->"));
    if (ti < 0) continue;
    const [a, b] = lines[ti].split("-->");
    const start = toSec(a), end = toSec((b || "").trim().split(/\s+/)[0] || "");
    const body = lines.slice(ti + 1).join("\n").replace(/<[^>]+>/g, "").trim();
    if (start == null || end == null || end <= start || !body) continue;
    cues.push({ start: round3(start), end: round3(end), text: body });
  }
  return cues;
}

const pad = (n, l = 2) => String(n).padStart(l, "0");
export function srtTime(sec) {
  const ms = Math.round(Math.max(0, sec) * 1000);
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor((ms % 3600000) / 60000))}:${pad(Math.floor((ms % 60000) / 1000))},${pad(ms % 1000, 3)}`;
}

export function buildSrt(clips) {
  const caps = clips.filter((c) => c.type === "caption" && c.text).sort((a, b) => a.start - b.start);
  return caps.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(clipEnd(c))}\n${c.text}\n`).join("\n");
}

// SRT cues (in source-media time) → caption clips on the timeline for a media clip.
// Only the part of the source that is actually used (offset … offset+dur) is kept.
export function cuesToCaptionClips(cues, source, style) {
  const lo = source.offset || 0, hi = lo + source.dur;
  const out = [];
  for (const q of cues) {
    const s = Math.max(q.start, lo), e = Math.min(q.end, hi);
    if (e - s < 0.05) continue;
    out.push({ ...makeTextClip({ text: q.text, start: source.start + (s - lo), dur: e - s, lane: "caption", type: "caption", style }), source: source.id });
  }
  return out;
}

// Plain cues (already on the timeline clock) → caption clips.
export function cuesToTimelineCaptions(cues, style) {
  return cues.map((q) => makeTextClip({ text: q.text, start: q.start, dur: Math.max(MIN_DUR, q.end - q.start), lane: "caption", type: "caption", style }));
}

// Playback speed (percent for edge-tts: -50…+100) needed to fit `naturalSec` of speech into `slotSec`.
export function ttsRateFor(naturalSec, slotSec) {
  if (!(slotSec > 0) || !(naturalSec > slotSec * 1.02)) return 0;
  return clamp(Math.ceil((naturalSec / slotSec - 1) * 100), 0, 100);
}
