import mongoose from "../lib/odm/index.js";

// PromoCode
// Server-side source of truth for promo codes.
// - code: unique discount code
// - type: "fixed" (dollars off) or "percent" (percentage off)
// - value: discount amount/percentage
// - maxUsers: how many users can use this code
// - usedCount: how many times it has been used
// - expiresAt: when the code stops working
// - isActive: manual toggle to enable/disable the code
const promoCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["fixed", "percent"],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    maxUsers: {
      type: Number,
      required: true,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Users who already redeemed this code (prevents double redemption).
    usedBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

promoCodeSchema.index({ isActive: 1, expiresAt: 1 });

const PromoCode = mongoose.model("PromoCode", promoCodeSchema);

export default PromoCode;
