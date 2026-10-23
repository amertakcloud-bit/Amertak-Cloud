import mongoose from "../lib/odm/index.js";

// One token movement caused by a tool: positive = spent, negative = refunded.
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tool: { type: String, required: true }, // caption | cloudshare | …
    tokens: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
schema.index({ user: 1, createdAt: -1 });

export default mongoose.model("TokenUsage", schema);
