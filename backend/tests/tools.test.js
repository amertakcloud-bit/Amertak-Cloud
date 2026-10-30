import test from "node:test";
import assert from "node:assert/strict";
import { buildPayload, normalizeUrl } from "../services/qr/payload.js";
import { generateQr, sanitizeQrOptions, deps as qrDeps } from "../services/qr/index.js";
import { signMediaToken, verifyMediaToken } from "../services/video/sign.js";
import { isPrivateIp, assertPublicUrl, deps as dnsDeps } from "../services/video/ssrf.js";
import { detectProvider } from "../services/video/providers.js";
import { resolveVideo, deps as videoDeps } from "../services/video/index.js";
import { imageToPrompt, sniffMime } from "../services/imagePrompt/index.js";
import { deps as geminiDeps } from "../lib/geminiClient.js";
import { synthesizeSpeech, deps as ttsDeps, ratePct, secMsGec } from "../lib/edgeTts.js";
import { convertToAudio, deps as ffDeps } from "../services/audio/convert.js";
import { createQr, createImagePrompt, resolveVideoLink, downloadVideo, getTools, convertAudio } from "../controllers/toolsController.js";
import { synthesizeText } from "../controllers/ttsController.js";
import { errorHandler } from "../middleware/errorMiddleware.js";
import { AppError } from "../lib/AppError.js";
import { call, makeWav, fakeRes } from "./helpers.js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const rejectsCode = async (p, code) => assert.rejects(p, (e) => e.code === code, `expected ${code}`);

test("QR payloads", () => {
  assert.equal(buildPayload("wifi", { ssid: "My;Net", password: "p:w", encryption: "WPA" }), "WIFI:T:WPA;S:My\\;Net;P:p\\:w;H:false;;");
  assert.equal(buildPayload("wifi", { ssid: "Open", encryption: "nopass" }), "WIFI:T:nopass;S:Open;P:;H:false;;");
  assert.equal(buildPayload("email", { to: "a@b.co", subject: "Hi there" }), "mailto:a@b.co?subject=Hi%20there");
  assert.equal(buildPayload("phone", { phone: "+855 12 345 678" }), "tel:+85512345678");
  assert.match(buildPayload("vcard", { name: "Sok", phone: "012345678" }), /^BEGIN:VCARD\nVERSION:3.0\nFN:Sok/);
  assert.equal(buildPayload("text", { text: "សួស្តី" }), "សួស្តី");
  assert.equal(normalizeUrl("example.com/a"), "https://example.com/a");
  assert.throws(() => normalizeUrl("javascript:alert(1)"), (e) => e.code === "INVALID_QR_DATA");
  assert.throws(() => buildPayload("email", { to: "bad" }), (e) => e.code === "INVALID_QR_DATA");
  assert.throws(() => buildPayload("nope", {}), (e) => e.code === "INVALID_QR_TYPE");
  assert.throws(() => buildPayload("wifi", { ssid: "x", encryption: "WPA" }), (e) => e.code === "INVALID_QR_DATA");
});

test("QR options + generation with injected lib", async () => {
  assert.throws(() => sanitizeQrOptions({ dark: "#eeeeee", light: "#ffffff" }), (e) => e.code === "LOW_CONTRAST");
  assert.throws(() => sanitizeQrOptions({ dark: "#ffffff", light: "#000000" }), (e) => e.code === "LOW_CONTRAST");
  assert.equal(sanitizeQrOptions({ size: 99999 }).size, 2048);
  assert.equal(sanitizeQrOptions({ ecc: "Z" }).ecc, "M");
  let seen;
  qrDeps.loadQr = async () => ({ toBuffer: async (t, o) => { seen = { t, o }; return Buffer.from("PNG"); }, toString: async () => "<svg/>" });
  const png = await generateQr("url", { url: "example.com" }, { size: 300, ecc: "H" });
  assert.equal(png.contentType, "image/png");
  assert.equal(seen.t, "https://example.com/");
  assert.equal(seen.o.errorCorrectionLevel, "H");
  const svg = await generateQr("text", { text: "x" }, { format: "svg" });
  assert.equal(svg.ext, "svg");
  qrDeps.loadQr = async () => ({ toBuffer: async () => { throw new Error("The amount of data is too big"); } });
  await rejectsCode(generateQr("text", { text: "x" }, {}), "QR_TOO_LARGE");
  const { res } = await call(createQr, { body: { type: "bogus" } }).then((r) => ({ res: r.err }));
  assert.equal(res.code, "INVALID_QR_TYPE");
});

test("signed media tokens", () => {
  const t = signMediaToken({ url: "https://a.b/c.mp4", name: "x.mp4" }, 60, 1_000_000);
  assert.deepEqual(verifyMediaToken(t, 1_000_000 + 30_000), { url: "https://a.b/c.mp4", name: "x.mp4" });
  assert.throws(() => verifyMediaToken(t, 1_000_000 + 61_000), (e) => e.code === "TOKEN_EXPIRED");
  const [p, s] = t.split(".");
  assert.throws(() => verifyMediaToken(`${p}.${s.slice(0, -2)}AA`), (e) => e.code === "INVALID_TOKEN");
  const forged = Buffer.from(JSON.stringify({ u: "http://127.0.0.1/", n: "x", e: 9e12 })).toString("base64url");
  assert.throws(() => verifyMediaToken(`${forged}.${s}`), (e) => e.code === "INVALID_TOKEN");
  assert.throws(() => verifyMediaToken("garbage"), (e) => e.code === "INVALID_TOKEN");
});

test("SSRF guard", async () => {
  for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "100.64.0.1"]) assert.ok(isPrivateIp(ip), ip);
  for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) assert.ok(!isPrivateIp(ip), ip);
  dnsDeps.lookup = async (h) => (h === "evil.test" ? [{ address: "10.1.1.1" }] : h === "mixed.test" ? [{ address: "8.8.8.8" }, { address: "127.0.0.1" }] : [{ address: "93.184.216.34" }]);
  await rejectsCode(assertPublicUrl("http://localhost/x"), "BLOCKED_URL");
  await rejectsCode(assertPublicUrl("http://evil.test/x"), "BLOCKED_URL");
  await rejectsCode(assertPublicUrl("http://mixed.test/x"), "BLOCKED_URL");
  await rejectsCode(assertPublicUrl("http://127.0.0.1/x"), "BLOCKED_URL");
  await rejectsCode(assertPublicUrl("http://[::1]/x"), "BLOCKED_URL");
  await rejectsCode(assertPublicUrl("file:///etc/passwd"), "INVALID_URL");
  await rejectsCode(assertPublicUrl("http://u:p@good.test/"), "INVALID_URL");
  await rejectsCode(assertPublicUrl("http://good.test:8080/"), "INVALID_URL");
  assert.equal((await assertPublicUrl("https://good.test/a")).hostname, "good.test");
});

test("video: provider detection, resolve, download token", async () => {
  assert.equal(detectProvider("https://www.tiktok.com/@a/video/1"), "tiktok");
  assert.equal(detectProvider("https://vm.tiktok.com/abc"), "tiktok");
  assert.equal(detectProvider("https://pin.it/abc"), "pinterest");
  assert.equal(detectProvider("https://www.pinterest.com/pin/1/"), "pinterest");
  assert.equal(detectProvider("https://youtu.be/x"), "unsupported");
  assert.equal(detectProvider("https://cdn.example.com/a.mp4"), "direct");
  dnsDeps.lookup = async () => [{ address: "93.184.216.34" }];
  videoDeps.fetchTikTok = async () => ({ provider: "tiktok", title: "Hello/World?", author: "me", duration: 5, thumbnail: null, formats: [{ id: "video-HD", label: "HD", kind: "video", ext: "mp4", url: "https://cdn.test/v.mp4" }] });
  const r = await resolveVideo("tiktok.com/@a/video/1");
  assert.equal(r.formats.length, 1);
  assert.equal(r.formats[0].url, undefined, "raw URL must not leak");
  assert.equal(verifyMediaToken(r.formats[0].token).name, "Hello World.mp4");
  await rejectsCode(resolveVideo("https://youtube.com/watch?v=1"), "UNSUPPORTED_SITE");
  await rejectsCode(resolveVideo(""), "INVALID_URL");
  await rejectsCode(resolveVideo("http://127.0.0.1/a.mp4"), "BLOCKED_URL");
  const bad = await call(downloadVideo, { query: { token: "x.y" } });
  assert.equal(bad.err.code, "INVALID_TOKEN");
  const ok = await call(resolveVideoLink, { body: { url: "https://www.tiktok.com/@a/video/1" } });
  assert.equal(ok.res.body.success, true);
});

test("image → prompt", async () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
  assert.equal(sniffMime(png), "image/png");
  assert.equal(sniffMime(Buffer.from("GIF89a....")), null);
  let sent;
  geminiDeps.createClient = async () => ({ models: { generateContent: async (a) => { sent = a; return { text: '{"prompt":"A red fox","negativePrompt":"blur","tags":["fox"],"title":"Fox"}' }; } } });
  const r = await imageToPrompt({ apiKey: "AQ.fake-key-123", image: png, style: "midjourney", language: "km" });
  assert.equal(r.prompt, "A red fox");
  assert.match(sent.contents[0].parts[1].text, /Khmer/);
  assert.equal(sent.contents[0].parts[0].inlineData.mimeType, "image/png");
  await rejectsCode(imageToPrompt({ apiKey: "k", image: Buffer.from("not an image at all") }), "UNSUPPORTED_IMAGE");
  await rejectsCode(imageToPrompt({ apiKey: "k", image: png, style: "zzz" }), "INVALID_STYLE");
  geminiDeps.createClient = async () => ({ models: { generateContent: async () => ({ text: '{"prompt":""}' }) } });
  await rejectsCode(imageToPrompt({ apiKey: "k", image: png }), "EMPTY_RESULT");
  const noFile = await call(createImagePrompt, { gemini: { key: "k", source: "user" }, body: {} });
  assert.equal(noFile.err.code, "NO_FILE");
});

test("TTS", async () => {
  assert.equal(ratePct(500), "+100%");
  assert.equal(ratePct(-80), "-50%");
  let opts;
  ttsDeps.synthesize = async (o) => { opts = o; return Buffer.from("ID3audio"); };
  const r = await synthesizeSpeech("សួស្តី", { voice: "sreymom", rate: 20 });
  assert.equal(r.voice, "km-KH-SreymomNeural");
  assert.equal(opts.rate, "+20%");
  assert.equal(opts.voice, "km-KH-SreymomNeural");
  assert.match(secMsGec(), /^[0-9A-F]{64}$/);
  assert.equal(secMsGec(1700000000000), secMsGec(1700000060000)); // same 5-minute window
  assert.equal(r.audio.toString(), "ID3audio");
  await rejectsCode(synthesizeSpeech("hi", { voice: "bogus" }), "INVALID_VOICE");
  await rejectsCode(synthesizeSpeech("   "), "EMPTY_TEXT");
  ttsDeps.synthesize = async () => { throw new Error("ECONNRESET"); };
  await rejectsCode(synthesizeSpeech("hi"), "TTS_UNAVAILABLE");
  const long = await call(synthesizeText, { body: { text: "x".repeat(3001) } });
  assert.equal(long.err.code, "TEXT_TOO_LONG");
});

test("audio conversion (real ffmpeg)", async (t) => {
  let ff;
  try { ff = execFileSync("which", ["ffmpeg"]).toString().trim(); } catch { return t.skip("no ffmpeg"); }
  ffDeps.ffmpegPath = async () => ff;
  const wav = makeWav([{ sec: 1, tone: 440 }]);
  const mp3 = await convertToAudio(wav, { format: "mp3", bitrate: 128 });
  assert.equal(mp3.type, "audio/mpeg");
  assert.ok(mp3.audio.length > 1000);
  const m4a = await convertToAudio(wav, { format: "m4a" });
  assert.equal(m4a.audio.slice(4, 8).toString(), "ftyp");
  const ogg = await convertToAudio(wav, { format: "ogg" });
  assert.equal(ogg.audio.slice(0, 4).toString(), "OggS");
  const out = await convertToAudio(wav, { format: "wav", startSec: 0.5 });
  assert.ok(out.audio.length < wav.length);
  await rejectsCode(convertToAudio(Buffer.from("hello world, not media"), { format: "mp3" }), "UNSUPPORTED_MEDIA");
  await rejectsCode(convertToAudio(wav, { format: "exe" }), "INVALID_FORMAT");
  const trunc = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(30)]);
  await rejectsCode(convertToAudio(trunc, { format: "mp3" }), "CONVERT_FAILED");
  const r = await call(convertAudio, { file: { buffer: wav }, body: { format: "mp3", name: "សំឡេង.mp4" } });
  assert.match(r.res.headers["content-disposition"], /filename\*=UTF-8''%E1%9E/);
});

test("tools status + error handler shape", async () => {
  const { res } = await call(getTools, {});
  assert.equal(res.body.data.tools.qr.available, true);
  assert.deepEqual(res.body.data.tools.audio.formats, ["mp3", "m4a", "ogg", "wav"]);
  const r = fakeRes();
  errorHandler(new AppError(422, "X_CODE", "Bad thing"), {}, r, () => {});
  assert.equal(r.statusCode, 422);
  assert.deepEqual({ ...r.body }, { success: false, message: "Bad thing", code: "X_CODE" });
  const r2 = fakeRes();
  errorHandler(new Error("boom AIzaSyA1234567890abcdefghijklmnopqrstuv"), {}, r2, () => {});
  assert.equal(r2.statusCode, 500);
  assert.ok(!JSON.stringify(r2.body).includes("AIzaSy"));
});

// ── QR image storage ──
import { sniffImage, saveQrImage, readQrImage, listQrImages, deleteQrImage, __setQrImageModel } from "../services/qrImageService.js";
test("qr image: sniff, save, read, list, delete (fake model)", async () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  assert.equal(sniffImage(png), "image/png");
  assert.equal(sniffImage(Buffer.from("<svg xmlns='x'><script>1</script></svg>")), null);
  const rows = [];
  __setQrImageModel({
    countDocuments: async (q) => rows.filter((r) => r.owner === q.owner).length,
    create: async (d) => rows.push({ ...d }),
    findOneAndUpdate: () => ({ select: async () => rows[0] ? { mimeType: rows[0].mimeType, data: rows[0].data } : null }),
    find: (q) => ({ sort: () => ({ limit: () => ({ select: () => ({ lean: async () => rows.filter((r) => r.owner === q.owner) }) }) }) }),
    deleteOne: async (q) => { const i = rows.findIndex((r) => r.imageId === q.imageId && r.owner === q.owner); if (i >= 0) rows.splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 }; },
  });
  await assert.rejects(saveQrImage({ owner: "u1", name: "x.svg", buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>") }), { code: "BAD_IMAGE" });
  const s = await saveQrImage({ owner: "u1", name: "a/b.png", buffer: png });
  assert.match(s.imageId, /^[A-Za-z0-9_-]{6,}$/);
  assert.equal((await readQrImage(s.imageId)).mimeType, "image/png");
  assert.equal(await readQrImage("../etc"), null);
  assert.equal((await listQrImages("u1")).length, 1);
  assert.equal(await deleteQrImage("u2", s.imageId), false); // not the owner
  assert.equal(await deleteQrImage("u1", s.imageId), true);
  __setQrImageModel(null);
});

test("TTS falls back: Edge fails (both versions) → Google voice; all fail → clear error + diagnose", async () => {
  const calls = [];
  ttsDeps.synthesize = (await import("../lib/edgeTts.js")).defaultSynthesize; // restore orchestrator
  ttsDeps.synthesizeEdge = async ({ chrome }) => { calls.push(chrome); throw new Error("HTTP 403"); };
  ttsDeps.synthesizeGoogle = async () => Buffer.from("ID3google");
  const off = await synthesizeSpeech("សួស្តី").catch((e) => e); // fallback is OFF by default → never a wrong voice
  assert.equal(off.code, "TTS_UNAVAILABLE");
  process.env.TTS_ALLOW_FALLBACK = "true";
  const r = await synthesizeSpeech("សួស្តី", { voice: "piseth" });
  assert.equal(r.provider, "google");
  assert.equal(r.audio.toString(), "ID3google");
  assert.equal(calls.length, 9);
  ttsDeps.synthesizeGoogle = async () => { throw new Error("google HTTP 429"); };
  const err = await synthesizeSpeech("hi").catch((e) => e);
  assert.equal(err.code, "TTS_UNAVAILABLE");
  assert.match(String(err.details), /HTTP 403.*google HTTP 429/);
  const { diagnose } = await import("../lib/edgeTts.js");
  const d = await diagnose();
  assert.equal(d.length, 4); assert.ok(d.every((x) => x.ok === false && x.error));
});

test("TTS uses Azure Speech first when configured (same Piseth/Sreymom voices)", async () => {
  ttsDeps.synthesize = (await import("../lib/edgeTts.js")).defaultSynthesize;
  process.env.AZURE_SPEECH_KEY = "k"; process.env.AZURE_SPEECH_REGION = "southeastasia";
  let seen; ttsDeps.synthesizeAzure = async (o) => { seen = o; return Buffer.from("ID3azure"); };
  ttsDeps.synthesizeEdge = async () => { throw new Error("must not be called"); };
  const r = await synthesizeSpeech("សួស្តី", { voice: "sreymom" });
  assert.equal(r.provider, "azure"); assert.equal(seen.voice, "km-KH-SreymomNeural");
  delete process.env.AZURE_SPEECH_KEY; delete process.env.AZURE_SPEECH_REGION; delete process.env.TTS_ALLOW_FALLBACK;
});

test("Gemini TTS: Interactions request shape, voice/style mapping, long text, MP3 conversion", async () => {
  const { synthesizeGemini, normalizeGeminiVoice, splitText, GEMINI_VOICES } = await import("../lib/geminiTts.js");
  const wav = makeWav([{ sec: 1, tone: 300 }]);
  const calls = [];
  geminiDeps.createClient = async () => ({ interactions: { create: async (a) => { calls.push(a); return { output_audio: { data: wav.toString("base64") } }; } } });
  try { ffDeps.ffmpegPath = async () => execFileSync("which", ["ffmpeg"]).toString().trim(); } catch { /* no ffmpeg → WAV fallback */ }

  const r = await synthesizeGemini({ apiKey: "k", text: "សួស្តី​បង", voice: "Kore", style: "calm" });
  assert.equal(calls[0].model, "gemini-3.8-flash-tts");
  assert.deepEqual(calls[0].response_format, { type: "audio" });
  assert.deepEqual(calls[0].generation_config, { speech_config: [{ voice: "Kore" }] });
  assert.equal(calls[0].input[0].content[0].annotations[0].style, "calm and slow");
  assert.ok(["audio/mpeg", "audio/wav"].includes(r.contentType) && r.audio.length > 500);
  // natural style → no annotation; legacy Edge names map to Gemini voices
  await synthesizeGemini({ apiKey: "k", text: "hi", voice: "km-KH-SreymomNeural" });
  assert.equal(calls[1].generation_config.speech_config[0].voice, "Kore");
  assert.equal(calls[1].input[0].content[0].annotations, undefined);
  assert.equal(normalizeGeminiVoice("km-KH-PisethNeural"), "Puck");
  assert.throws(() => normalizeGeminiVoice("Nope"), (e) => e.code === "INVALID_VOICE");
  assert.ok(GEMINI_VOICES.some((v) => v.gender === "Male") && GEMINI_VOICES.some((v) => v.gender === "Female"));
  // long text → several calls, one result
  calls.length = 0;
  const long = ("ប្រយោគមួយ។ ").repeat(300);
  const pieces = splitText(long);
  assert.ok(pieces.length > 1 && pieces.every((p) => p.length <= 900));
  const l = await synthesizeGemini({ apiKey: "k", text: long, voice: "Puck" });
  assert.equal(calls.length, pieces.length);
  assert.ok(l.audio.length > r.audio.length);
  // empty audio from the model → clear error
  geminiDeps.createClient = async () => ({ interactions: { create: async () => ({}) } });
  await rejectsCode(synthesizeGemini({ apiKey: "k", text: "x" }), "TTS_EMPTY");
  // a request that never answers → TTS_TIMEOUT instead of hanging
  process.env.TTS_TIMEOUT_MS = "60";
  geminiDeps.createClient = async () => ({ interactions: { create: () => new Promise(() => {}) } });
  await rejectsCode(synthesizeGemini({ apiKey: "k", text: "x" }), "TTS_TIMEOUT");
  delete process.env.TTS_TIMEOUT_MS;
});

test("TTS access: free tool works for guests with the site key (short text); paid job needs login + job", async () => {
  const { ttsAccess } = await import("../middleware/geminiKey.js");
  const run = (mw, req) => new Promise((res) => mw(Object.assign(req, { get: (k) => req.headers?.[k.toLowerCase()], headers: req.headers || {}, body: req.body || {} }), {}, (e) => res(e || null)));
  process.env.GEMINI_API_KEY = "server-key-server-key-server-key-1234";
  // guest, no own key → allowed with the site key
  const g = { headers: {}, body: { text: "សួស្តី" } };
  assert.equal(await run(ttsAccess, g), null);
  assert.equal(g.gemini?.source, "server");
  // guests get a shorter limit than logged-in users
  assert.equal((await run(ttsAccess, { headers: {}, body: { text: "x".repeat(1300) } }))?.code, "TEXT_TOO_LONG");
  assert.equal(await run(ttsAccess, { headers: {}, user: { _id: "u1" }, body: { text: "x".repeat(1300) } }), null);
  // own key in the header wins over the site key
  const req = { headers: { "x-gemini-api-key": "AIzaSyA1234567890abcdefghijklmnopqrstuv" }, body: { text: "a" } };
  assert.equal(await run(ttsAccess, req), null);
  assert.equal(req.gemini?.source, "user");
  // no key anywhere → clear message for the admin
  delete process.env.GEMINI_API_KEY;
  assert.equal((await run(ttsAccess, { headers: {}, body: { text: "a" } }))?.code, "NO_SERVER_KEY");
  // paid editor path: needs login and a valid job
  assert.equal((await run(ttsAccess, { headers: { "x-job": "bad" } }))?.code, "LOGIN_REQUIRED");
  assert.equal((await run(ttsAccess, { headers: { "x-job": "bad" }, user: { _id: "u1" } }))?.code, "JOB_REQUIRED");
});
