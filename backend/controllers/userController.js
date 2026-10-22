import { AppError } from "../lib/AppError.js";
import { isValidKeyFormat, validateGeminiKey, mapGeminiError } from "../lib/geminiClient.js";
import { decryptSecret, encryptSecret } from "../lib/secretBox.js";
import User from "../models/User.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";

function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || "",
    provider: user.provider,
    role: user.role,
    tokens: user.tokens ?? 0,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// GET /api/users/me  (protected)
export const getMe = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    data: { user: toPublicUser(req.user) },
  });
});

// PUT /api/users/me  (protected)
// Updates the profile fields a user is allowed to edit: name + avatar.
export const updateMe = asyncHandler(async (req, res) => {
  const { name, avatar } = req.body || {};
  const errors = [];

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (trimmed.length < 2) errors.push("Name must be at least 2 characters.");
    else if (trimmed.length > 60) errors.push("Name must be at most 60 characters.");
  }

  if (avatar !== undefined && avatar !== null) {
    const value = String(avatar);
    const isUrl = /^https?:\/\/\S+$/i.test(value);
    const isDataUri = /^data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+$/i.test(value);
    if (value.length > 0 && !isUrl && !isDataUri) {
      errors.push("Avatar must be an image URL or an image data URI.");
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0], errors });
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  if (name !== undefined) user.name = String(name).trim();
  if (avatar !== undefined) user.avatar = avatar ? String(avatar) : "";

  await user.save();

  return res.status(200).json({
    success: true,
    data: { user: toPublicUser(user) },
    message: "Profile updated.",
  });
});

// ── Gemini API key stored in the user's account (encrypted) ──

const mask = (k) => (k ? `${k.slice(0, 4)}…${k.slice(-3)}` : "");

// GET /api/users/gemini-key → { hasKey, masked }  (the key itself is never returned)
export const getGeminiKeyStatus = asyncHandler(async (req, res) => {
  const u = await User.findById(req.user._id).select("+geminiKeyEnc");
  const key = decryptSecret(u?.geminiKeyEnc);
  res.json({ success: true, data: { hasKey: Boolean(key), masked: mask(key) } });
});

// PUT /api/users/gemini-key  { key } → validates with Google, then stores it encrypted
export const saveGeminiKey = asyncHandler(async (req, res) => {
  const key = String(req.body?.key || "").trim();
  if (!isValidKeyFormat(key)) {
    throw new AppError(400, "INVALID_API_KEY_FORMAT", "The Gemini API key looks invalid (too short, or it contains spaces).");
  }
  try {
    await validateGeminiKey(key);
  } catch (err) {
    throw mapGeminiError(err);
  }
  await User.updateOne({ _id: req.user._id }, { $set: { geminiKeyEnc: encryptSecret(key) } });
  res.json({ success: true, data: { hasKey: true, masked: mask(key) }, message: "Gemini API key saved to your account." });
});

// DELETE /api/users/gemini-key
export const deleteGeminiKey = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $set: { geminiKeyEnc: "" } });
  res.json({ success: true, data: { hasKey: false, masked: "" }, message: "Gemini API key removed." });
});

// ── Dashboard: purchases + token usage ──
const PAD = (n) => String(Math.abs(n)).padStart(2, "0");
const tzString = (min) => `${min <= 0 ? "+" : "-"}${PAD(Math.floor(Math.abs(min) / 60))}:${PAD(Math.abs(min) % 60)}`; // JS offset is inverted

// GET /api/users/dashboard?days=30&tz=<Date.getTimezoneOffset()>
export const getDashboard = asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 30));
  let tzMin = parseInt(req.query.tz, 10);
  if (!Number.isFinite(tzMin) || Math.abs(tzMin) > 840) tzMin = 0;
  const tz = tzString(tzMin);
  const since = new Date(Date.now() - days * 86400000);

  const [{ default: TokenUsage }, { default: Payment }] = await Promise.all([
    import("../models/TokenUsage.js"),
    import("../models/Payment.js"),
  ]);
  const uid = req.user._id;

  const [byDayRaw, byToolRaw, recent, payments, bought] = await Promise.all([
    TokenUsage.aggregate([
      { $match: { user: uid, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: tz } }, tokens: { $sum: "$tokens" } } },
    ]),
    TokenUsage.aggregate([
      { $match: { user: uid, createdAt: { $gte: since } } },
      { $group: { _id: "$tool", tokens: { $sum: "$tokens" }, count: { $sum: { $cond: [{ $gt: ["$tokens", 0] }, 1, 0] } } } },
      { $sort: { tokens: -1 } },
    ]),
    TokenUsage.find({ user: uid }).sort({ createdAt: -1 }).limit(15).lean(),
    Payment.find({ user: uid, claimedAt: { $ne: null } }).sort({ claimedAt: -1 }).limit(50).lean(),
    Payment.aggregate([{ $match: { user: uid, claimedAt: { $ne: null } } }, { $group: { _id: null, tokens: { $sum: "$tokens" }, price: { $sum: "$price" } } }]),
  ]);

  // Continuous list of days (missing days = 0) in the user's timezone.
  const map = new Map(byDayRaw.map((d) => [d._id, Math.max(0, d.tokens)]));
  const byDay = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000 - tzMin * 60000); // shift to the user's local clock
    const key = d.toISOString().slice(0, 10);
    byDay.push({ date: key, tokens: map.get(key) || 0 });
  }
  const spent = byDay.reduce((s, d) => s + d.tokens, 0);

  res.json({
    success: true,
    data: {
      balance: req.user.tokens ?? 0,
      days,
      spent,
      boughtTokens: bought[0]?.tokens || 0,
      boughtUsd: Math.round((bought[0]?.price || 0) * 100) / 100,
      byDay,
      byTool: byToolRaw.map((t) => ({ tool: t._id, tokens: Math.max(0, t.tokens), count: t.count })),
      recent: recent.map((r) => ({ tool: r.tool, tokens: r.tokens, at: r.createdAt })),
      payments: payments.map((p) => ({ planName: p.planName, price: p.price, tokens: p.tokens, at: p.claimedAt || p.paidAt || p.createdAt })),
    },
  });
});
