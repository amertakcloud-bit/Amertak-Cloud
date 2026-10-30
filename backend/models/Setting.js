import mongoose from "../lib/odm/index.js";

// Site-wide settings managed by the admin (one document per key). Secrets are stored encrypted (see lib/settings.js).
const schema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Object, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export default mongoose.model("Setting", schema);
