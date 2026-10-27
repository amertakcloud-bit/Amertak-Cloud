import crypto from "node:crypto";

// Telegram "Log In With Telegram" = OpenID Connect (authorization-code flow + PKCE S256).
// Docs: https://core.telegram.org/bots/telegram-login
//   authorize : https://oauth.telegram.org/auth
//   token     : https://oauth.telegram.org/token   (HTTP Basic client auth)
//   JWKS      : https://oauth.telegram.org/.well-known/jwks.json   (no userinfo endpoint)
export const ISSUER = "https://oauth.telegram.org";
export const AUTH_URL = `${ISSUER}/auth`;
export const TOKEN_URL = `${ISSUER}/token`;
export const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;

export const deps = { fetch: (...a) => globalThis.fetch(...a) }; // replaceable in tests

const b64url = (buf) => Buffer.from(buf).toString("base64url");
export const newState = () => b64url(crypto.randomBytes(24));
export const newVerifier = () => b64url(crypto.randomBytes(48)); // 64 chars (RFC 7636: 43–128)
export const challengeOf = (verifier) => b64url(crypto.createHash("sha256").update(verifier).digest());

export const telegramConfig = () => ({
  clientId: String(process.env.TELEGRAM_CLIENT_ID || "").trim(),
  clientSecret: String(process.env.TELEGRAM_CLIENT_SECRET || "").trim(),
});
export const isConfigured = () => {
  const c = telegramConfig();
  return Boolean(c.clientId && c.clientSecret);
};

export function buildAuthUrl({ clientId, redirectUri, state, verifier, scope = "openid profile" }) {
  const q = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope,
    state, code_challenge: challengeOf(verifier), code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${q}`;
}

// Server-side code → tokens exchange (the client secret never leaves the server).
export async function exchangeCode({ code, redirectUri, verifier, clientId, clientSecret }) {
  const res = await deps.fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier }),
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.id_token) throw new Error(`token endpoint ${res.status}: ${body?.error || "no id_token"}`);
  return body;
}

let jwksCache = { at: 0, keys: [] };
async function getKeys(force = false) {
  if (!force && jwksCache.keys.length && Date.now() - jwksCache.at < 10 * 60 * 1000) return jwksCache.keys;
  const res = await deps.fetch(JWKS_URL, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const { keys } = await res.json();
  if (!Array.isArray(keys) || !keys.length) throw new Error("jwks empty");
  jwksCache = { at: Date.now(), keys };
  return keys;
}
export const resetJwksCache = () => { jwksCache = { at: 0, keys: [] }; };

// Verifies the ID token with node:crypto (no JWT library): signature against Telegram's JWKS, then
// iss, aud (= your client id / bot id) and exp. Only RS256 / ES256 are accepted — never "none" or HS*.
// Returns the claims.
export async function verifyIdToken(idToken, clientId, now = Date.now()) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new Error("malformed id_token");
  let header, claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  } catch { throw new Error("malformed id_token"); }
  const { kid, alg } = header;
  if (alg !== "RS256" && alg !== "ES256") throw new Error(`unsupported alg ${alg}`);

  const pick = (keys) => keys.find((k) => (!kid || k.kid === kid) && (!k.alg || k.alg === alg));
  let jwk = pick(await getKeys());
  if (!jwk) jwk = pick(await getKeys(true)); // key rotation
  if (!jwk) throw new Error("signing key not found");

  const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const okSig = crypto.verify("sha256", Buffer.from(`${parts[0]}.${parts[1]}`), alg === "ES256" ? { key, dsaEncoding: "ieee-p1363" } : key, Buffer.from(parts[2], "base64url"));
  if (!okSig) throw new Error("bad signature");

  const sec = Math.floor(now / 1000);
  if (claims.iss !== ISSUER) throw new Error("bad issuer");
  const aud = Array.isArray(claims.aud) ? claims.aud.map(String) : [String(claims.aud)];
  if (!aud.includes(String(clientId))) throw new Error("bad audience");
  if (typeof claims.exp !== "number" || claims.exp < sec - 30) throw new Error("id_token expired");
  if (typeof claims.nbf === "number" && claims.nbf > sec + 30) throw new Error("id_token not yet valid");
  return claims;
}
