import User from "../models/User.js";
import { ROLES, isStaff, permsFor } from "../lib/permissions.js";
import { afterGrant, audit, notify } from "../lib/ledger.js";
import AuditLog from "../models/AuditLog.js";
import Ledger from "../models/Ledger.js";
import Payment from "../models/Payment.js";
import PromoCode from "../models/Promocode.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import {
  signToken,
  cookieOptions,
  AUTH_COOKIE,
} from "../middleware/authMiddleware.js";

// Same public user shape as authController.toPublicUser.
function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || "",
    provider: user.provider,
    role: user.role,
    banned: Boolean(user.banned),
    permissions: permsFor(user.role),
    tokens: user.tokens ?? 0,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// POST /api/admin/auth/login
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required.",
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select("+password");

  if (!user || !user.password || !(await user.matchPassword(password))) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  if (!isStaff(user.role) || user.banned) {
    return res.status(403).json({
      success: false,
      message: "Account is not an admin.",
    });
  }

  // Set the shared HTTP-only auth cookie so /admin/* requests are authenticated.
  const token = signToken(user._id.toString());
  res.cookie(AUTH_COOKIE, token, cookieOptions());

  return res.status(200).json({
    success: true,
    data: { user: toPublicUser(user), token },
  });
});

// POST /api/admin/auth/logout
export const adminLogout = asyncHandler(async (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
});

// GET /api/admin/auth/me  (protected)
export const adminMe = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    data: { user: toPublicUser(req.user) },
  });
});

// GET /api/admin/users
export const listUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = "" } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const filter = {};
  if (["user", "support", "finance", "admin"].includes(req.query.role)) filter.role = req.query.role;
  if (req.query.banned === "true") filter.banned = true;
  const q = String(search).trim();
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("name email avatar tokens role banned createdAt updatedAt")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    User.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    },
  });
});

// GET /api/admin/users/:userId
export const getUserDetail = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select(
    "name email provider role banned bannedReason tokens createdAt updatedAt"
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  const payments = await Payment.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const paymentSummary = {
    totalPayments: payments.length,
    totalAmount: payments.reduce((sum, p) => sum + (p.price || 0), 0),
    totalTokens: payments.reduce((sum, p) => sum + (p.tokens || 0), 0),
    paid: payments.filter((p) => p.status === "paid").length,
    unpaid: payments.filter((p) => p.status !== "paid").length,
    recentPayments: payments,
  };

  return res.status(200).json({
    success: true,
    data: { user, ...paymentSummary },
  });
});

// POST /api/admin/users/:userId/tokens
export const addTokens = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { tokens } = req.body || {};

  if (!tokens || tokens <= 0 || !Number.isInteger(tokens)) {
    return res.status(400).json({
      success: false,
      message: "Please provide a positive whole number of tokens.",
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { tokens } },
    { new: true, runValidators: true }
  ).select("name email tokens");

  const note = String(req.body?.reason || "").slice(0, 300);
  await afterGrant(userId, tokens, "admin_grant", { balance: updatedUser.tokens, note, actor: req.user?._id, title: `+${tokens} tokens added by admin`, body: note });
  await audit(req.user?._id, "tokens.grant", userId, { tokens, reason: note }, req.ip);

  return res.status(200).json({
    success: true,
    data: {
      user: toPublicUser(updatedUser),
      added: tokens,
    },
  });
});

// POST /api/admin/users/:userId/tokens/deduct  { tokens, reason }  — never takes the balance below 0
export const deductTokens = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const tokens = Number(req.body?.tokens);
  const note = String(req.body?.reason || "").trim().slice(0, 300);
  if (!Number.isInteger(tokens) || tokens <= 0) return res.status(400).json({ success: false, message: "Please provide a positive whole number of tokens." });
  if (!note) return res.status(400).json({ success: false, message: "A reason is required when removing tokens." });
  const updated = await User.findOneAndUpdate({ _id: userId, tokens: { $gte: tokens } }, { $inc: { tokens: -tokens } }, { new: true }).select("name email tokens");
  if (!updated) {
    const exists = await User.findById(userId).select("tokens");
    if (!exists) return res.status(404).json({ success: false, message: "User not found." });
    return res.status(400).json({ success: false, message: `User only has ${exists.tokens} tokens.` });
  }
  await afterGrant(userId, -tokens, "admin_deduct", { balance: updated.tokens, note, actor: req.user?._id, title: `${tokens} tokens removed by admin`, body: note });
  await audit(req.user?._id, "tokens.deduct", userId, { tokens, reason: note }, req.ip);
  return res.status(200).json({ success: true, data: { user: toPublicUser(updated), removed: tokens } });
});

// GET /api/admin/audit?page=&limit=
export const listAudit = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
  const [items, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    AuditLog.countDocuments(),
  ]);
  return res.json({ success: true, data: { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) } });
});

// GET /api/admin/users/:userId/ledger
export const userLedger = asyncHandler(async (req, res) => {
  const items = await Ledger.find({ user: req.params.userId }).sort({ createdAt: -1 }).limit(100);
  return res.json({ success: true, data: { items } });
});

// GET /api/admin/promo-codes
export const listPromoCodes = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [codes, total] = await Promise.all([
    PromoCode.find()
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    PromoCode.countDocuments(),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      codes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    },
  });
});

// POST /api/admin/promo-codes
export const createPromoCode = asyncHandler(async (req, res) => {
  const { code, type, value, maxUsers, expiresAt } = req.body || {};

  if (!code || !type || !value || !maxUsers || !expiresAt) {
    return res.status(400).json({
      success: false,
      message: "code, type, value, maxUsers and expiresAt are required.",
    });
  }

  const trimmedCode = String(code).trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(trimmedCode)) {
    return res.status(400).json({
      success: false,
      message: "Code must be 3-32 characters (letters, numbers, - or _).",
    });
  }

  if (type !== "fixed" && type !== "percent") {
    return res.status(400).json({
      success: false,
      message: 'Type must be "fixed" or "percent".',
    });
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return res.status(400).json({
      success: false,
      message: "Value must be a positive number.",
    });
  }
  if (type === "percent" && numericValue > 100) {
    return res.status(400).json({
      success: false,
      message: "Percentage value cannot exceed 100.",
    });
  }

  const numericMaxUsers = Number(maxUsers);
  if (!Number.isInteger(numericMaxUsers) || numericMaxUsers < 1) {
    return res.status(400).json({
      success: false,
      message: "Max users must be at least 1.",
    });
  }

  const expiresDate = new Date(expiresAt);
  if (Number.isNaN(expiresDate.getTime()) || expiresDate <= new Date()) {
    return res.status(400).json({
      success: false,
      message: "Expiry date must be in the future.",
    });
  }

  const existing = await PromoCode.findOne({ code: trimmedCode });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: "A promo code with this code already exists.",
    });
  }

  const promoCode = await PromoCode.create({
    code: trimmedCode,
    type,
    value: numericValue,
    maxUsers: numericMaxUsers,
    usedCount: 0,
    expiresAt: expiresDate,
    isActive: true,
  });

  return res.status(201).json({
    success: true,
    data: {
      promoCode: {
        id: promoCode._id,
        code: promoCode.code,
        type: promoCode.type,
        value: promoCode.value,
        maxUsers: promoCode.maxUsers,
        usedCount: promoCode.usedCount,
        expiresAt: promoCode.expiresAt,
        isActive: promoCode.isActive,
        createdAt: promoCode.createdAt,
      },
    },
  });
});

// POST /api/admin/promo-codes/:id/activate
export const activatePromoCode = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const promoCode = await PromoCode.findById(id);
  if (!promoCode) {
    return res.status(404).json({
      success: false,
      message: "Promo code not found.",
    });
  }

  promoCode.isActive = true;
  await promoCode.save();
  await afterGrant(userId, discount, "promo", { balance: updatedUser.tokens, actor: req.user?._id, ref: promoCode.code, title: `Promo ${promoCode.code}: +${discount} tokens` });

  return res.status(200).json({
    success: true,
    data: {
      promoCode: {
        id: promoCode._id,
        code: promoCode.code,
        isActive: promoCode.isActive,
        expiresAt: promoCode.expiresAt,
      },
    },
  });
});

// POST /api/admin/promo-codes/:id/deactivate
export const deactivatePromoCode = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const promoCode = await PromoCode.findById(id);
  if (!promoCode) {
    return res.status(404).json({
      success: false,
      message: "Promo code not found.",
    });
  }

  promoCode.isActive = false;
  await promoCode.save();

  return res.status(200).json({
    success: true,
    data: {
      promoCode: {
        id: promoCode._id,
        code: promoCode.code,
        isActive: promoCode.isActive,
        expiresAt: promoCode.expiresAt,
      },
    },
  });
});

// POST /api/admin/promo-codes/:id/use
// Applies the promo discount to the selected user's token balance.
export const usePromoCode = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "userId is required.",
    });
  }

  const promoCode = await PromoCode.findById(id);
  if (!promoCode) {
    return res.status(404).json({
      success: false,
      message: "Promo code not found.",
    });
  }

  if (!promoCode.isActive) {
    return res.status(400).json({
      success: false,
      message: "This promo code is currently inactive.",
    });
  }

  if (new Date() > promoCode.expiresAt) {
    return res.status(400).json({
      success: false,
      message: "This promo code has expired.",
    });
  }

  if (promoCode.usedCount >= promoCode.maxUsers) {
    return res.status(400).json({
      success: false,
      message: "This promo code has reached its maximum number of users.",
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  // Discount logic: "fixed" adds value tokens, "percent" adds % of current balance.
  let discount = 0;
  if (promoCode.type === "fixed") {
    discount = Math.floor(promoCode.value);
  } else if (promoCode.type === "percent") {
    discount = Math.floor(((user.tokens || 0) * promoCode.value) / 100);
  }

  if (discount <= 0) {
    return res.status(400).json({
      success: false,
      message: "This promo code does not grant any tokens for this user.",
    });
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { tokens: discount } },
    { new: true, runValidators: true }
  );

  promoCode.usedCount += 1;
  const alreadyUsed = (promoCode.usedBy || []).some((id) => id.equals(user._id));
  if (!alreadyUsed) {
    promoCode.usedBy = [...(promoCode.usedBy || []), user._id];
  }
  await promoCode.save();

  return res.status(200).json({
    success: true,
    data: {
      promoCode: {
        id: promoCode._id,
        code: promoCode.code,
        type: promoCode.type,
        value: promoCode.value,
        usedCount: promoCode.usedCount,
        maxUsers: promoCode.maxUsers,
      },
      user: toPublicUser(updatedUser),
      applied: discount,
      message: `Promo code "${promoCode.code}" applied! +${discount} tokens added.`,
    },
  });
});

// DELETE /api/admin/promo-codes/:id
export const deletePromoCode = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const promoCode = await PromoCode.findById(id);
  if (!promoCode) {
    return res.status(404).json({
      success: false,
      message: "Promo code not found.",
    });
  }

  await PromoCode.findByIdAndDelete(id);

  return res.status(200).json({
    success: true,
    message: "Promo code deleted successfully.",
  });
});


// ── Roles, bans, payments, stats ─────────────────────────────────────────────
const sameId = (a, b) => String(a) === String(b);

// POST /api/admin/users/:userId/role  { role }   (admin only; never yourself; never the last admin)
export const setRole = asyncHandler(async (req, res) => {
  const role = String(req.body?.role || "");
  if (!ROLES.includes(role)) return res.status(400).json({ success: false, message: "Unknown role." });
  const target = await User.findById(req.params.userId);
  if (!target) return res.status(404).json({ success: false, message: "User not found." });
  if (sameId(target._id, req.user._id)) return res.status(400).json({ success: false, message: "You cannot change your own role." });
  if (target.role === "admin" && role !== "admin" && (await User.countDocuments({ role: "admin" })) <= 1) {
    return res.status(400).json({ success: false, message: "There must be at least one admin." });
  }
  const before = target.role;
  target.role = role;
  await target.save();
  await audit(req.user._id, "role.change", target._id, { from: before, to: role }, req.ip);
  await notify(target._id, "role", "Your role changed", `You are now: ${role}.`);
  return res.json({ success: true, data: { user: toPublicUser(target) } });
});

// POST /api/admin/users/:userId/ban  { banned: true|false, reason }
export const setBan = asyncHandler(async (req, res) => {
  const banned = req.body?.banned !== false;
  const reason = String(req.body?.reason || "").trim().slice(0, 300);
  if (banned && !reason) return res.status(400).json({ success: false, message: "A reason is required to suspend an account." });
  const target = await User.findById(req.params.userId);
  if (!target) return res.status(404).json({ success: false, message: "User not found." });
  if (sameId(target._id, req.user._id)) return res.status(400).json({ success: false, message: "You cannot suspend yourself." });
  if (target.role === "admin" && req.user.role !== "admin") return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Only an admin can suspend an admin." });
  target.banned = banned;
  target.bannedReason = banned ? reason : "";
  await target.save();
  await audit(req.user._id, banned ? "user.ban" : "user.unban", target._id, { reason }, req.ip);
  return res.json({ success: true, data: { user: toPublicUser(target) } });
});

// GET /api/admin/payments?page=&limit=&status=
export const listPayments = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = {};
  if (["pending", "paid", "expired"].includes(req.query.status)) filter.status = req.query.status;
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Payment.countDocuments(filter),
  ]);
  return res.json({ success: true, data: { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) } });
});

// GET /api/admin/stats
export const adminStats = asyncHandler(async (_req, res) => {
  const [users, banned, staff, paid] = await Promise.all([
    User.countDocuments({}), User.countDocuments({ banned: true }),
    User.countDocuments({ role: { $in: ["support", "finance", "admin"] } }),
    Payment.find({ status: "paid" }),
  ]);
  return res.json({ success: true, data: { users, banned, staff, paidCount: paid.length, revenue: Math.round(paid.reduce((s, p) => s + (p.price || 0), 0) * 100) / 100, tokensSold: paid.reduce((s, p) => s + (p.tokens || 0), 0) } });
});
