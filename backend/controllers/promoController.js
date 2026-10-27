import User from "../models/User.js";
import { afterGrant } from "../lib/ledger.js";
import PromoCode from "../models/Promocode.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";

// POST /api/promo-codes/redeem  (authenticated users)
// Lets a signed-in user redeem a promo code from the Plans page.
// - "fixed"   → grants `value` tokens
// - "percent" → grants `value`% of the user's current token balance
// Each user can redeem a given code only once (tracked in usedBy).
export const redeemPromoCode = asyncHandler(async (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();

  if (!code) {
    return res.status(400).json({
      success: false,
      message: "Please enter a promo code.",
    });
  }

  const promo = await PromoCode.findOne({ code });
  if (!promo) {
    return res.status(404).json({
      success: false,
      message: "Promo code not found.",
    });
  }

  if (!promo.isActive) {
    return res.status(400).json({
      success: false,
      message: "This promo code is currently inactive.",
    });
  }

  if (new Date() > promo.expiresAt) {
    return res.status(400).json({
      success: false,
      message: "This promo code has expired.",
    });
  }

  if (promo.usedCount >= promo.maxUsers) {
    return res.status(400).json({
      success: false,
      message: "This promo code has reached its maximum number of users.",
    });
  }

  const user = await User.findById(req.user._id);
  const usedBy = promo.usedBy || [];
  if (usedBy.some((id) => id.equals(user._id))) {
    return res.status(400).json({
      success: false,
      message: "You have already used this promo code.",
    });
  }

  // Grant tokens: fixed → flat amount, percent → % of current balance.
  let granted = 0;
  if (promo.type === "fixed") {
    granted = Math.floor(promo.value);
  } else if (promo.type === "percent") {
    granted = Math.floor(((user.tokens || 0) * promo.value) / 100);
  }

  if (granted <= 0) {
    return res.status(400).json({
      success: false,
      message: "This promo code does not grant any tokens for your balance.",
    });
  }

  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    { $inc: { tokens: granted } },
    { new: true, runValidators: true }
  );

  promo.usedCount += 1;
  promo.usedBy = [...usedBy, user._id];
  await promo.save();
  await afterGrant(user._id, granted, "promo", { balance: updatedUser.tokens, ref: promo.code, title: `Promo ${promo.code}: +${granted} tokens` });

  return res.status(200).json({
    success: true,
    data: {
      applied: granted,
      code: promo.code,
      tokens: updatedUser.tokens,
      message: `Promo code "${promo.code}" applied! +${granted} tokens added.`,
    },
  });
});
