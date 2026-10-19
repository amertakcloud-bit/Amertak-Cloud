import { resolveGeminiKey } from "../lib/geminiClient.js";

// requireGeminiKey
// Picks the Gemini key for this request: the user's own key (header) or — for logged-in
// users only — the server key. Sets req.gemini = { key, source }. The key is never logged.
export function requireGeminiKey(req, _res, next) {
  try {
    req.gemini = resolveGeminiKey(req);
    next();
  } catch (err) {
    next(err);
  }
}
