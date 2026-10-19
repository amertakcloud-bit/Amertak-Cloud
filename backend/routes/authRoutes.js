import { Router } from "express";
import passport from "passport";
import rateLimit from "express-rate-limit";
import {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  googleCallback,
  googleNotConfigured,
  telegramLogin,
  telegramCallback,
  telegramNotConfigured,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { isGoogleConfigured } from "../config/passport.js";

const router = Router();

// Basic authentication rate limiting: max 30 requests / 15 min per IP
// on register, login, forgot-password and the Google hand-off.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please wait a moment and try again.",
  },
});

// Local auth
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/logout", logout);
router.get("/me", protect, getMe);
router.post("/forgot-password", authLimiter, forgotPassword);

// Google OAuth
if (isGoogleConfigured) {
  router.get(
    "/google",
    authLimiter,
    passport.authenticate("google", { scope: ["profile", "email"], session: false })
  );

  router.get(
    "/google/callback",
    passport.authenticate("google", {
      session: false,
      failureRedirect: `${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=google_failed`,
    }),
    googleCallback
  );
} else {
  router.get("/google", googleNotConfigured);
  router.get("/google/callback", googleNotConfigured);
}

if (process.env.TELEGRAM_BOT_ID && process.env.TELEGRAM_BOT_TOKEN) {
  router.get("/telegram", authLimiter, telegramLogin);
  router.get("/telegram/callback", telegramCallback);
} else {
  router.get("/telegram", authLimiter, telegramNotConfigured);
  router.get("/telegram/callback", telegramNotConfigured);
}

export default router;
