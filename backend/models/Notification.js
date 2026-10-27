import mongoose from "../lib/odm/index.js";

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true }, // tokens_added | tokens_removed | payment | low_balance | refund | promo
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, default: "", maxlength: 400 },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
schema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Notification", schema);
