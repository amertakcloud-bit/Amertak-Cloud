import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  adminLogin,
  adminLogout,
  adminMe,
  listUsers,
  getUserDetail,
  addTokens,
  listPromoCodes,
  createPromoCode,
  deletePromoCode,
  activatePromoCode,
  deactivatePromoCode,
  usePromoCode,
} from "../controllers/adminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { protectAdmin } from "../middleware/adminAuthMiddleware.js";

const router = Router();

// Rate limiting for admin auth
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many admin auth attempts. Please wait a moment.",
  },
});

// Admin authentication (login/logout/me) — /auth/me requires a valid session
router.post("/auth/login", adminLimiter, adminLogin);
router.post("/auth/logout", adminLogout);
router.get("/auth/me", protect, adminMe);

// All other admin routes require a valid session AND the admin role
const adminProtectedRouter = Router();
adminProtectedRouter.use(protect, protectAdmin);

adminProtectedRouter.get("/users", listUsers);
adminProtectedRouter.get("/users/:userId", getUserDetail);
adminProtectedRouter.post("/users/:userId/tokens", addTokens);
adminProtectedRouter.get("/promo-codes", listPromoCodes);
adminProtectedRouter.post("/promo-codes", createPromoCode);
adminProtectedRouter.delete("/promo-codes/:id", deletePromoCode);
adminProtectedRouter.post("/promo-codes/:id/activate", activatePromoCode);
adminProtectedRouter.post("/promo-codes/:id/deactivate", deactivatePromoCode);
adminProtectedRouter.post("/promo-codes/:id/use", usePromoCode);

router.use("/", adminProtectedRouter);

export default router;
