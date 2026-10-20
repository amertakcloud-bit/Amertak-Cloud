import rateLimit from "express-rate-limit";

// Per-IP limits for the tool APIs. (On serverless the counters are per instance, so
// treat them as a safety net, not as strict billing control.)
function limiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, code: "RATE_LIMITED", message },
  });
}

const TEN_MIN = 10 * 60 * 1000;

// SRT sends many chunks per file (≈ 1 per 100 s of audio) → generous limit.
export const srtLimiter = limiter({ windowMs: TEN_MIN, limit: 240, message: "Too many subtitle requests. Please wait a few minutes." });
export const aiLimiter = limiter({ windowMs: TEN_MIN, limit: 40, message: "Too many AI requests. Please wait a few minutes." });
export const lightLimiter = limiter({ windowMs: TEN_MIN, limit: 200, message: "Too many requests. Please slow down." });
export const downloadLimiter = limiter({ windowMs: TEN_MIN, limit: 60, message: "Too many download requests. Please wait a few minutes." });
export const ttsLimiter = limiter({ windowMs: TEN_MIN, limit: 300, message: "Too many voice requests. Please wait a few minutes." });
