import crypto from "node:crypto";
import User from "../models/User.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import { signToken, cookieOptions, AUTH_COOKIE } from "../middleware/authMiddleware.js";

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const clientUrl = () => process.env.CLIENT_URL || "http://localhost:5173";

function isTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_ID && process.env.TELEGRAM_BOT_TOKEN);
}

function buildTelegramUserName(profile) {
  const first = (profile?.first_name || "").trim();
  const last = (profile?.last_name || "").trim();
  const base = [first, last].filter(Boolean).join(" ") || profile?.username || "Telegram User";
  return base.trim().slice(0, 60) || "Telegram User";
}

function verifyTelegramHash(data, botToken) {
  const { hash, ...fields } = data || {};
  if (!hash || !botToken) return false;

  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const actualHash = Buffer.from(hash, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (actualHash.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualHash, expectedBuffer);
}

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

// GET /api/auth/telegram
export function telegramLogin(_req, res) {
  if (!isTelegramConfigured()) {
    return res.redirect(`${clientUrl()}/login?error=telegram_not_configured`);
  }

  const botId = encodeURIComponent(process.env.TELEGRAM_BOT_ID);
  const redirectUri = encodeURIComponent(
    `${process.env.TELEGRAM_CALLBACK_URL || `${process.env.SERVER_URL || "http://localhost:5000"}/api/auth/telegram/callback`}`
  );

  const authUrl = `https://oauth.telegram.org/auth?bot_id=${botId}&redirect_uri=${redirectUri}&request_access=write`;
  return res.redirect(authUrl);
}

// GET /api/auth/telegram/callback
export async function telegramCallback(req, res) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const botUsername = (process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "");

    if (!isTelegramConfigured()) {
      return res.redirect(`${clientUrl()}/login?error=telegram_not_configured`);
    }

    const payload = { ...req.query };
    const hash = payload.hash;
    if (!hash || !verifyTelegramHash(payload, botToken)) {
      return res.redirect(`${clientUrl()}/login?error=telegram_failed`);
    }

    const telegramId = String(payload.id || "");
    const firstName = String(payload.first_name || "");
    const lastName = String(payload.last_name || "");
    const username = String(payload.username || "").trim();
    const email = payload.email
      ? String(payload.email).trim().toLowerCase()
      : `telegram_${telegramId}@telegram.local`;

    if (!telegramId) {
      return res.redirect(`${clientUrl()}/login?error=telegram_failed`);
    }

    let user = await User.findOne({
      $or: [{ telegramId }, ...(email ? [{ email }] : [])],
    });

    if (user) {
      user.telegramId = telegramId;
      if (!user.email && email) user.email = email;
      if (!user.name) {
        user.name = [firstName, lastName].filter(Boolean).join(" ") || username || botUsername || "Telegram User";
      }
      if (!user.avatar && payload.photo_url) user.avatar = String(payload.photo_url);
      await user.save();
    } else {
      user = await User.create({
        name: [firstName, lastName].filter(Boolean).join(" ") || username || botUsername || "Telegram User",
        email,
        provider: "telegram",
        telegramId,
        avatar: payload.photo_url || "",
      });
    }

    setAuthCookie(res, user);
    return res.redirect(`${clientUrl()}/dashboard`);
  } catch (_error) {
    return res.redirect(`${clientUrl()}/login?error=telegram_failed`);
  }
}

export function telegramNotConfigured(_req, res) {
  return res.status(503).json({
    success: false,
    message:
      "Telegram login is not configured. Set TELEGRAM_BOT_ID, TELEGRAM_BOT_TOKEN, and TELEGRAM_BOT_USERNAME in server/.env.",
  });
}
