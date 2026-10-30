import { resolveGeminiKey } from "../lib/geminiClient.js";
import { AppError } from "../lib/AppError.js";
import { verifyJob } from "../lib/billing.js";
import { decryptSecret } from "../lib/secretBox.js";
import { applyModelOverrides, getAdminGeminiKey } from "../lib/settings.js";

// requireGeminiKey
// Picks the Gemini key for this request, in order:
//   1) x-gemini-api-key header (a key typed in the browser)   2) the key saved in the user's account
//   3) the server key (logged-in users only).
// Sets req.gemini = { key, source }. The key is never logged.
export async function requireGeminiKey(req, _res, next) {
  try {
    const header = String(req.get?.("x-gemini-api-key") ?? "").trim();
    if (!header && req.user?._id) {
      const { default: User } = await import("../models/User.js");
      const u = await User.findById(req.user._id).select("+geminiKeyEnc");
      const saved = decryptSecret(u?.geminiKeyEnc);
      if (saved) req.savedGeminiKey = saved;
    }
    req.adminGeminiKey = await getAdminGeminiKey();
    await applyModelOverrides();
    req.gemini = resolveGeminiKey(req);
    next();
  } catch (err) {
    next(err);
  }
}

// ttsAccess
//   • x-job header  → paid Video-Editor voice: logged in + a valid, paid "voice" job; may use the server key.
//   • no x-job      → free TTS tool: guests allowed (short text), uses the site key or the user's saved key.
export async function ttsAccess(req, res, next) {
  const job = req.get?.("x-job");
  if (!job) {
    // Free tool: works for guests too, with the site's key (or the user's own saved key) — short texts for guests.
    const cap = req.user ? 3000 : 1200;
    if (String(req.body?.text || "").length > cap) return next(new AppError(400, "TEXT_TOO_LONG", req.user ? "Text is too long (max 3000 characters)." : "Guests can convert up to 1200 characters. Log in for up to 3000."));
    return requireGeminiKey(req, res, next);
  }
  try {
    if (!req.user) throw new AppError(401, "LOGIN_REQUIRED", "Please log in to use voices in the Video Editor.");
    await verifyJob(job, req.user._id, "voice");
    req.voiceJob = job;
    return requireGeminiKey(req, res, next);
  } catch (err) {
    return next(err);
  }
}
