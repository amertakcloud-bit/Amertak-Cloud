import { resolveGeminiKey } from "../lib/geminiClient.js";
import { AppError } from "../lib/AppError.js";
import { verifyJob } from "../lib/billing.js";
import { decryptSecret } from "../lib/secretBox.js";

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
    req.gemini = resolveGeminiKey(req);
    next();
  } catch (err) {
    next(err);
  }
}

// requireOwnGeminiKey
// For FREE tools: the request must use the visitor's own key (typed in the browser or saved in the account),
// never the server's key — so a free tool can never spend the site owner's Gemini quota.
export function requireOwnGeminiKey(req, res, next) {
  requireGeminiKey(req, res, (err) => {
    const noOwn = err && ["LOGIN_REQUIRED", "NO_SERVER_KEY"].includes(err.code);
    if (noOwn || (!err && req.gemini?.source === "server")) {
      return next(new AppError(400, "OWN_KEY_REQUIRED", "Enter your own Gemini API key to use the voice tool (it is free; the key stays private)."));
    }
    return next(err);
  });
}

// ttsAccess
//   • x-job header  → paid Video-Editor voice: logged in + a valid, paid "voice" job; may use the server key.
//   • no x-job      → free TTS tool: the user's own Gemini key is required.
export async function ttsAccess(req, res, next) {
  const job = req.get?.("x-job");
  if (!job) return requireOwnGeminiKey(req, res, next);
  try {
    if (!req.user) throw new AppError(401, "LOGIN_REQUIRED", "Please log in to use voices in the Video Editor.");
    await verifyJob(job, req.user._id, "voice");
    req.voiceJob = job;
    return requireGeminiKey(req, res, next);
  } catch (err) {
    return next(err);
  }
}
