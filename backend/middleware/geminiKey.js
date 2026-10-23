import { resolveGeminiKey } from "../lib/geminiClient.js";
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
