import test from "node:test";
import assert from "node:assert/strict";

// End-to-end through the REAL models/controllers/services with the SQLite fallback
// (no MONGODB_URI, no CLOUD_MONGODB_URI). Skipped automatically if npm dependencies are missing.
delete process.env.MONGODB_URI;
delete process.env.CLOUD_MONGODB_URI;
delete process.env.VERCEL;
process.env.DATABASE_PATH = ":memory:";
process.env.CLOUD_DATABASE_PATH = ":memory:";
process.env.SESSION_SECRET = "test-secret-test-secret";

let m;
try {
  m = {
    db: await import("../config/database.js"),
    auth: await import("../controllers/authController.js"),
    admin: await import("../controllers/adminController.js"),
    promo: await import("../controllers/promoController.js"),
    user: await import("../controllers/userController.js"),
    billing: await import("../lib/billing.js"),
    User: (await import("../models/User.js")).default,
    Payment: (await import("../models/Payment.js")).default,
    cloud: await import("../services/cloudShareService.js"),
    qr: await import("../services/qrImageService.js"),
    editor: await import("../services/editorProjects.js"),
    pay: await import("../controllers/paymentController.js"),
    khqr: await import("../lib/khqr.js"),
  };
} catch (e) {
  console.log("skip app-sqlite:", e.message);
}
const run = m ? test : test.skip;

// Runs an Express handler (wrapped by asyncHandler) and waits until it responds or calls next().
const call = (fn, req) => new Promise((resolve, reject) => {
  const res = { code: 200, body: null, cookies: {} };
  const done = () => resolve(res);
  res.status = (c) => { res.code = c; return res; };
  res.json = (b) => { res.body = b; done(); return res; };
  res.cookie = (k, v) => { res.cookies[k] = v; return res; };
  res.clearCookie = () => res;
  res.redirect = done;
  fn({ body: {}, query: {}, params: {}, headers: {}, get: () => "", ...req }, res, (e) => (e ? reject(e) : done()));
});

run("database layer reports sqlite and connects", async () => {
  assert.equal(m.db.databaseKind(), "sqlite");
  assert.equal(m.db.hasDatabase(), true);
  await m.db.ensureDb();
});

run("register → login → duplicate email → wrong password", async () => {
  const r = await call(m.auth.register, { body: { name: "Dara", email: "Dara@Example.com", password: "password123", confirmPassword: "password123" } });
  assert.equal(r.code, 201, JSON.stringify(r.body));
  assert.equal(r.body.user?.tokens ?? r.body.data?.user?.tokens, 150);
  const dup = await call(m.auth.register, { body: { name: "Dara2", email: "dara@example.com", password: "password123", confirmPassword: "password123" } });
  assert.equal(dup.code, 409);
  const ok = await call(m.auth.login, { body: { email: "dara@example.com", password: "password123" } });
  assert.equal(ok.code, 200);
  const bad = await call(m.auth.login, { body: { email: "dara@example.com", password: "nope-nope" } });
  assert.equal(bad.code, 401);
});

run("billing: charge, usage log, refund once, dashboard aggregates", async () => {
  const u = await m.User.findOne({ email: "dara@example.com" });
  const bal = await m.billing.chargeTokens(u._id, 10, "caption");
  assert.equal(bal, 140);
  await assert.rejects(m.billing.chargeTokens(u._id, 9999, "caption"), (e) => e.code === "INSUFFICIENT_TOKENS" || e.statusCode === 402 || /token/i.test(e.message));
  await m.billing.chargeTokens(u._id, 2, "cloudshare");
  await m.billing.refundTokens(u._id, 2, "cloudshare");
  const job = await m.billing.startJob(u._id, "caption", 5);
  assert.ok(job.token || job.job || job);
  const res = await call(m.user.getDashboard, { user: await m.User.findById(u._id), query: { days: "7", tz: "-420" } });
  assert.equal(res.code, 200, JSON.stringify(res.body));
  const d = res.body.data;
  assert.equal(d.balance, 135);
  assert.equal(d.byDay.length, 7);
  assert.equal(d.spent, 15); // 10 caption + 2 cloudshare − 2 refund + 5 job … refunds net out per day
  assert.deepEqual(d.byTool.map((t) => t.tool).sort(), ["caption", "cloudshare"]);
});

run("payment receipt: unique md5, atomic claim once", async () => {
  const u = await m.User.findOne({ email: "dara@example.com" });
  const mk = () => m.Payment.create({ md5: "m".repeat(32), orderId: "o1", user: u._id, planId: "p", planName: "Starter", price: 1.5, tokens: 100 });
  const p = await mk();
  await assert.rejects(mk(), (e) => e.code === 11000);
  const first = await m.Payment.findOneAndUpdate({ _id: p._id, claimedAt: null }, { $set: { status: "paid", paidAt: new Date(), claimedAt: new Date() } });
  const second = await m.Payment.findOneAndUpdate({ _id: p._id, claimedAt: null }, { $set: { claimedAt: new Date() } });
  assert.ok(first); assert.equal(second, null);
  assert.equal(String((await m.Payment.findOne({ md5: "m".repeat(32) })).user), String(u._id));
  const dash = await call(m.user.getDashboard, { user: await m.User.findById(u._id), query: {} });
  assert.equal(dash.body.data.payments.length, 1);
  assert.equal(dash.body.data.boughtTokens, 100);
});

run("admin: promo create/list/redeem once + user list search", async () => {
  const admin = await m.User.create({ name: "Boss", email: "boss@x.co", password: "password123", role: "admin" });
  const exp = new Date(Date.now() + 86400e3).toISOString();
  const created = await call(m.admin.createPromoCode, { user: admin, body: { code: "hello10", type: "fixed", value: 10, maxUsers: 2, expiresAt: exp } });
  assert.ok(created.code < 300, JSON.stringify(created.body));
  const list = await call(m.admin.listPromoCodes, { user: admin, query: {} });
  assert.ok(JSON.stringify(list.body).includes("HELLO10"));
  const u = await m.User.findOne({ email: "dara@example.com" });
  const before = u.tokens;
  const r1 = await call(m.promo.redeemPromoCode, { user: u, body: { code: "hello10" } });
  assert.equal(r1.code, 200, JSON.stringify(r1.body));
  assert.equal((await m.User.findById(u._id)).tokens, before + 10);
  const r2 = await call(m.promo.redeemPromoCode, { user: await m.User.findById(u._id), body: { code: "hello10" } });
  assert.equal(r2.code, 400); // already used
  const users = await call(m.admin.listUsers, { user: admin, query: { search: "DARA" } });
  assert.equal(users.body.data.users.length, 1);
});

run("CloudShare + QR images + editor projects on the cloud SQLite", async () => {
  assert.equal(m.cloud.isCloudShareAvailable(), true);
  const rec = await m.cloud.createCloudShareRecord({ originalName: "a b.txt", mimeType: "text/plain", buffer: Buffer.from("hello world"), expiresIn: "1h" });
  assert.equal(rec.size, 11);
  await m.cloud.incrementCloudShareDownloadCount(rec.shareId);
  const got = await m.cloud.findCloudShareRecord(rec.shareId, { withData: true });
  assert.equal(got.data.toString(), "hello world"); assert.equal(got.downloadCount, 1);
  assert.equal((await m.cloud.findCloudShareRecord(rec.shareId)).data, undefined);

  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);
  const s = await m.qr.saveQrImage({ owner: "u1", name: "x.png", buffer: png });
  const back = await m.qr.readQrImage(s.imageId);
  assert.equal(back.mimeType, "image/png"); assert.ok(back.data.equals(png));
  assert.equal((await m.qr.listQrImages("u1")).length, 1);
  assert.equal(await m.qr.deleteQrImage("u1", s.imageId), true);

  const p = await m.editor.createProject("u1", { name: "My video", width: 720, height: 1280, data: { clips: [{ id: "a" }] } });
  assert.equal((await m.editor.listProjects("u1")).length, 1);
  await m.editor.updateProject("u1", p.id, { name: "Renamed", duration: 12.5, data: { clips: [] } });
  const back2 = await m.editor.getProject("u1", p.id);
  assert.equal(back2.name, "Renamed"); assert.deepEqual(back2.data, { clips: [] });
  await assert.rejects(m.editor.getProject("u2", p.id), (e) => e.code === "PROJECT_NOT_FOUND");
  await m.editor.deleteProject("u1", p.id);
  assert.equal((await m.editor.listProjects("u1")).length, 0);
});

run("KHQR.dev payment: create → poll → webhook (signed, replay-safe, idempotent)", async () => {
  const { createHmac } = await import("node:crypto");
  process.env.RBK_TOKEN = "test-token";
  process.env.KHQR_WEBHOOK_SECRET = "whsec";
  const md5 = "d".repeat(32);
  let status = "unpaid", sentAuth = "";
  m.khqr.deps.fetch = async (url, o) => {
    sentAuth = o.headers.Authorization;
    const json = url.endsWith("/generate_qr")
      ? { responseCode: 0, data: { qr: "00020101021229370016A000000677010111", md5, tran_id: "1786" } }
      : { data: { status } };
    return { ok: true, status: 200, json: async () => json, headers: { get: () => null } };
  };
  const u = await m.User.create({ name: "Pay", email: "pay@x.co", password: "password123" });
  const before = u.tokens;
  const c = await call(m.pay.createPayment, { user: u, body: { planId: "2" } });
  assert.equal(c.code, 201, JSON.stringify(c.body));
  assert.equal(sentAuth, "Bearer test-token");
  assert.match(c.body.data.image, /^data:image\/png/);
  assert.equal(c.body.data.md5, md5);

  const poll = (st) => { status = st; return call(m.pay.paymentStatus, { user: u, params: { md5 } }); };
  assert.equal((await poll("scanned")).body.data.status, "scanned");

  const send = (body, { secret = "whsec", ts = Date.now() } = {}) => {
    const raw = Buffer.from(JSON.stringify(body));
    const sig = createHmac("sha256", secret).update(raw).digest("hex");
    const h = { "x-rbk-signature": sig, "x-rbk-delivery": String(ts) };
    return call(m.pay.khqrWebhook, { rawBody: raw, body, get: (k) => h[k.toLowerCase()] });
  };
  const ev = { event: "payment.success", data: { md5 } };
  assert.equal((await send(ev, { secret: "wrong" })).code, 401);
  assert.equal((await send(ev, { ts: Date.now() - 10 * 60 * 1000 })).code, 400);
  status = "unpaid"; // forged payload: API says unpaid → nothing credited
  await send(ev);
  assert.equal((await m.User.findById(u._id)).tokens, before);
  status = "paid";
  assert.equal((await send(ev)).code, 200);
  await send(ev); await poll("paid"); // replay + poll → still credited once
  const after = (await m.User.findById(u._id)).tokens;
  assert.ok(after > before);
  assert.equal(after - before, c.body.data.plan.tokens);
});
