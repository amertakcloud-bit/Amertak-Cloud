import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../lib/AppError.js";

// Signed, expiring tokens so /api/video/proxy can only fetch URLs that WE resolved
// (it is not an open proxy).
function secret() {
  return process.env.VIDEO_SIGN_SECRET || process.env.SESSION_SECRET || "insecure-dev-secret-change-me";
}
const b64 = (b) => Buffer.from(b).toString("base64url");
const mac = (p) => createHmac("sha256", secret()).update(p).digest("base64url");

export function signMediaToken({ url, name }, ttlSeconds = 30 * 60, now = Date.now()) {
  const payload = b64(JSON.stringify({ u: url, n: name || "download", e: Math.floor(now / 1000) + ttlSeconds }));
  return `${payload}.${mac(payload)}`;
}

export function verifyMediaToken(token, now = Date.now()) {
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig) throw new AppError(400, "INVALID_TOKEN", "Invalid download link.");
  const a = Buffer.from(sig), b = Buffer.from(mac(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError(400, "INVALID_TOKEN", "Invalid download link.");
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new AppError(400, "INVALID_TOKEN", "Invalid download link.");
  }
  if (!data.e || data.e < Math.floor(now / 1000)) throw new AppError(410, "TOKEN_EXPIRED", "This download link has expired. Fetch the video again.");
  return { url: data.u, name: data.n };
}
