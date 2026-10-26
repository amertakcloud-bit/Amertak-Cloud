import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createPayment, claimPayment, paymentStatus, khqrWebhook } from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

// Payment endpoints are authenticated + rate limited.
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many payment requests. Please wait a moment and try again.",
  },
});

// Public, signed by KHQR.dev (see khqrWebhook) — no login, no rate limiter that could drop real events.
router.post("/webhook", khqrWebhook);
router.get("/:md5/status", protect, paymentStatus);
router.post("/", paymentLimiter, protect, createPayment);
router.post("/claim", paymentLimiter, protect, claimPayment);

export default router;
