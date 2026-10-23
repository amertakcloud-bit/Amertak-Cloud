import crypto from "node:crypto";
import { AppError } from "./AppError.js";

// Token prices (whole tokens only — always rounded UP, never decimals).
export const RATES = Object.freeze({
  captionPerMB: 5, // caption / transcript / image-prompt generation: 1 MB = 5 tokens
  cloudSharePerMB: 2, // CloudShare upload: 5 MB = 10 tokens
});

// ceil(bytes × perMB / 1 MiB), at least 1. bytes × perMB is an integer and 1 MiB is a
// power of two, so the division is exact — no floating-point surprises (10.6 → 11, 5.09 → 6).
export function tokensForBytes(bytes, perMB) {
  const b = Math.max(0, Math.floor(Number(bytes) || 0));
  return Math.max(1, Math.ceil((b * perMB) / 1048576));
}

// Models are imported lazily so unit tests that never touch the database don't need mongoose.
const User = { findOneAndUpdate: async (...a) => (await import("../models/User.js")).default.findOneAndUpdate(...a), findById: async (...a) => (await import("../models/User.js")).default.findById(...a), updateOne: async (...a) => (await import("../models/User.js")).default.updateOne(...a) };
const TokenJob = { create: async (...a) => (await import("../models/TokenJob.js")).default.create(...a), findOneAndUpdate: async (...a) => (await import("../models/TokenJob.js")).default.findOneAndUpdate(...a) };

// Test seam (unit/e2e tests replace these; production uses MongoDB).
async function recordInDb(userId, tool, tokens) {
  try {
    await (await import("../models/TokenUsage.js")).default.create({ user: userId, tool, tokens });
  } catch (e) {
    console.warn("[usage] could not record:", e.message); // never block a paid action on stats
  }
}

export const deps = { usage: (...a) => recordInDb(...a), charge: (...a) => chargeInDb(...a), refund: (...a) => refundInDb(...a) };

const secret = () => process.env.SESSION_SECRET || "insecure-dev-secret-change-me";

// Atomically takes `cost` tokens; throws 402 when the balance is too low.
export async function chargeTokens(userId, cost, tool = "other") {
  const balance = await deps.charge(userId, cost);
  await deps.usage(userId, tool, cost);
  return balance;
}

async function chargeInDb(userId, cost) {
  const user = await User.findOneAndUpdate(
    { _id: userId, tokens: { $gte: cost } },
    { $inc: { tokens: -cost } },
    { new: true }
  );
  if (!user) {
    const cur = await (await import("../models/User.js")).default.findById(userId).select("tokens");
    throw new AppError(
      402,
      "INSUFFICIENT_TOKENS",
      `Not enough tokens: this needs ${cost} token${cost === 1 ? "" : "s"} and you have ${cur?.tokens ?? 0}. Top up in Plans.`,
      { cost, tokens: cur?.tokens ?? 0 }
    );
  }
  return user.tokens;
}

export async function refundTokens(userId, cost, tool = "other") {
  await deps.refund(userId, cost);
  await deps.usage(userId, tool, -cost);
}

async function refundInDb(userId, cost) {
  if (!(cost > 0)) return;
  await User.updateOne({ _id: userId }, { $inc: { tokens: cost } });
}

// ── Paid jobs that span several requests (captions: the browser sends many audio chunks) ──
export async function startJob(userId, kind, cost) {
  const balance = await chargeTokens(userId, cost, kind);
  const jti = crypto.randomBytes(12).toString("hex");
  await TokenJob.create({ jti, user: userId, kind, cost });
  const jwt = (await import("jsonwebtoken")).default;
  const token = jwt.sign({ jti, uid: String(userId), kind }, secret(), { expiresIn: "4h" });
  return { token, cost, balance };
}

export async function verifyJob(token, userId, kind) {
  try {
    const jwt = (await import("jsonwebtoken")).default;
    const p = jwt.verify(String(token || ""), secret());
    if (p.uid === String(userId) && p.kind === kind) return p;
  } catch {
    /* fall through */
  }
  throw new AppError(402, "JOB_REQUIRED", "Start the job first (tokens are charged when you press the button).");
}

// Refunds a job once. Returns the refunded amount (0 when already refunded / unknown).
export async function refundJob(token, userId, kind) {
  const p = await verifyJob(token, userId, kind);
  const job = await TokenJob.findOneAndUpdate({ jti: p.jti, user: userId, refunded: false }, { refunded: true });
  if (!job) return 0;
  await refundTokens(userId, job.cost, kind);
  return job.cost;
}

// Wraps a paid single-request operation: charge → run → refund on failure.
export async function withCharge(userId, cost, fn, tool = "other") {
  const balance = await chargeTokens(userId, cost, tool);
  try {
    return { result: await fn(), balance };
  } catch (err) {
    await refundTokens(userId, cost, tool).catch(() => {});
    throw err;
  }
}
