import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeOps, planEdits, summarizeProject, MAX_OPS } from "../services/editorAi.js";
import { deps as geminiDeps } from "../lib/geminiClient.js";

test("sanitizeOps keeps only whitelisted, clamped operations", () => {
  const ops = sanitizeOps([
    { op: "add_text", text: "  Hello  ", start: -5, dur: 9999, x: 3, style: { color: "red", size: 99, bold: true, font: "comic", align: "center" } },
    { op: "update", target: "captions", patch: { y: 0.8, opacity: 5, style: { color: "#ff0000", bg: "rgba(0,0,0,0.5)" }, evil: "x" } },
    { op: "update", target: "bad id!", patch: { x: 1 } },
    { op: "update", target: "selected", patch: {} },
    { op: "delete", target: "c1" },
    { op: "split", target: "c1", at: "3.5" },
    { op: "trim", target: "c1" },
    { op: "action", name: "remove_silence" },
    { op: "action", name: "rm -rf" },
    { op: "format_disk" },
    "junk",
  ]);
  assert.deepEqual(ops[0], { op: "add_text", text: "Hello", start: 0, dur: 600, x: 1, y: 0.5, style: { size: 25, bold: true, align: "center" } });
  assert.deepEqual(ops[1], { op: "update", target: "captions", patch: { y: 0.8, opacity: 1, style: { color: "#ff0000", bg: "rgba(0,0,0,0.5)" } } });
  assert.deepEqual(ops.slice(2), [{ op: "delete", target: "c1" }, { op: "split", target: "c1", at: 3.5 }, { op: "action", name: "remove_silence" }]);
  assert.equal(sanitizeOps(Array.from({ length: 80 }, () => ({ op: "delete", target: "a" }))).length, MAX_OPS);
  assert.deepEqual(sanitizeOps("nope"), []);
});

test("planEdits sends a compact project and returns validated ops", async () => {
  let prompt = "";
  geminiDeps.createClient = async () => ({ models: { generateContent: async ({ contents }) => { prompt = contents[0].parts[0].text; return { text: '{"message":"Done","ops":[{"op":"update","target":"selected","patch":{"scale":1.5}},{"op":"zzz"}]}' }; } } });
  const r = await planEdits({ apiKey: "k".repeat(10), instruction: "make it bigger", project: { width: 720, height: 1280, clips: [{ id: "c1", lane: "text", type: "text", start: 0, dur: 2, text: "Hi", secret: "NOPE" }] } });
  assert.equal(r.message, "Done");
  assert.deepEqual(r.ops, [{ op: "update", target: "selected", patch: { scale: 1.5 } }]);
  assert.ok(prompt.includes('"id":"c1"') && !prompt.includes("NOPE"));
  await assert.rejects(planEdits({ apiKey: "k".repeat(10), instruction: "  ", project: {} }), { code: "INVALID_BODY" });
  assert.equal(summarizeProject({ clips: Array.from({ length: 500 }, (_, i) => ({ id: i, lane: "a", type: "b", start: 0, dur: 1 })) }).clips.length, 120);
});
