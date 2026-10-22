import test from "node:test";
import assert from "node:assert/strict";
import * as M from "../src/lib/editor/model.js";
import { tokensForBytes, RATES } from "../src/lib/tokens.js";

const media = { id: "m1", name: "a.mp4", kind: "video", duration: 10, width: 1280, height: 720 };
const base = () => M.addMedia(M.newProject(), media);

test("split keeps total length and moves the source offset", () => {
  let p = base();
  const c = M.makeMediaClip(media, { start: 2 });
  p = M.addClip(p, c);
  const { project, ids } = M.splitClip(p, c.id, 6);
  const [a, b] = ids.map((id) => project.clips.find((x) => x.id === id));
  assert.equal(a.dur, 4); assert.equal(b.start, 6); assert.equal(b.dur, 6); assert.equal(b.offset, 4);
  assert.equal(M.projectDuration(project), 12);
  assert.equal(M.splitClip(p, c.id, 2.05).ids, null); // too close to the edge
});

test("trim start/end respect the source", () => {
  let p = base(); const c = M.makeMediaClip(media, { start: 0 }); p = M.addClip(p, c);
  p = M.trimStart(p, c.id, 3); let x = p.clips[0];
  assert.deepEqual([x.start, x.dur, x.offset], [3, 7, 3]);
  p = M.trimEnd(p, c.id, 50); x = p.clips[0];
  assert.equal(x.dur, 7); // cannot extend past the source (offset 3 + dur 7 = 10)
  p = M.trimEnd(p, c.id, 4); assert.equal(p.clips[0].dur, 1);
});

test("clipsAt / drawOrder", () => {
  let p = base();
  p = M.addClip(p, M.makeMediaClip(media, { start: 0 }));
  p = M.addClip(p, M.makeTextClip({ text: "hi", start: 1, dur: 2 }));
  p = M.addClip(p, M.makeTextClip({ text: "cap", start: 1, dur: 2, lane: "caption", type: "caption" }));
  const at = M.clipsAt(p, 1.5);
  assert.deepEqual(M.drawOrder(at).map((c) => c.lane), ["video", "text", "caption"]);
  assert.equal(M.clipsAt(p, 5).length, 1);
});

test("SRT round trip (Khmer + multi-line)", () => {
  const srt = "1\n00:00:00,600 --> 00:00:02,000\nសួស្តី បង\n\n2\n00:00:02,500 --> 00:00:04,000\nline one\nline two\n";
  const cues = M.parseSrt(srt);
  assert.equal(cues.length, 2); assert.equal(cues[1].text, "line one\nline two");
  const clips = M.cuesToTimelineCaptions(cues);
  assert.equal(M.buildSrt(clips), srt);
  assert.deepEqual(M.parseSrt("garbage"), []);
});

test("cues from a trimmed source clip land on the timeline", () => {
  const src = { ...M.makeMediaClip(media, { start: 10 }), offset: 2, dur: 4 }; // uses source 2…6 at timeline 10…14
  const caps = M.cuesToCaptionClips([{ start: 0, end: 1, text: "before" }, { start: 3, end: 5, text: "in" }, { start: 5, end: 9, text: "tail" }], src);
  assert.deepEqual(caps.map((c) => [c.text, c.start, c.dur]), [["in", 11, 2], ["tail", 13, 1]]);
});

test("ttsRateFor speeds up only when speech is too long", () => {
  assert.equal(M.ttsRateFor(2, 3), 0);
  assert.equal(M.ttsRateFor(3, 2), 50);
  assert.equal(M.ttsRateFor(10, 2), 100);
});

test("token cost: whole tokens, rounded up", () => {
  assert.equal(tokensForBytes(1048576, RATES.captionPerMB), 5);
  assert.equal(tokensForBytes(2.12 * 1048576, RATES.captionPerMB), 11);
  assert.equal(tokensForBytes(5 * 1048576, RATES.cloudSharePerMB), 10);
});

// ── real-editor ops ──
import { rippleDelete, cutRange, pointInBox, hitTest, fadeAlpha, removeSilentRanges, makeTextClip as mkText, addClip as addC, newProject as np2, projectDuration as pd2 } from "../src/lib/editor/model.js";
import { applyOps } from "../src/lib/editor/aiOps.js";
import { findSilences } from "../src/lib/editor/silence.js";

test("rippleDelete closes the gap on the same lane only", () => {
  let p = np2();
  const a = mkText({ text: "a", start: 0, dur: 2 }), b = mkText({ text: "b", start: 2, dur: 2 }), cap = mkText({ text: "c", start: 3, dur: 1, lane: "caption", type: "caption" });
  p = addC(addC(addC(p, a), b), cap);
  const r = rippleDelete(p, a.id);
  assert.equal(r.clips.length, 2);
  assert.equal(r.clips.find((c) => c.id === b.id).start, 0);
  assert.equal(r.clips.find((c) => c.id === cap.id).start, 3);
});

test("cutRange removes the middle and keeps both sides", () => {
  let p = np2();
  const a = mkText({ text: "a", start: 0, dur: 10 });
  p = addC(p, a);
  const r = cutRange(p, a.id, 3, 5);
  assert.equal(r.clips.length, 2);
  assert.deepEqual(r.clips.map((c) => [c.start, c.dur]).sort((x, y) => x[0] - y[0]), [[0, 3], [3, 5]]);
  assert.equal(pd2(r), 8);
});

test("hit test honours rotation and draw order", () => {
  const box = { cx: 100, cy: 100, w: 100, h: 20, rot: 90 };
  assert.equal(pointInBox(box, 100, 140), true);
  assert.equal(pointInBox(box, 140, 100), false);
  const hit = hitTest([{ clip: { id: "under" }, box: { cx: 50, cy: 50, w: 100, h: 100, rot: 0 } }, { clip: { id: "top" }, box: { cx: 50, cy: 50, w: 40, h: 40, rot: 0 } }], 50, 50);
  assert.equal(hit.id, "top");
  assert.equal(hitTest([], 1, 1), null);
});

test("fadeAlpha ramps in and out", () => {
  const c = { start: 10, dur: 4, fadeIn: 1, fadeOut: 2 };
  assert.equal(fadeAlpha(c, 10), 0);
  assert.equal(fadeAlpha(c, 10.5), 0.5);
  assert.equal(fadeAlpha(c, 12), 1);
  assert.equal(fadeAlpha(c, 13), 0.5);
});

test("findSilences + removeSilentRanges shorten the project", () => {
  const sr = 1000, s = new Float32Array(sr * 6).fill(0.5);
  s.fill(0, 2 * sr, 4 * sr);
  const sil = findSilences(s, sr, { minSilence: 0.5, pad: 0.1 });
  assert.equal(sil.length, 1);
  assert.ok(sil[0][0] >= 2 && sil[0][1] <= 4 && sil[0][1] - sil[0][0] > 1.5);
  let p = np2();
  p = { ...p, media: { m1: { id: "m1", kind: "video", duration: 6 } }, clips: [{ id: "v", lane: "video", type: "video", mediaId: "m1", start: 0, dur: 6, offset: 0 }] };
  const r = removeSilentRanges(p, "v", sil);
  assert.ok(r.removed > 1.5);
  assert.ok(pd2(r.project) < 4.5);
});

test("applyOps validates and applies AI operations", () => {
  let p = np2();
  const t1 = mkText({ text: "hello", start: 0, dur: 3 });
  p = addC(p, t1);
  const r = applyOps(p, [
    { op: "add_text", text: "Title", start: 1, dur: 2, style: { color: "#ff0000", size: 999 } },
    { op: "update", target: "texts", patch: { y: 0.2, opacity: 9, evil: 1, style: { color: "javascript:1", bold: false } } },
    { op: "update", target: "nope", patch: { y: 0.1 } },
    { op: "split", target: t1.id, at: 1.5 },
    { op: "action", name: "remove_silence" },
    { op: "drop_tables" },
  ], {});
  assert.equal(r.actions[0], "remove_silence");
  assert.ok(r.applied >= 4);
  const title = r.project.clips.find((c) => c.text === "Title");
  assert.equal(title.style.color, "#ff0000");
  assert.equal(title.style.size, 25);
  assert.equal(title.opacity, 1);
  assert.equal(title.style.bold, false);
  assert.ok(r.project.clips.length >= 3);
});

test("caption presets restyle every caption", async () => {
  const { applyCaptionPreset, CAPTION_PRESETS } = await import("../src/lib/editor/model.js");
  let p = np2();
  p = addC(addC(p, mkText({ text: "a", lane: "caption", type: "caption" })), mkText({ text: "t" }));
  const r = applyCaptionPreset(p, CAPTION_PRESETS[1]);
  assert.equal(r.clips[0].style.color, "#facc15");
  assert.equal(r.clips[0].y, 0.86);
  assert.notEqual(r.clips[1].style.color, "#facc15"); // plain text untouched
});
