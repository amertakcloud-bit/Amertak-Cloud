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
