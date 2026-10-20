import { AppError } from "../lib/AppError.js";
import { isValidKeyFormat, validateGeminiKey, mapGeminiError } from "../lib/geminiClient.js";
import { decryptSecret, encryptSecret } from "../lib/secretBox.js";
import User from "../models/User.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";

function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || "",
    provider: user.provider,
    role: user.role,
    tokens: user.tokens ?? 0,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// GET /api/users/me  (protected)
export const getMe = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    data: { user: toPublicUser(req.user) },
  });
});

// PUT /api/users/me  (protected)
// Updates the profile fields a user is allowed to edit: name + avatar.
export const updateMe = asyncHandler(async (req, res) => {
  const { name, avatar } = req.body || {};
  const errors = [];

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (trimmed.length < 2) errors.push("Name must be at least 2 characters.");
    else if (trimmed.length > 60) errors.push("Name must be at most 60 characters.");
  }

  if (avatar !== undefined && avatar !== null) {
    const value = String(avatar);
    const isUrl = /^https?:\/\/\S+$/i.test(value);
    const isDataUri = /^data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+$/i.test(value);
    if (value.length > 0 && !isUrl && !isDataUri) {
      errors.push("Avatar must be an image URL or an image data URI.");
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0], errors });
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  if (name !== undefined) user.name = String(name).trim();
  if (avatar !== undefined) user.avatar = avatar ? String(avatar) : "";

  await user.save();

  return res.status(200).json({
    success: true,
    data: { user: toPublicUser(user) },
    message: "Profile updated.",
  });
});

// ── Gemini API key stored in the user's account (encrypted) ──

const mask = (k) => (k ? `${k.slice(0, 4)}…${k.slice(-3)}` : "");

// GET /api/users/gemini-key → { hasKey, masked }  (the key itself is never returned)
export const getGeminiKeyStatus = asyncHandler(async (req, res) => {
  const u = await User.findById(req.user._id).select("+geminiKeyEnc");
  const key = decryptSecret(u?.geminiKeyEnc);
  res.json({ success: true, data: { hasKey: Boolean(key), masked: mask(key) } });
});

// PUT /api/users/gemini-key  { key } → validates with Google, then stores it encrypted
export const saveGeminiKey = asyncHandler(async (req, res) => {
  const key = String(req.body?.key || "").trim();
  if (!isValidKeyFormat(key)) {
    throw new AppError(400, "INVALID_API_KEY_FORMAT", "The Gemini API key looks invalid (too short, or it contains spaces).");
  }
  try {
    await validateGeminiKey(key);
  } catch (err) {
    throw mapGeminiError(err);
  }
  await User.updateOne({ _id: req.user._id }, { $set: { geminiKeyEnc: encryptSecret(key) } });
  res.json({ success: true, data: { hasKey: true, masked: mask(key) }, message: "Gemini API key saved to your account." });
});

// DELETE /api/users/gemini-key
export const deleteGeminiKey = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $set: { geminiKeyEnc: "" } });
  res.json({ success: true, data: { hasKey: false, masked: "" }, message: "Gemini API key removed." });
});
