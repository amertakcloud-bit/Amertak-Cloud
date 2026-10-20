import test from "node:test";
import assert from "node:assert/strict";
import { __setCloudModel, createCloudShareRecord, findCloudShareRecord, getCloudShareConfig } from "../services/cloudShareService.js";

test("cloudshare stores and reads a file via injected model", async () => {
  const store = [];
  const mk = (d) => ({ ...d, toObject() { return { ...d }; } });
  __setCloudModel({
    db: { readyState: 1 },
    create: async (d) => { const x = mk(d); store.push(x); return x; },
    findOne: (q) => ({ select() { return this; }, then(r) { r(store.find((x) => x.shareId === q.shareId) || null); } }),
  });
  const rec = await createCloudShareRecord({ originalName: "a/b.txt", mimeType: "text/plain", buffer: Buffer.from("hi"), expiresIn: "1h" });
  assert.equal(rec.originalName, "a_b.txt");
  assert.ok(rec.expiresAt);
  const f = await findCloudShareRecord(rec.shareId, { withData: true });
  assert.equal(f.size, 2);
  await assert.rejects(() => createCloudShareRecord({ originalName: "x", buffer: Buffer.from("a"), expiresIn: "bad" }), /expiration/i);
  assert.equal(typeof getCloudShareConfig().maxFileSizeMB, "number");
});

import { deps as edDeps, createProject, listProjects, getProject, updateProject, deleteProject } from "../services/editorProjects.js";
import { translateToKhmer } from "../controllers/editorController.js";
import { deps as geminiDeps } from "../lib/geminiClient.js";
import { joinWords } from "../services/srt/khmer.js";

test("editor projects: CRUD is scoped to the owner", async () => {
  const rows = [];
  let n = 0;
  const M = {
    countDocuments: async (q) => rows.filter((r) => r.owner === q.owner).length,
    create: async (d) => { const r = { _id: String(++n), createdAt: "t", updatedAt: "t", data: {}, ...d }; rows.push(r); return r; },
    find: (q) => ({ select() { return this; }, sort() { return this; }, limit: async () => rows.filter((r) => r.owner === q.owner) }),
    findOne: async (q) => rows.find((r) => r._id === q._id && r.owner === q.owner) || null,
    findOneAndUpdate: async (q, u) => { const r = rows.find((x) => x._id === q._id && x.owner === q.owner); Object.assign(r, u.$set); return r; },
    deleteOne: async (q) => { const i = rows.findIndex((x) => x._id === q._id && x.owner === q.owner); if (i >= 0) rows.splice(i, 1); },
  };
  edDeps.getModel = async () => M;
  const p = await createProject("u1", { name: " My video ", data: { clips: [] }, width: 1280, height: 720 });
  assert.equal(p.name, "My video");
  assert.equal((await listProjects("u1")).length, 1);
  assert.equal((await listProjects("u2")).length, 0);
  await assert.rejects(() => getProject("u2", p.id), (e) => e.code === "PROJECT_NOT_FOUND");
  await updateProject("u1", p.id, { name: "Renamed", duration: 12.5 });
  assert.equal((await getProject("u1", p.id)).name, "Renamed");
  await assert.rejects(() => createProject("u1", { name: "" }), (e) => e.code === "INVALID_NAME");
  await assert.rejects(() => createProject("u1", { name: "big", data: { x: "a".repeat(2 * 1024 * 1024) } }), (e) => e.code === "PROJECT_TOO_LARGE");
  await deleteProject("u1", p.id);
  assert.equal((await listProjects("u1")).length, 0);
  edDeps.getModel = null;
});

test("translateToKhmer returns one line per input and validates the shape", async () => {
  geminiDeps.createClient = async () => ({ models: { generateContent: async ({ contents }) => ({ text: JSON.stringify(JSON.parse(contents[0].parts[0].text.split("\n\n").pop()).map((l) => "ខ្មែរ:" + l)) }) } });
  const out = await translateToKhmer({ apiKey: "k".repeat(10), lines: ["你好", "Hello"], from: "auto" });
  assert.deepEqual(out, ["ខ្មែរ:你好", "ខ្មែរ:Hello"]);
  geminiDeps.createClient = async () => ({ models: { generateContent: async () => ({ text: '["only one"]' }) } });
  await assert.rejects(() => translateToKhmer({ apiKey: "k".repeat(10), lines: ["a", "b"] }), (e) => e.code === "BAD_TRANSLATION");
});

test("Chinese words are joined without spaces, English with spaces", () => {
  assert.equal(joinWords(["你", "好", "世界"]), "你好世界");
  assert.equal(joinWords(["Hello", "world"]), "Hello world");
});
