import { addClip, clamp, cutRange, makeTextClip, MIN_DUR, rippleDelete, round3, splitClip, trimEnd, trimStart, updateClip, clipEnd } from "./model.js";

// Applies the AI's (already server-validated) operations to a project. Validated AGAIN here:
// unknown ops, unknown ids and out-of-range values are skipped, never thrown.
const COLOR = /^#[0-9a-fA-F]{6}$/;
const NUM = { x: [-0.5, 1.5], y: [-0.5, 1.5], scale: [0.05, 5], rotation: [-360, 360], opacity: [0, 1], volume: [0, 2], fadeIn: [0, 10], fadeOut: [0, 10], brightness: [0, 2], contrast: [0, 2], saturate: [0, 3], start: [0, 36000], dur: [MIN_DUR, 36000] };
const FONTS = ["sans", "serif", "mono", "round", "display"];

function safePatch(p) {
  const o = {};
  for (const [k, [lo, hi]] of Object.entries(NUM)) if (Number.isFinite(Number(p?.[k])) && p[k] !== null && p[k] !== "") o[k] = clamp(Number(p[k]), lo, hi);
  if (typeof p?.flipX === "boolean") o.flipX = p.flipX;
  if (typeof p?.text === "string") o.text = p.text.slice(0, 500);
  if (p?.style && typeof p.style === "object") o.style = safeStyle(p.style);
  return o;
}
function safeStyle(s) {
  const o = {};
  if (Number.isFinite(Number(s.size))) o.size = clamp(Number(s.size), 1.5, 25);
  if (typeof s.color === "string" && COLOR.test(s.color)) o.color = s.color;
  if (typeof s.outlineColor === "string" && COLOR.test(s.outlineColor)) o.outlineColor = s.outlineColor;
  if (typeof s.bg === "string" && /^(rgba\([\d\s.,]+\)|transparent)$/.test(s.bg)) o.bg = s.bg;
  for (const k of ["bold", "italic", "outline", "shadow"]) if (typeof s[k] === "boolean") o[k] = s[k];
  if (["left", "center", "right"].includes(s.align)) o.align = s.align;
  if (FONTS.includes(s.font)) o.font = s.font;
  return o;
}

function resolve(p, target, ctx) {
  const t = String(target);
  if (t === "selected") return ctx.selected ? p.clips.filter((c) => c.id === ctx.selected) : [];
  if (t === "captions") return p.clips.filter((c) => c.type === "caption");
  if (t === "texts") return p.clips.filter((c) => c.type === "text");
  if (t === "all_video") return p.clips.filter((c) => c.type === "video" || c.type === "image");
  if (t === "all_audio") return p.clips.filter((c) => c.type === "audio" || c.type === "video");
  return p.clips.filter((c) => c.id === t);
}

// → { project, applied: number, skipped: number, actions: string[] }
export function applyOps(project, ops, ctx = {}) {
  let p = project, applied = 0, skipped = 0;
  const actions = [];
  for (const op of Array.isArray(ops) ? ops.slice(0, 30) : []) {
    const before = p;
    try {
      switch (op?.op) {
        case "add_text": {
          const text = String(op.text || "").slice(0, 500).trim();
          if (!text) break;
          const c = makeTextClip({ text, start: Number(op.start) || 0, dur: clamp(Number(op.dur) || 4, 0.2, 600), style: op.style ? safeStyle(op.style) : undefined });
          c.x = clamp(Number(op.x ?? 0.5), 0, 1); c.y = clamp(Number(op.y ?? 0.5), 0, 1);
          p = addClip(p, c);
          break;
        }
        case "update": {
          const patch = safePatch(op.patch);
          if (!Object.keys(patch).length) break;
          for (const c of resolve(p, op.target, ctx)) {
            const { style, ...rest } = patch;
            const textual = c.type === "text" || c.type === "caption";
            const next = { ...rest };
            if (!textual) delete next.text;
            if (style && textual) next.style = { ...c.style, ...style };
            p = updateClip(p, c.id, next);
          }
          break;
        }
        case "delete": for (const c of resolve(p, op.target, ctx)) p = { ...p, clips: p.clips.filter((x) => x.id !== c.id) }; break;
        case "ripple_delete": for (const c of resolve(p, op.target, ctx)) p = rippleDelete(p, c.id); break;
        case "split": {
          const at = Number(op.at);
          for (const c of resolve(p, op.target, ctx)) if (Number.isFinite(at)) p = splitClip(p, c.id, at).project;
          break;
        }
        case "trim": {
          for (const c of resolve(p, op.target, ctx)) {
            if (Number.isFinite(Number(op.start)) && op.start != null) p = trimStart(p, c.id, Number(op.start));
            if (Number.isFinite(Number(op.end)) && op.end != null) p = trimEnd(p, c.id, Number(op.end));
          }
          break;
        }
        case "action": if (["generate_captions", "translate_voice", "remove_silence"].includes(op.name)) { actions.push(op.name); applied += 1; } continue;
        default: break;
      }
    } catch { p = before; }
    if (p !== before) applied += 1; else skipped += 1;
  }
  return { project: p, applied, skipped, actions: [...new Set(actions)] };
}

export { cutRange, round3, clipEnd };
