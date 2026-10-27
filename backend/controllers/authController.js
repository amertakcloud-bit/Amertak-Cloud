import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import * as telegramOidc from "../lib/telegramOidc.js";
import User from "../models/User.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import { signToken, cookieOptions, AUTH_COOKIE } from "../middleware/authMiddleware.js";

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const clientUrl = () => process.env.CLIENT_URL || "http://localhost:5173";

// Never send the password hash (or internals) to the client.
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

// Sets only the HTTP-only cookie (used by flows that redirect instead of JSON).
function setAuthCookie(res, user) {
  const token = signToken(user._id.toString());
  res.cookie(AUTH_COOKIE, token, cookieOptions());
  return token;
}

// Sets the HTTP-only secure cookie + returns the user as JSON.
function sendToken(res, user, statusCode = 200) {
  const token = setAuthCookie(res, user);
  return res.status(statusCode).json({
    success: true,
    data: { user: toPublicUser(user), token },
  });
}

function validateRegister({ name, email, password, confirmPassword }) {
  const errors = [];

  if (!name || String(name).trim().length < 2) {
    errors.push("Name must be at least 2 characters.");
  } else if (String(name).trim().length > 60) {
    errors.push("Name must be at most 60 characters.");
  }

  if (!email || !EMAIL_REGEX.test(String(email).trim())) {
    errors.push("Please enter a valid email address.");
  }

  if (!password) {
    errors.push("Password is required.");
  } else if (String(password).length < 8) {
    errors.push("Password must be at least 8 characters.");
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    errors.push("Passwords do not match.");
  }

  return errors;
}

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword } = req.body || {};

  const errors = validateRegister({ name, email, password, confirmPassword });
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0], errors });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: "An account with this email already exists. Please log in instead.",
    });
  }

  try {
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password,
      provider: "local",
    });

    // Credit free plan tokens (150) upon registration.
    await User.updateOne(
      { _id: user._id },
      { $set: { tokens: 150 } }
    );

    // Re-fetch the user so the response includes the credited free-plan tokens.
    const updatedUser = await User.findById(user._id);

    return sendToken(res, updatedUser, 201);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists. Please log in instead.",
      });
    }
    throw error;
  }
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required.",
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select("+password");

  // Same generic message for "unknown email" and "wrong password"
  // so attackers cannot discover which accounts exist.
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  if (!user.password) {
    return res.status(401).json({
      success: false,
      message: "This account uses Google sign-in. Please continue with Google.",
    });
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  // Credit free plan tokens (150) upon login if the account has a lower balance.
  if (user.tokens < 150) {
    await User.updateOne(
      { _id: user._id },
      { $set: { tokens: 150 } }
    );
    // Re-fetch the user so the response reflects the credited free-plan tokens.
    const updatedUser = await User.findById(user._id);
    return sendToken(res, updatedUser, 200);
  }

  return sendToken(res, user, 200);
});

// POST /api/auth/logout
export const logout = asyncHandler(async (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  return res.status(200).json({ success: true, message: "Logged out successfully." });
});

// GET /api/auth/me  (protected)
export const getMe = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    data: { user: toPublicUser(req.user) },
  });
});

// POST /api/auth/forgot-password
// Always answers with the same generic message (no account enumeration).
// NOTE: no email is actually sent — SMTP delivery is not configured yet.
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body || {};

  if (!email || !EMAIL_REGEX.test(String(email).trim())) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid email address.",
    });
  }

  return res.status(200).json({
    success: true,
    message:
      "If an account exists with this email, password reset instructions have been sent.",
  });
});

// GET /api/auth/google/callback (passport success handler)
// Stores the JWT cookie, then redirects the browser back to the dashboard.
export function googleCallback(req, res) {
  if (!req.user) {
    return res.redirect(`${clientUrl()}/login?error=google_failed`);
  }
  const token = setAuthCookie(res, req.user);
  // The token in the URL fragment (never sent to servers/logs) lets the frontend keep the
  // session when the browser blocks the cross-site cookie.
  return res.redirect(`${clientUrl()}/dashboard#token=${encodeURIComponent(token)}`);
}

// GET /api/auth/google | /google/callback when OAuth is not configured
export function googleNotConfigured(_req, res) {
  return res.status(503).json({
    success: false,
    message:
      "Google login is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env.",
  });
}

// ───────── Telegram login: OpenID Connect (code flow + PKCE) ─────────
// The state + PKCE verifier live in a short-lived, signed, HTTP-only cookie (serverless-safe: no memory/DB).
const TG_COOKIE = "tg_oidc";
const tgCookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/telegram", maxAge: 10 * 60 * 1000 });
const tgSecret = () => process.env.SESSION_SECRET || "insecure-dev-secret-change-me";

// Must be registered EXACTLY in @BotFather → Bot Settings → Login Widget → Allowed URLs.
export function telegramRedirectUri(req) {
  const fixed = process.env.TELEGRAM_REDIRECT_URI || process.env.TELEGRAM_CALLBACK_URL;
  if (fixed) return fixed;
  const proto = String(req.headers?.["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
  const host = String(req.headers?.["x-forwarded-host"] || req.get?.("host") || "").split(",")[0].trim();
  return `${proto}://${host}/api/auth/telegram/callback`;
}

// GET /api/auth/telegram → redirects the browser to Telegram
export function telegramLogin(req, res) {
  if (!telegramOidc.isConfigured()) return res.redirect(`${clientUrl()}/login?error=telegram_not_configured`);
  const { clientId } = telegramOidc.telegramConfig();
  const state = telegramOidc.newState();
  const verifier = telegramOidc.newVerifier();
  res.cookie(TG_COOKIE, jwt.sign({ state, verifier }, tgSecret(), { expiresIn: "10m" }), tgCookieOptions());
  return res.redirect(telegramOidc.buildAuthUrl({ clientId, redirectUri: telegramRedirectUri(req), state, verifier }));
}

// GET /api/auth/telegram/callback?code&state  (or ?error=…)
export async function telegramCallback(req, res) {
  const fail = (why) => {
    console.warn("[Telegram] login failed:", why);
    res.clearCookie(TG_COOKIE, { ...tgCookieOptions(), maxAge: undefined });
    return res.redirect(`${clientUrl()}/login?error=telegram_failed`);
  };
  try {
    if (!telegramOidc.isConfigured()) return res.redirect(`${clientUrl()}/login?error=telegram_not_configured`);
    const { clientId, clientSecret } = telegramOidc.telegramConfig();
    if (req.query.error) return fail(`provider error: ${String(req.query.error).slice(0, 60)}`);
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code || !state) return fail("missing code/state");

    // 1) state + PKCE verifier from our own signed cookie (CSRF / login-fixation protection)
    let saved;
    try { saved = jwt.verify(req.cookies?.[TG_COOKIE] || "", tgSecret()); } catch { return fail("state cookie missing/expired"); }
    const a = Buffer.from(String(saved.state)); const b = Buffer.from(state);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return fail("state mismatch");
    res.clearCookie(TG_COOKIE, { ...tgCookieOptions(), maxAge: undefined });

    // 2) code → tokens (server-side, client secret via HTTP Basic) and 3) verify the ID token cryptographically
    const tokens = await telegramOidc.exchangeCode({ code, redirectUri: telegramRedirectUri(req), verifier: saved.verifier, clientId, clientSecret });
    const claims = await telegramOidc.verifyIdToken(tokens.id_token, clientId);

    const telegramId = String(claims.id ?? claims.sub ?? "");
    if (!/^\d{1,20}$/.test(telegramId)) return fail("no valid telegram id");
    const name = String(claims.name || [claims.given_name, claims.family_name].filter(Boolean).join(" ") || claims.preferred_username || "Telegram User").trim().slice(0, 60) || "Telegram User";
    const picture = typeof claims.picture === "string" && /^https:\/\//.test(claims.picture) ? claims.picture : "";

    // 4) find (by verified Telegram id only) or create the account
    let user = await User.findOne({ telegramId });
    if (user) {
      if (!user.avatar && picture) { user.avatar = picture; await user.save(); }
    } else {
      user = await User.create({ name, email: `telegram_${telegramId}@telegram.local`, provider: "telegram", telegramId, avatar: picture });
      await User.updateOne({ _id: user._id }, { $set: { tokens: 150 } }); // same free-plan tokens as email sign-up
    }

    // 5) our own session (same as Google: HTTP-only cookie + #token fragment fallback)
    const token = setAuthCookie(res, user);
    return res.redirect(`${clientUrl()}/dashboard#token=${encodeURIComponent(token)}`);
  } catch (err) {
    return fail(err?.message || "unexpected error");
  }
}
