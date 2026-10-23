import { Router } from "express";
import rateLimit from "express-rate-limit";
import { redeemPromoCode } from "../controllers/promoController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

// Redemption is authenticated + rate limited (prevents brute-forcing codes).
const redeemLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many promo attempts. Please wait a moment and try again.",
  },
});

router.post("/redeem", redeemLimiter, protect, redeemPromoCode);

export default router;
