import mongoose from "../lib/odm/index.js";

// Payment
// Receipt of a KHQR payment created through our API.
// - md5 (provider reference) is unique → one payment can only ever be claimed
//   once (double-claim is impossible even with concurrent requests).
// - tokens/price come from the server-side plan table, not from the client.
const paymentSchema = new mongoose.Schema(
  {
    md5: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    orderId: {
      type: String,
      required: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: { type: String, required: true },
    planName: { type: String, required: true },
    price: { type: Number, required: true, min: 0 }, // USD
    tokens: { type: Number, required: true, min: 0 }, // tokens to credit
    status: {
      type: String,
      enum: ["unpaid", "scanned", "paid", "expired"],
      default: "unpaid",
    },
    paidAt: { type: Date, default: null },
    claimedAt: { type: Date, default: null }, // set exactly once when credited
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
