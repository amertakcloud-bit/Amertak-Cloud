import test from "node:test";
import assert from "node:assert/strict";
import { deps as geminiDeps, resolveGeminiKey, isValidKeyFormat } from "../lib/geminiClient.js";
import { transcribeChunk } from "../services/srt/chunk.js";
import { extractWords } from "../lib/gemini/transcribe.js";
import { buildSrt, validateCues } from "../services/srt/srtFormat.js";
import { toSrtTime } from "../services/srt/time.js";
import { buildCuesHandler, alignHandler, exportSrt, getStatus, validateKey } from "../controllers/srtController.js";
import { call, makeWav } from "./helpers.js";

const wordInfo = (text, s, e) => ({ type: "word_info", text, start_offset: `${s}s`, end_offset: `${e}s` });
const interactionsClient = (words, spy = {}) => ({
  interactions: { create: async (a) => { spy.args = a; return { steps: [{ content: [{ annotations: words.map((w) => wordInfo(...w)) }] }] }; } },
});
const speechWav = () => makeWav([{ sec: 0.5, tone: 0 }, { sec: 2, tone: 300 }, { sec: 0.5, tone: 0 }]);

test("key resolution: user key any format, server key only when logged in", () => {
  for (const k of ["AIzaSyA1234567890abcdef", "AQ.Ab8RN6Kexample-key_123", "some-other-format-key-99"]) assert.ok(isValidKeyFormat(k));
  assert.ok(!isValidKeyFormat("short"));
  assert.ok(!isValidKeyFormat("has space in it 12345"));
  const req = (headers, user) => ({ get: (k) => headers[k.toLowerCase()], user });
  assert.deepEqual(resolveGeminiKey(req({ "x-gemini-api-key": "AQ.Ab8RN6Kexample" })), { key: "AQ.Ab8RN6Kexample", source: "user" });
  const prev = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "server-key-123456789";
  assert.throws(() => resolveGeminiKey(req({})), (e) => e.code === "LOGIN_REQUIRED" && e.statusCode === 401);
  assert.equal(resolveGeminiKey(req({}, { id: 1 })).source, "server");
  delete process.env.GEMINI_API_KEY;
  assert.throws(() => resolveGeminiKey(req({}, { id: 1 })), (e) => e.code === "NO_SERVER_KEY");
  assert.throws(() => resolveGeminiKey(req({ "x-gemini-api-key": "bad key" })), (e) => e.code === "INVALID_API_KEY_FORMAT");
  if (prev) process.env.GEMINI_API_KEY = prev;
});

test("extractWords reads word_info annotations", () => {
  const r = { steps: [{ content: [{ annotations: [wordInfo("សួស្តី", 0.1, 0.45), { type: "other" }, wordInfo("បង", "0.5", "0.9")] }] }] };
  assert.deepEqual(extractWords(r), [{ text: "សួស្តី", start: 0.1, end: 0.45 }, { text: "បង", start: 0.5, end: 0.9 }]);
});

test("chunk: real word timestamps are offset into the file timeline", async () => {
  const spy = {};
  geminiDeps.createClient = async () => interactionsClient([["សួស្តី", 0.6, 1.2], ["បង", 1.3, 1.9]], spy);
  const r = await transcribeChunk({ apiKey: "AQ.fakekey123", wav: speechWav(), offset: 100 });
  assert.equal(r.mode, "word");
  assert.equal(r.silent, false);
  assert.deepEqual(r.words.map((w) => [w.text, w.start, w.end]), [["សួស្តី", 100.6, 101.2], ["បង", 101.3, 101.9]]);
  assert.equal(r.quality.inSilence, 0);
  assert.equal(spy.args.generation_config.transcription_config.mode.timestamp_granularities[0], "word");
  assert.equal(spy.args.input[0].mime_type, "audio/wav");
});

test("chunk: silent audio never reaches Gemini", async () => {
  let called = false;
  geminiDeps.createClient = async () => { called = true; return {}; };
  const r = await transcribeChunk({ apiKey: "k", wav: makeWav([{ sec: 3, tone: 0 }]), offset: 5 });
  assert.equal(r.silent, true);
  assert.deepEqual(r.words, []);
  assert.equal(called, false);
});

test("chunk: words placed inside silence are flagged; unavailable model falls back to segments", async () => {
  geminiDeps.createClient = async () => interactionsClient([["ក", 0.05, 0.2]]);
  const r = await transcribeChunk({ apiKey: "k", wav: speechWav() });
  assert.equal(r.quality.inSilence, 1);

  const err = Object.assign(new Error("models/gemini-3.5-transcribe is not found"), { status: 404 });
  geminiDeps.createClient = async () => ({
    interactions: { create: async () => { throw err; } },
    models: { generateContent: async () => ({ text: '[{"start":"00:00.600","end":"00:02.000","text":"សួស្តីបង"}]' }) },
  });
  const f = await transcribeChunk({ apiKey: "k", wav: speechWav(), offset: 10 });
  assert.equal(f.mode, "segment");
  assert.equal(f.segments[0].text, "សួស្តីបង");
  assert.equal(f.segments[0].start, 10.6);
  assert.ok(f.warnings.some((w) => /not available/.test(w)));
});

test("chunk: too long is rejected", async () => {
  await assert.rejects(transcribeChunk({ apiKey: "k", wav: makeWav([{ sec: 140, tone: 200 }]) }), (e) => e.code === "CHUNK_TOO_LONG");
  await assert.rejects(transcribeChunk({ apiKey: "k", wav: Buffer.from("not a wav file at all, really") }), (e) => e.statusCode >= 400);
});

test("cues → align → export pipeline over real controller handlers", async () => {
  const words = [["សួស្តី", 0.5, 1.0], ["បង", 1.1, 1.5], ["។", 1.5, 1.6], ["ខ្ញុំ", 3.0, 3.4], ["ឈ្មោះ", 3.5, 4.0], ["សុខា", 4.1, 4.8], ["។", 4.8, 4.9]].map(([text, start, end]) => ({ text, start, end }));
  const c = await call(buildCuesHandler, { body: { words, duration: 6 } });
  assert.equal(c.err, undefined);
  const { cues, timeline, timing } = c.res.body.data;
  assert.equal(timing, "word-level");
  assert.equal(cues.length, 2);
  assert.ok(cues[0].end <= cues[1].start);
  assert.ok(Math.abs(cues[0].start - 0.5) < 1e-6 && Math.abs(cues[1].end - 4.9) < 1e-6);

  // Edit text, then re-align against the recognized timeline.
  const edited = [{ text: "សួស្តី បង។" }, { text: "ខ្ញុំ ឈ្មោះ សុខា។" }];
  const a = await call(alignHandler, { body: { cues: edited, words: timeline } });
  assert.equal(a.err, undefined);
  assert.equal(a.res.body.data.cues.length, 2);
  assert.ok(a.res.body.data.cues[1].start >= 2.9, "second cue is placed at its real position");

  const ex = await call(exportSrt, { body: { cues: a.res.body.data.cues.map(({ start, end, text }) => ({ start, end, text })), bom: true, filename: "វីដេអូ.srt" } });
  assert.equal(ex.err, undefined);
  assert.ok(ex.res.body.startsWith("﻿1\n00:00:00,"));
  assert.match(ex.res.body, /\n\n2\n00:00:0[23],\d{3} --> 00:00:0[45],\d{3}\n/);
  assert.match(ex.res.headers["content-type"], /utf-8/);
  assert.match(ex.res.headers["content-disposition"], /filename\*=UTF-8''%E1%9E/);
});

test("cues controller: segment fallback, empty, bad input", async () => {
  const seg = await call(buildCuesHandler, { body: { segments: [{ text: "សួស្តី", start: 1, end: 3 }] } });
  assert.equal(seg.res.body.data.timing, "segment-level");
  assert.ok(seg.res.body.data.warnings.length);
  assert.equal((await call(buildCuesHandler, { body: {} })).err.code, "EMPTY_TRANSCRIPT");
  assert.equal((await call(buildCuesHandler, { body: { words: "x" } })).err.code, "INVALID_BODY");
  assert.equal((await call(alignHandler, { body: { cues: [] } })).err.code, "INVALID_CUES");
  assert.equal((await call(alignHandler, { body: { cues: [{ text: "a" }], words: [] } })).err.code, "NO_TIMELINE");
  assert.equal((await call(validateKey, { headers: {} })).err.code, "NO_API_KEY");
  assert.equal((await call(validateKey, { headers: { "x-gemini-api-key": "x y" } })).err.code, "INVALID_API_KEY_FORMAT");
  const st = await call(getStatus, {});
  assert.equal(st.res.body.data.serverKeyNeedsLogin, true);
});

test("SRT format", () => {
  assert.equal(toSrtTime(3661.0075), "01:01:01,008");
  assert.throws(() => validateCues([{ start: 2, end: 1, text: "x" }]));
  assert.throws(() => validateCues([]));
  const srt = buildSrt([{ start: 0, end: 1, text: "ក" }, { start: 1.2, end: 2, text: "ខ\nគ" }]);
  assert.equal(srt, "1\n00:00:00,000 --> 00:00:01,000\nក\n\n2\n00:00:01,200 --> 00:00:02,000\nខ\nគ\n");
});
