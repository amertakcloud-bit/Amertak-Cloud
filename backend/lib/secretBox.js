import crypto from "node:crypto";

// AES-256-GCM encryption for secrets stored in the database (e.g. a user's Gemini key).
// The key is derived from KEY_ENCRYPTION_SECRET (or SESSION_SECRET). Format: v1.<iv>.<tag>.<data> (base64url).
function secret() {
  const s = process.env.KEY_ENCRYPTION_SECRET || process.env.SESSION_SECRET || "insecure-dev-secret-change-me";
  return crypto.createHash("sha256").update(`amertak-secretbox:${s}`).digest();
}

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", secret(), iv);
  const data = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

// Returns "" when the value is missing or cannot be decrypted (e.g. SESSION_SECRET changed).
export function decryptSecret(token) {
  try {
    const [v, iv, tag, data] = String(token || "").split(".");
    if (v !== "v1") return "";
    const d = crypto.createDecipheriv("aes-256-gcm", secret(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
  } catch {
    return "";
  }
}
