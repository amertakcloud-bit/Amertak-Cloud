import mongoose from "../lib/odm/index.js";

// Who did what to whom (admin actions). Append-only.
const schema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true }, // tokens.grant | tokens.deduct | role.change | user.ban | …
    target: { type: String, default: "" },
    meta: { type: Object, default: {} },
    ip: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
schema.index({ createdAt: -1 });

export default mongoose.model("AuditLog", schema);
