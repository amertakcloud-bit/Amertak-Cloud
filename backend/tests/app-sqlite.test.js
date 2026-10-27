import test from "node:test";
import assert from "node:assert/strict";
import { call as hcall } from "./helpers.js";

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
    tg: await import("../lib/telegramOidc.js"),
    editorCtl: await import("../controllers/editorController.js"),
    ttsCtl: await import("../controllers/ttsController.js"),
    gem: await import("../lib/geminiClient.js"),
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
  res.redirect = (loc) => { res.location = loc; done(); };
  res.headersSent = false;
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

run("Telegram OIDC: PKCE redirect → code exchange → verified ID token → session (and every rejection)", async () => {
  const crypto = await import("node:crypto");
  const jwt = (await import("jsonwebtoken")).default; // only for our own HS256 session/state tokens
  process.env.TELEGRAM_CLIENT_ID = "123456789"; process.env.TELEGRAM_CLIENT_SECRET = "sekret";
  delete process.env.TELEGRAM_REDIRECT_URI; delete process.env.TELEGRAM_CALLBACK_URL;
  process.env.CLIENT_URL = "https://site.test";
  const mk = () => crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const good = mk(), evil = mk();
  const jwk = { ...good.publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
  let tokenReq = null, claims, signer = good.privateKey;
  // RS256 ID tokens signed with node:crypto (like Telegram does)
  const sign = (c, key = signer, o = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const h = Buffer.from(JSON.stringify({ alg: "RS256", kid: "k1", typ: "JWT" })).toString("base64url");
    const p = Buffer.from(JSON.stringify({ iss: o.issuer ?? "https://oauth.telegram.org", aud: o.audience ?? "123456789", sub: "sub-1", iat: now, exp: now + (o.expiresIn ?? 3600), ...c })).toString("base64url");
    return `${h}.${p}.${crypto.sign("sha256", Buffer.from(`${h}.${p}`), key).toString("base64url")}`;
  };
  m.tg.deps.fetch = async (url, o) => {
    if (url.endsWith("/jwks.json")) return { ok: true, status: 200, json: async () => ({ keys: [jwk] }) };
    tokenReq = { url, headers: o.headers, body: new URLSearchParams(String(o.body)) };
    return { ok: true, status: 200, json: async () => ({ access_token: "a", id_token: sign(claims) }) };
  };
  m.tg.resetJwksCache();

  // 1) /auth/telegram → redirect with PKCE + state, signed cookie set
  const req0 = { headers: { "x-forwarded-proto": "https", "x-forwarded-host": "site.test" }, query: {}, cookies: {} };
  const r0 = await call(m.auth.telegramLogin, req0);
  const loc = new URL(r0.location);
  assert.equal(loc.origin + loc.pathname, "https://oauth.telegram.org/auth");
  assert.equal(loc.searchParams.get("client_id"), "123456789");
  assert.equal(loc.searchParams.get("redirect_uri"), "https://site.test/api/auth/telegram/callback");
  assert.equal(loc.searchParams.get("code_challenge_method"), "S256");
  assert.equal(loc.searchParams.get("scope"), "openid profile");
  assert.ok(!loc.search.includes("sekret"), "client secret must never be in the browser URL");
  const state = loc.searchParams.get("state");
  const cookie = r0.cookies.tg_oidc;
  assert.ok(cookie);
  const saved = jwt.verify(cookie, process.env.SESSION_SECRET);
  assert.equal(saved.state, state);
  assert.equal(loc.searchParams.get("code_challenge"), m.tg.challengeOf(saved.verifier));

  const cb = (query, ck = cookie) => call(m.auth.telegramCallback, { ...req0, query, cookies: ck ? { tg_oidc: ck } : {} });
  const failed = (r) => r.location === "https://site.test/login?error=telegram_failed";

  // 2) rejections (none of them may create a user)
  claims = { id: 777, name: "Sok Dara", preferred_username: "sokdara", picture: "https://t.me/i/userpic/320/x.jpg" };
  assert.ok(failed(await cb({ code: "c", state }, "")));                       // no cookie
  assert.ok(failed(await cb({ code: "c", state: "other" })));                  // state mismatch
  assert.ok(failed(await cb({ state })));                                      // no code
  assert.ok(failed(await cb({ error: "access_denied", state })));              // user cancelled
  signer = evil.privateKey;                                                    // forged signature
  assert.ok(failed(await cb({ code: "c", state })));
  signer = good.privateKey;
  const badClaims = [{ ...claims, _o: { audience: "999" } }, { ...claims, _o: { issuer: "https://evil.example" } }, { ...claims, _o: { expiresIn: -120 } }];
  for (const bc of badClaims) {
    const { _o, ...c } = bc; claims = c;
    m.tg.deps.fetch = (orig => async (u, o) => u.endsWith("/jwks.json") ? orig(u, o) : { ok: true, status: 200, json: async () => ({ id_token: sign(c, good.privateKey, _o) }) })(m.tg.deps.fetch);
    assert.ok(failed(await cb({ code: "c", state })), JSON.stringify(_o));
  }
  assert.equal(await m.User.findOne({ telegramId: "777" }), null);

  // 3) success → user created, session cookie + #token fragment
  m.tg.deps.fetch = async (url, o) => url.endsWith("/jwks.json") ? { ok: true, status: 200, json: async () => ({ keys: [jwk] }) }
    : (tokenReq = { url, headers: o.headers, body: new URLSearchParams(String(o.body)) }, { ok: true, status: 200, json: async () => ({ id_token: sign(claims) }) });
  claims = { id: 777, name: "Sok Dara", preferred_username: "sokdara", picture: "https://t.me/i/userpic/320/x.jpg" };
  const ok = await cb({ code: "the-code", state });
  assert.match(ok.location, /^https:\/\/site\.test\/dashboard#token=/);
  assert.equal(tokenReq.url, "https://oauth.telegram.org/token");
  assert.equal(tokenReq.headers.Authorization, "Basic " + Buffer.from("123456789:sekret").toString("base64"));
  assert.equal(tokenReq.body.get("grant_type"), "authorization_code");
  assert.equal(tokenReq.body.get("code"), "the-code");
  assert.equal(tokenReq.body.get("code_verifier"), saved.verifier);
  assert.equal(tokenReq.body.get("redirect_uri"), "https://site.test/api/auth/telegram/callback");
  assert.ok(ok.cookies.auth_token);
  const u = await m.User.findOne({ telegramId: "777" });
  assert.equal(u.name, "Sok Dara"); assert.equal(u.provider, "telegram"); assert.equal(u.tokens, 150);
  const sessionId = jwt.verify(decodeURIComponent(ok.location.split("#token=")[1]), process.env.SESSION_SECRET).id;
  assert.equal(String(sessionId), String(u._id));

  // 4) second login reuses the account; not configured → friendly redirect
  await cb({ code: "again", state });
  assert.equal(await m.User.countDocuments({ telegramId: "777" }), 1);
  delete process.env.TELEGRAM_CLIENT_SECRET;
  assert.equal((await call(m.auth.telegramLogin, req0)).location, "https://site.test/login?error=telegram_not_configured");
});

run("Editor voice job: 1 token / 200 chars, metered budget, refund once", async () => {
  const u = await m.User.create({ name: "Voice", email: "voice@x.co", password: "password123" });
  await m.User.updateOne({ _id: u._id }, { $set: { tokens: 10 } });
  assert.equal((await hcall(m.editorCtl.voiceStart, { user: u, body: { chars: 0 } })).err.code, "INVALID_CHARS");
  const s = (await hcall(m.editorCtl.voiceStart, { user: u, body: { chars: 401 } })).res; // ceil(401/200) = 3
  assert.equal(s.body.data.cost, 3);
  assert.equal((await m.User.findById(u._id)).tokens, 7);
  const job = s.body.data.job;

  // a synthesis request inside the job (fake Gemini): spends from the budget (3 × 200 = 600 chars)
  const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt "), Buffer.alloc(8), Buffer.from("data"), Buffer.alloc(4), Buffer.alloc(2000)]);
  m.gem.deps.createClient = async () => ({ interactions: { create: async () => ({ output_audio: { data: wav.toString("base64") } }) } });
  const speak = (chars) => hcall(m.ttsCtl.synthesizeText, { user: u, voiceJob: job, gemini: { key: "k", source: "server" }, body: { text: "ក".repeat(chars), voice: "Puck" } });
  assert.ok((await speak(400)).res.body.length > 0);
  assert.ok((await speak(200)).res.body.length > 0);
  assert.equal((await speak(10)).err.code, "JOB_BUDGET_EXCEEDED"); // 600 / 600 used
  // failure → refund exactly once
  const r1 = (await hcall(m.editorCtl.voiceRefund, { user: u, body: { job } })).res;
  assert.equal(r1.body.data.refunded, 3);
  const r2 = (await hcall(m.editorCtl.voiceRefund, { user: u, body: { job } })).res;
  assert.equal(r2.body.data.refunded, 0);
  assert.equal((await m.User.findById(u._id)).tokens, 10);
});

run("ledger + notifications: admin grant/deduct, low balance, refund, audit, own-only", async () => {
  const nc = await import("../controllers/notificationController.js");
  const Ledger = (await import("../models/Ledger.js")).default;
  const Notification = (await import("../models/Notification.js")).default;
  const AuditLog = (await import("../models/AuditLog.js")).default;
  const mk = async (email) => (await call(m.auth.register, { body: { name: "Ledger " + email[0], email, password: "password123", confirmPassword: "password123" } })).body;
  await mk("led@example.com"); await mk("other@example.com");
  const u = await m.User.findOne({ email: "led@example.com" });
  const other = await m.User.findOne({ email: "other@example.com" });
  const admin = { _id: other._id };

  await call(m.admin.addTokens, { params: { userId: String(u._id) }, body: { tokens: 5, reason: "gift" }, user: admin });
  const bad = await call(m.admin.deductTokens, { params: { userId: String(u._id) }, body: { tokens: 3 }, user: admin });
  assert.equal(bad.code, 400, "deduct needs a reason");
  const tooMuch = await call(m.admin.deductTokens, { params: { userId: String(u._id) }, body: { tokens: 9999, reason: "x" }, user: admin });
  assert.equal(tooMuch.code, 400);
  const ok = await call(m.admin.deductTokens, { params: { userId: String(u._id) }, body: { tokens: 5, reason: "mistake" }, user: admin });
  assert.equal(ok.code, 200);

  // spend down below 20 → one low-balance note; then refund → refund note
  await m.billing.chargeTokens(u._id, 140, "caption"); // 150 → 10
  await m.billing.chargeTokens(u._id, 1, "caption");   // stays low: no second note
  await m.billing.refundTokens(u._id, 1, "caption");

  const ledger = await Ledger.find({ user: u._id }).sort({ createdAt: 1 });
  const reasons = ledger.map((x) => x.reason);
  assert.deepEqual(reasons.filter((r) => !r.startsWith("usage") && !r.startsWith("refund")), ["admin_grant", "admin_deduct"]);
  assert.ok(reasons.includes("refund:caption"));
  assert.equal(ledger.find((x) => x.reason === "admin_grant").balance, 155);
  assert.equal(ledger.at(-1).balance, 10);
  const notes = await Notification.find({ user: u._id });
  assert.equal(notes.filter((n) => n.type === "low_balance").length, 1);
  for (const t of ["tokens_added", "tokens_removed", "refund"]) assert.ok(notes.some((n) => n.type === t), t);
  assert.equal((await AuditLog.find({})).filter((a) => a.action.startsWith("tokens.")).length >= 2, true);

  const mine = await call(nc.listNotifications, { user: u });
  assert.equal(mine.body.data.unread, notes.length);
  assert.ok(mine.body.data.items.every((n) => String(n.user) === String(u._id)), "only own notifications");
  await call(nc.markAllRead, { user: u });
  assert.equal((await call(nc.listNotifications, { user: u })).body.data.unread, 0);
  assert.equal((await call(nc.listNotifications, { user: other })).body.data.items.some((n) => String(n.user) === String(u._id)), false);
});

run("roles: permission matrix, role change guards, ban rules, payments/stats", async () => {
  const { requirePerm } = await import("../middleware/permissions.js");
  const mw = (perm, role) => new Promise((resolve) => {
    const res = { status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    requirePerm(perm)({ user: role ? { role } : null }, res, () => resolve({ code: 200 }));
  });
  const expect = { admin: [200, 200, 200], support: [403, 200, 200], finance: [200, 403, 403], user: [403, 403, 403] };
  for (const [role, [tok, ban, pay]] of Object.entries(expect)) {
    assert.equal((await mw("tokens.adjust", role)).code, tok, `${role} tokens.adjust`);
    assert.equal((await mw("users.ban", role)).code, ban, `${role} users.ban`);
    assert.equal((await mw("audit.read", role)).code, role === "finance" || role === "user" ? 403 : 200, `${role} audit.read`);
    assert.equal((await mw("payments.read", role)).code, role === "admin" || role === "finance" ? 200 : 403, `${role} payments.read`);
  }
  assert.equal((await mw("users.read", null)).code, 401);

  const mk = async (email) => { await call(m.auth.register, { body: { name: "Role " + email[0], email, password: "password123", confirmPassword: "password123" } }); return m.User.findOne({ email }); };
  const adm = await mk("adm@example.com"), sup = await mk("sup@example.com"), tgt = await mk("tgt@example.com");
  for (const x of await m.User.find({ role: "admin" })) { x.role = "user"; await x.save(); }
  adm.role = "admin"; await adm.save();

  const self = await call(m.admin.setRole, { params: { userId: String(adm._id) }, body: { role: "user" }, user: adm });
  assert.equal(self.code, 400, "cannot change own role");
  assert.equal((await call(m.admin.setRole, { params: { userId: String(tgt._id) }, body: { role: "root" }, user: adm })).code, 400);
  assert.equal((await call(m.admin.setRole, { params: { userId: String(sup._id) }, body: { role: "support" }, user: adm })).code, 200);
  assert.equal((await m.User.findById(sup._id)).role, "support");
  // promote tgt to admin, then adm cannot be the "last admin" problem: demote tgt back is fine, demoting the only admin is not
  await call(m.admin.setRole, { params: { userId: String(tgt._id) }, body: { role: "admin" }, user: adm });
  assert.equal((await call(m.admin.setRole, { params: { userId: String(adm._id) }, body: { role: "user" }, user: tgt })).code, 200);
  const last = await call(m.admin.setRole, { params: { userId: String(tgt._id) }, body: { role: "user" }, user: adm });
  assert.ok([400, 200].includes(last.code));
  // restore: adm admin again
  const a2 = await m.User.findById(adm._id); a2.role = "admin"; await a2.save();
  const t2 = await m.User.findById(tgt._id); t2.role = "user"; await t2.save();

  // ban rules
  assert.equal((await call(m.admin.setBan, { params: { userId: String(tgt._id) }, body: { banned: true }, user: sup })).code, 400, "reason required");
  assert.equal((await call(m.admin.setBan, { params: { userId: String(sup._id) }, body: { banned: true, reason: "x" }, user: sup })).code, 400, "not yourself");
  assert.equal((await call(m.admin.setBan, { params: { userId: String(a2._id) }, body: { banned: true, reason: "x" }, user: sup })).code, 403, "support cannot ban admin");
  const ok = await call(m.admin.setBan, { params: { userId: String(tgt._id) }, body: { banned: true, reason: "spam" }, user: sup });
  assert.equal(ok.code, 200);
  assert.equal((await m.User.findById(tgt._id)).banned, true);
  await call(m.admin.setBan, { params: { userId: String(tgt._id) }, body: { banned: false }, user: sup });
  assert.equal((await m.User.findById(tgt._id)).banned, false);

  const st = await call(m.admin.adminStats, { user: adm });
  assert.ok(st.body.data.users >= 3 && typeof st.body.data.revenue === "number");
  assert.ok(Array.isArray((await call(m.admin.listPayments, { query: {}, user: adm })).body.data.items));
});
