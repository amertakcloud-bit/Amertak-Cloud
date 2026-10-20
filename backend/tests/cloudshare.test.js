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
