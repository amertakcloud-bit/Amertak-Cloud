import test from "node:test";
import assert from "node:assert/strict";
import { planChunks } from "../src/lib/audio/chunker.js";
import { encodeWav } from "../src/lib/audio/wav.js";
import { cueIssues, fixOverlaps, fmt, mergeWithNext, parseClock, shiftAll, splitCue, withIds, toPayload } from "../src/lib/srtEdit.js";
import { friendlyError } from "../src/lib/errors.js";
import { formatClock, baseName } from "../src/lib/download.js";

const RATE = 16000;
// speech-like tone with silent gaps at given second marks
function signal(totalSec, gaps) {
  const a = new Float32Array(totalSec * RATE);
  for (let i = 0; i < a.length; i++) a[i] = Math.sin(i / 20) * 0.5;
  for (const g of gaps) a.fill(0, Math.floor(g * RATE), Math.floor((g + 0.4) * RATE));
  return a;
}

test("chunker: short audio is one chunk", () => {
  assert.deepEqual(planChunks(signal(60, []), RATE), [{ start: 0, end: 60 * RATE }]);
  assert.deepEqual(planChunks(new Float32Array(0), RATE), []);
});

test("chunker: long audio is contiguous, ≤100 s, and cuts inside silence", () => {
  const gaps = [88, 175, 262];
  const s = signal(300, gaps);
  const plan = planChunks(s, RATE);
  assert.equal(plan[0].start, 0);
  assert.equal(plan.at(-1).end, s.length);
  for (let i = 0; i < plan.length; i++) {
    assert.ok((plan[i].end - plan[i].start) / RATE <= 100.001, `chunk ${i} too long`);
    if (i) assert.equal(plan[i].start, plan[i - 1].end);
  }
  // every internal cut lands in one of the silent gaps (never inside a word)
  for (const c of plan.slice(0, -1)) {
    const sec = c.end / RATE;
    assert.ok(gaps.some((g) => sec >= g - 0.05 && sec <= g + 0.45), `cut at ${sec}s not in silence`);
  }
});

test("chunker: continuous speech still splits under the limit", () => {
  const plan = planChunks(signal(500, []), RATE);
  assert.ok(plan.length >= 5);
  assert.ok(plan.every((c) => (c.end - c.start) / RATE <= 100.001));
});

test("wav encoder header + data", async () => {
  const blob = encodeWav([new Float32Array([0, 1, -1, 0.5])], 16000);
  const buf = Buffer.from(await blob.arrayBuffer());
  assert.equal(buf.slice(0, 4).toString(), "RIFF");
  assert.equal(buf.readUInt32LE(24), 16000);
  assert.equal(buf.readUInt16LE(22), 1);
  assert.equal(buf.readUInt32LE(40), 8);
  assert.equal(buf.readInt16LE(46), 32767);
  assert.equal(buf.readInt16LE(48), -32768);
  const st = Buffer.from(await encodeWav([new Float32Array(3), new Float32Array(3)], 44100).arrayBuffer());
  assert.equal(st.readUInt16LE(22), 2);
  assert.equal(st.readUInt32LE(40), 12);
});

test("srt edit helpers", () => {
  assert.equal(fmt(3661.5), "01:01:01,500");
  assert.equal(parseClock("00:01:02,500"), 62.5);
  assert.equal(parseClock("1:02.5"), 62.5);
  assert.equal(parseClock("62.5"), 62.5);
  assert.equal(parseClock("abc"), null);
  const cues = withIds([{ start: 0, end: 2, text: "សួស្តីបងប្អូន" }, { start: 1.5, end: 3, text: "ជម្រាបសួរ" }, { start: 3, end: 3.05, text: "" }]);
  assert.deepEqual(cueIssues(cues), [["overlap"], [], ["empty", "short"]]);
  const fixed = fixOverlaps(cues);
  assert.equal(fixed[0].end, 1.5);
  const sp = splitCue(cues, cues[0].id);
  assert.equal(sp.length, 4);
  assert.ok(Math.abs(sp[0].end - sp[1].start) < 1e-9 && sp[0].start === 0 && sp[1].end === 2);
  assert.equal(splitCue(cues, cues[2].id).length, 3, "empty text cannot be split");
  const mg = mergeWithNext(cues, cues[0].id);
  assert.equal(mg.length, 2);
  assert.equal(mg[0].end, 3);
  assert.equal(shiftAll([{ start: 0.2, end: 1, text: "a" }], -0.5)[0].start, 0);
  assert.deepEqual(Object.keys(toPayload(cues)[0]), ["start", "end", "text"]);
});

test("friendlyError prefers translated code, falls back to server message", () => {
  const t = (k) => ({ err_NETWORK: "net!", err_UNKNOWN: "unk" }[k] ?? k);
  assert.equal(friendlyError({ code: "NETWORK", message: "x" }, t), "net!");
  assert.equal(friendlyError({ code: "WEIRD", message: "server says" }, t), "server says");
  assert.equal(friendlyError({}, t), "unk");
});

test("download helpers", () => {
  assert.equal(formatClock(3725), "1:02:05");
  assert.equal(formatClock(65), "1:05");
  assert.equal(baseName("សំឡេង.final.mp3"), "សំឡេង.final");
});
