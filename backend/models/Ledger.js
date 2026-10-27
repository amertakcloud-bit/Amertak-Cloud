import mongoose from "../lib/odm/index.js";

// Immutable record of every token movement. delta > 0 = added, < 0 = taken. Never updated or deleted.
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    delta: { type: Number, required: true },
    balance: { type: Number, default: null }, // balance after this movement (null when unknown)
    reason: { type: String, required: true }, // usage:<tool> | refund:<tool> | payment | admin_grant | admin_deduct | promo
    note: { type: String, default: "", maxlength: 300 },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // admin who caused it
    ref: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
schema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Ledger", schema);
