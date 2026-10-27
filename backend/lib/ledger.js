// Ledger + notifications + audit log. Every function is best-effort: a failure here must never
// block a paid action, so errors are logged and swallowed. `deps` is the test seam.
const m = async (n) => (await import(`../models/${n}.js`)).default;
export const LOW_BALANCE = 20;

export const deps = {
  ledger: async (doc) => (await m("Ledger")).create(doc),
  notify: async (doc) => (await m("Notification")).create(doc),
  audit: async (doc) => (await m("AuditLog")).create(doc),
  balance: async (userId) => (await (await m("User")).findById(userId).select("tokens"))?.tokens ?? null,
};

const safe = async (fn) => { try { return await fn(); } catch (e) { console.warn("[ledger]", e.message); return null; } };

export const recordLedger = (userId, delta, reason, { balance = null, note = "", actor = null, ref = "" } = {}) =>
  safe(async () => deps.ledger({ user: userId, delta, balance, reason, note, actor, ref }));

export const notify = (userId, type, title, body = "") => safe(async () => deps.notify({ user: userId, type, title, body }));

export const audit = (actor, action, target = "", meta = {}, ip = "") =>
  safe(async () => deps.audit({ actor, action, target: String(target || ""), meta, ip }));

// Called after tokens were spent: ledger line + one "low balance" note when the balance crosses below the limit.
export async function afterCharge(userId, cost, tool, balance) {
  await recordLedger(userId, -cost, `usage:${tool}`, { balance });
  if (Number.isFinite(balance) && balance < LOW_BALANCE && balance + cost >= LOW_BALANCE) {
    await notify(userId, "low_balance", "Low token balance", `You have ${balance} token${balance === 1 ? "" : "s"} left. Top up in Plans.`);
  }
}

export async function afterRefund(userId, cost, tool) {
  const balance = await safe(() => deps.balance(userId));
  await recordLedger(userId, cost, `refund:${tool}`, { balance });
  await notify(userId, "refund", "Tokens refunded", `${cost} token${cost === 1 ? "" : "s"} returned (${tool} did not finish).`);
}

// Adds (delta > 0) or removes (delta < 0) tokens for a non-usage reason and tells the user.
export async function afterGrant(userId, delta, reason, { balance = null, note = "", actor = null, ref = "", title, body } = {}) {
  await recordLedger(userId, delta, reason, { balance, note, actor, ref });
  const n = Math.abs(delta);
  const type = reason === "payment" ? "payment" : reason === "promo" ? "promo" : delta > 0 ? "tokens_added" : "tokens_removed";
  await notify(userId, type, title || (delta > 0 ? `+${n} tokens added` : `${n} tokens removed`), body || note || "");
}
