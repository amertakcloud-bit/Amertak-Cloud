// Gemini client helpers (shared by every Gemini-powered tool: SRT, Image→Prompt).
//
// Key rules:
//  - The browser may send the user's OWN key in the "x-gemini-api-key" header.
//    It is used for that request only — never stored, logged or echoed.
//  - Otherwise the server key GEMINI_API_KEY is used, but only for logged-in users
//    (so anonymous visitors cannot spend your quota).
//  - Key format is NOT restricted to a prefix ("AIza…", "AQ.…", future formats).
import { AppError, redact } from "./AppError.js";

// Test seam: tests replace deps.createClient with a fake client.
export const deps = {
  async createClient(apiKey) {
    let sdk;
    try {
      sdk = await import("@google/genai");
    } catch {
      throw new AppError(
        500,
        "SDK_MISSING",
        "The @google/genai package is not installed on the server. Run npm install."
      );
    }
    return new sdk.GoogleGenAI({ apiKey });
  },
};

export const KEY_PATTERN = /^[\x21-\x7E]{8,512}$/;

export function getModels() {
  return {
    transcribe: process.env.GEMINI_TRANSCRIBE_MODEL || "gemini-3.5-transcribe",
    general: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  };
}

export function isValidKeyFormat(key) {
  return typeof key === "string" && KEY_PATTERN.test(key);
}

export function serverKeyConfigured() {
  return Boolean((process.env.GEMINI_API_KEY || "").trim());
}

// resolveGeminiKey(req) → { key, source: "user" | "server" } or throws AppError.
export function resolveGeminiKey(req) {
  const userKey = String(req.get?.("x-gemini-api-key") ?? req.headers?.["x-gemini-api-key"] ?? "").trim();

  if (userKey) {
    if (!isValidKeyFormat(userKey)) {
      throw new AppError(
        400,
        "INVALID_API_KEY_FORMAT",
        "The Gemini API key looks invalid (too short, or it contains spaces/odd characters). Please copy it again."
      );
    }
    return { key: userKey, source: "user" };
  }

  // The key the user saved in their account (set by the key middleware after decrypting).
  if (req.savedGeminiKey) return { key: req.savedGeminiKey, source: "account" };

  // The site's key: set by the admin in the admin panel (or GEMINI_API_KEY). Tools that cost tokens are
  // guarded by login + a paid job elsewhere, so a guest may use this key only on the free tools.
  const serverKey = (req.adminGeminiKey?.key || process.env.GEMINI_API_KEY || "").trim();
  if (!serverKey) {
    throw new AppError(
      503,
      "NO_SERVER_KEY",
      "The Gemini API key is not set up yet. Please ask the site admin to add it."
    );
  }
  return { key: serverKey, source: "server" };
}

// Converts any SDK/network error into an AppError with a safe, helpful message.
export function mapGeminiError(err) {
  if (err instanceof AppError) return err;
  const raw = redact(err?.message || String(err));
  const lower = raw.toLowerCase();
  const status = Number(err?.status || err?.code || err?.statusCode) || 0;

  if (
    status === 401 ||
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid") ||
    lower.includes("invalid api key") ||
    (status === 400 && lower.includes("api key"))
  ) {
    return new AppError(401, "INVALID_API_KEY", "The Gemini API key is invalid or expired.");
  }
  if (status === 403) {
    return new AppError(403, "KEY_FORBIDDEN", "This key is not allowed to use this Gemini model/API (403).");
  }
  if (status === 429 || lower.includes("resource_exhausted") || lower.includes("quota")) {
    return new AppError(429, "QUOTA_EXCEEDED", "Gemini quota / rate limit reached. Please wait a moment or use another key.");
  }
  if (status === 404 || lower.includes("is not found") || lower.includes("not supported for")) {
    return new AppError(502, "MODEL_NOT_FOUND", "The Gemini model is not available for this key.", raw.slice(0, 300));
  }
  if (status >= 500 || lower.includes("unavailable") || lower.includes("overloaded")) {
    return new AppError(503, "GEMINI_UNAVAILABLE", "Gemini is temporarily unavailable. Please try again.");
  }
  if (lower.includes("fetch failed") || lower.includes("enotfound") || lower.includes("etimedout")) {
    return new AppError(502, "GEMINI_NETWORK", "The server could not reach the Gemini API.");
  }
  return new AppError(502, "GEMINI_ERROR", `Gemini returned an error: ${raw.slice(0, 300)}`);
}

// Cheap key check: models.get does not consume generation quota.
export async function validateGeminiKey(key) {
  const client = await deps.createClient(key);
  const { transcribe, general } = getModels();
  try {
    await client.models.get({ model: transcribe });
    return { valid: true, model: transcribe };
  } catch (err) {
    const mapped = mapGeminiError(err);
    if (mapped.code !== "MODEL_NOT_FOUND") throw mapped;
    try {
      await client.models.get({ model: general });
    } catch (err2) {
      throw mapGeminiError(err2);
    }
    return {
      valid: true,
      model: general,
      note: `Model "${transcribe}" is not available for this key; "${general}" will be used instead.`,
    };
  }
}

export function extractText(response) {
  if (typeof response?.output_text === "string") return response.output_text;
  try {
    if (typeof response?.text === "string") return response.text;
  } catch {
    /* getter may throw when there is no text part */
  }
  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) return parts.map((p) => p.text || "").join("");
  return "";
}

// Parses JSON that a model may have wrapped in ``` fences or extra prose.
export function parseModelJson(text) {
  const raw = String(text || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/[\[{][\s\S]*[\]}]/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fall through */
      }
    }
  }
  throw new AppError(502, "BAD_MODEL_OUTPUT", "Gemini did not return valid JSON. Please try again.");
}
