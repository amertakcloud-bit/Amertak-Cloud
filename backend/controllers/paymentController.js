import { asyncHandler } from "../middleware/errorMiddleware.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import { getPaidPlan, getCustomPlan } from "../config/plans.js";

// External KHQR/Bakong provider (configured in server/.env).
const providerUrl = () =>
  (process.env.PAYMENT_PROVIDER_URL || "https://bakongkhqr-73jw.onrender.com").replace(
    /\/+$/,
    ""
  );

async function providerFetch(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(providerUrl() + path, { ...options, signal: controller.signal });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

// POST /api/payments  (protected)
// Creates a KHQR payment for a plan. The amount is taken from the SERVER-SIDE
// plan table (never from the browser) and the receipt is stored so the token
// reward is fixed at creation time.
export const createPayment = asyncHandler(async (req, res) => {
  const { planId, tokens } = req.body || {};

  // Resolve the plan entirely server-side. The custom plan takes a token
  // amount and computes the price (300 tokens = $1, min $0.10).
  let plan;
  if (String(planId) === "custom") {
    const custom = getCustomPlan(tokens);
    if (custom.error) {
      return res.status(400).json({ success: false, message: custom.error });
    }
    plan = custom.plan;
  } else {
    plan = getPaidPlan(planId);
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan. Choose a paid plan (Pro, Premium or Custom).",
      });
    }
  }

  const orderId = `USR-${req.user._id}-${plan.id}-${Date.now()}`;

  let provider;
  try {
    provider = await providerFetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, amount: plan.price }),
    });
  } catch (_error) {
    return res.status(502).json({
      success: false,
      message: "Payment provider is unreachable. Please try again later.",
    });
  }

  const data = provider.body;
  if (!provider.ok || !data?.md5) {
    return res.status(502).json({
      success: false,
      message: data?.error || "Payment provider rejected the request.",
    });
  }

  try {
    await Payment.create({
      md5: data.md5,
      orderId,
      user: req.user._id,
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      tokens: plan.tokens,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    });
  } catch (error) {
    if (error.code !== 11000) throw error; // duplicate md5 → reuse below
  }

  return res.status(201).json({
    success: true,
    data: {
      md5: data.md5,
      image: data.image || "",
      deeplink: data.deeplink || "",
      pollIntervalMs: data.pollIntervalMs || 4000,
      expiresAt: data.expiresAt || null,
      plan: { id: plan.id, name: plan.name, price: plan.price, tokens: plan.tokens },
    },
  });
});

// POST /api/payments/claim  (protected)
// Called by the client when the payment dialog reports "paid".
// The server does NOT trust the client: it re-checks the status with the
// provider, then credits the tokens atomically exactly once.
export const claimPayment = asyncHandler(async (req, res) => {
  const { md5 } = req.body || {};

  if (!md5 || typeof md5 !== "string" || md5.length > 128) {
    return res.status(400).json({ success: false, message: "Payment reference (md5) is required." });
  }

  const receipt = await Payment.findOne({ md5 });
  // 404 for both "unknown" and "not yours" — never leak other users' receipts.
  if (!receipt || receipt.user.toString() !== req.user._id.toString()) {
    return res.status(404).json({ success: false, message: "Payment not found." });
  }

  // Already credited → idempotent success (safe to call again / retry).
  if (receipt.claimedAt) {
    const currentUser = await User.findById(req.user._id);
    return res.status(200).json({
      success: true,
      data: {
        tokens: currentUser?.tokens ?? 0,
        added: 0,
        alreadyClaimed: true,
        planName: receipt.planName,
      },
    });
  }

  // --- Verify the payment with the provider (server-side, not the browser) ---
  let status;
  let providerOrderId;
  try {
    const check = await providerFetch(
      `/api/payments/${encodeURIComponent(md5)}/status`
    );
    if (check.status === 404) {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found or expired." });
    }
    if (!check.ok || !check.body) {
      return res.status(502).json({
        success: false,
        message: "Payment provider is unreachable. Please try again later.",
      });
    }
    status = check.body.status;
    providerOrderId = check.body.orderId;
  } catch (_error) {
    return res.status(502).json({
      success: false,
      message: "Payment provider is unreachable. Please try again later.",
    });
  }

  // Integrity: the provider record must describe OUR receipt.
  if (providerOrderId && providerOrderId !== receipt.orderId) {
    return res.status(400).json({ success: false, message: "Payment reference mismatch." });
  }

  if (status !== "paid") {
    if (status === "expired" || status === "unpaid") {
      receipt.status = status;
      await receipt.save().catch(() => {});
    }
    return res.status(400).json({
      success: false,
      message: "Payment is not confirmed yet. Please complete the payment first.",
    });
  }

  // --- Credit tokens exactly once (atomic on the receipt) ---
  const claimUpdate = await Payment.findOneAndUpdate(
    { _id: receipt._id, claimedAt: null },
    { $set: { status: "paid", paidAt: new Date(), claimedAt: new Date() } }
  );

  let added = 0;
  if (claimUpdate) {
    // First claim → increment the balance atomically.
    added = receipt.tokens;
    await User.updateOne({ _id: req.user._id }, { $inc: { tokens: added } });
  }

  const user = await User.findById(req.user._id);
  return res.status(200).json({
    success: true,
    data: {
      tokens: user?.tokens ?? 0,
      added,
      alreadyClaimed: added === 0,
      planName: receipt.planName,
    },
  });
});
