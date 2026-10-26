import { asyncHandler } from "../middleware/errorMiddleware.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import QRCode from "qrcode";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getPaidPlan, getCustomPlan } from "../config/plans.js";
import { checkByMd5, generateQr } from "../lib/khqr.js";

const PAY_WINDOW_MS = 10 * 60 * 1000; // KHQR.dev checkout countdown: 10 minutes

// Origin of this site, used for the optional hosted-checkout URLs (domain must be verified in dash.khqr.dev).
const siteUrl = () => (process.env.PAYMENT_RETURN_URL || "").replace(/\/+$/, "");

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

  const site = siteUrl();
  const data = await generateQr({
    amount: plan.price,
    ...(site ? { returnUrl: `${site}/dashboard`, successUrl: `${site}/dashboard?paid=1`, cancelUrl: `${site}/plans` } : {}),
  });
  const image = await QRCode.toDataURL(data.qr, { margin: 1, width: 360, errorCorrectionLevel: "M" });
  const expiresAt = new Date(Date.now() + PAY_WINDOW_MS);

  try {
    await Payment.create({
      md5: data.md5,
      orderId,
      user: req.user._id,
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      tokens: plan.tokens,
      expiresAt,
      tranId: data.tran_id ? String(data.tran_id) : null,
      checkoutUrl: data.checkout_url || null,
    });
  } catch (error) {
    if (error.code !== 11000) throw error; // duplicate md5 → reuse below
  }

  return res.status(201).json({
    success: true,
    data: {
      md5: data.md5,
      image,
      checkoutUrl: data.checkout_url || "",
      pollIntervalMs: 4000,
      expiresAt: expiresAt.toISOString(),
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

  // --- Verify the payment with KHQR.dev (server-side, never the browser) ---
  const { status } = await checkByMd5(md5);
  if (status !== "paid") {
    if (status === "expired") {
      receipt.status = status;
      await receipt.save().catch(() => {});
    }
    return res.status(400).json({
      success: false,
      message: "Payment is not confirmed yet. Please complete the payment first.",
    });
  }

  const out = await fulfill(receipt);
  return res.status(200).json({ success: true, data: out });
});

// GET /api/payments/:md5/status  (protected) — polled by the payment dialog every few seconds.
// A confirmed payment is fulfilled here too, so it never depends on the browser calling /claim.
export const paymentStatus = asyncHandler(async (req, res) => {
  const { md5 } = req.params;
  const receipt = await Payment.findOne({ md5 });
  if (!receipt || receipt.user.toString() !== req.user._id.toString()) {
    return res.status(404).json({ success: false, message: "Payment not found." });
  }
  const remainingSeconds = receipt.expiresAt ? Math.max(0, Math.round((new Date(receipt.expiresAt).getTime() - Date.now()) / 1000)) : 0;
  if (receipt.claimedAt) return res.json({ success: true, data: { status: "paid", remainingSeconds } });
  const { status } = await checkByMd5(md5);
  if (status === "paid") {
    const out = await fulfill(receipt);
    return res.json({ success: true, data: { status, remainingSeconds, ...out } });
  }
  if (status === "expired" && receipt.status !== "expired") {
    receipt.status = "expired";
    await receipt.save().catch(() => {});
  }
  return res.json({ success: true, data: { status, remainingSeconds } });
});

// Credits the tokens exactly once (atomic on the receipt) — safe to call from poll, claim and webhook.
export async function fulfill(receipt) {
  const won = await Payment.findOneAndUpdate(
    { _id: receipt._id, claimedAt: null },
    { $set: { status: "paid", paidAt: new Date(), claimedAt: new Date() } }
  );
  let added = 0;
  if (won) {
    added = receipt.tokens;
    await User.updateOne({ _id: receipt.user }, { $inc: { tokens: added } });
  }
  const user = await User.findById(receipt.user);
  return { tokens: user?.tokens ?? 0, added, alreadyClaimed: added === 0, planName: receipt.planName };
}

// POST /api/payments/webhook  (public, signed by KHQR.dev)
//   X-RBK-Signature: hex HMAC-SHA256 of the RAW body with KHQR_WEBHOOK_SECRET
//   X-RBK-Delivery : unix ms — rejected when older/newer than 5 minutes (replay protection)
// Fulfilment is idempotent (fulfill) and re-checked with the API, so a forged/replayed call cannot credit tokens.
export const khqrWebhook = asyncHandler(async (req, res) => {
  const secret = process.env.KHQR_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ success: false, message: "Webhook is not configured." });
  const raw = req.rawBody;
  const sig = String(req.get("x-rbk-signature") || "");
  const delivery = Number(req.get("x-rbk-delivery"));
  if (!raw || !sig || !Number.isFinite(delivery)) return res.status(400).json({ success: false, message: "Bad webhook request." });
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig.toLowerCase());
  if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ success: false, message: "Invalid signature." });
  if (Math.abs(Date.now() - delivery) > 5 * 60 * 1000) return res.status(400).json({ success: false, message: "Webhook delivery is too old." });

  const body = req.body || {};
  const event = String(body.event || body.type || "");
  const md5 = String(body.data?.md5 || body.md5 || "");
  if (event === "payment.success" && md5) {
    const receipt = await Payment.findOne({ md5 });
    if (receipt && !receipt.claimedAt) {
      const { status } = await checkByMd5(md5); // never trust the payload alone
      if (status === "paid") await fulfill(receipt);
    }
  } else if (event === "payment.expired" && md5) {
    await Payment.updateOne({ md5, claimedAt: null }, { $set: { status: "expired" } });
  }
  return res.json({ success: true });
});
