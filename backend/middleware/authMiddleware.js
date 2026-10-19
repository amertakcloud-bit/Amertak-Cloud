import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const AUTH_COOKIE = "auth_token";

function getJwtSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  console.warn(
    "[Auth] SESSION_SECRET is not set — using an insecure fallback. Set it in server/.env."
  );
  return "insecure-dev-secret-change-me";
}

// signToken
// Creates a signed JWT that is only ever sent inside an HTTP-only cookie.
export function signToken(userId) {
  return jwt.sign({ id: userId }, getJwtSecret(), { expiresIn: "7d" });
}

// cookieOptions
// Shared options so login/refresh and logout clear the same cookie.
export function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd, // requires HTTPS
    sameSite: isProd ? "none" : "lax", // "none" needed for cross-site prod deployments
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

// protect
// Verifies the HTTP-only auth cookie and attaches the user to req.user.
// Used to guard private API routes (401 when missing/invalid).
export async function protect(req, res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated. Please log in.",
      });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Session no longer valid. Please log in again.",
      });
    }

    req.user = user;
    return next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session. Please log in again.",
    });
  }
}
