import mongoose from "../lib/odm/index.js";

// One paid operation (e.g. a caption job). Lets us refund exactly once if it fails.
const schema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, required: true },
    cost: { type: Number, required: true },
    refunded: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 }, // auto-clean after 7 days
  },
  { versionKey: false }
);

export default mongoose.model("TokenJob", schema);
