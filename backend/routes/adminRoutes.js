import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  adminLogin,
  adminLogout,
  adminMe,
  listUsers,
  getUserDetail,
  addTokens,
  getGeminiSetting,
  putGeminiSetting,
  deleteGeminiSetting,
  testGeminiSetting,
  sendBroadcast,
  setRole,
  setBan,
  listPayments,
  adminStats,
  deductTokens,
  listAudit,
  userLedger,
  listPromoCodes,
  createPromoCode,
  deletePromoCode,
  activatePromoCode,
  deactivatePromoCode,
  usePromoCode,
} from "../controllers/adminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { protectAdmin } from "../middleware/adminAuthMiddleware.js";
import { requirePerm } from "../middleware/permissions.js";

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
adminProtectedRouter.use(protect);

// Each route names the permission it needs (lib/permissions.js): admin = everything,
// support = read/suspend users + audit, finance = read users, adjust tokens, ledger, payments, stats.
const admin = protectAdmin;
adminProtectedRouter.get("/users", requirePerm("users.read"), listUsers);
adminProtectedRouter.get("/users/:userId", requirePerm("users.read"), getUserDetail);
adminProtectedRouter.post("/users/:userId/tokens", requirePerm("tokens.adjust"), addTokens);
adminProtectedRouter.post("/users/:userId/tokens/deduct", requirePerm("tokens.adjust"), deductTokens);
adminProtectedRouter.get("/users/:userId/ledger", requirePerm("ledger.read"), userLedger);
adminProtectedRouter.post("/users/:userId/role", admin, setRole);
adminProtectedRouter.post("/users/:userId/ban", requirePerm("users.ban"), setBan);
adminProtectedRouter.get("/audit", requirePerm("audit.read"), listAudit);
adminProtectedRouter.get("/payments", requirePerm("payments.read"), listPayments);
adminProtectedRouter.get("/stats", requirePerm("stats.read"), adminStats);
adminProtectedRouter.get("/settings/gemini", admin, getGeminiSetting);
adminProtectedRouter.put("/settings/gemini", admin, putGeminiSetting);
adminProtectedRouter.delete("/settings/gemini", admin, deleteGeminiSetting);
adminProtectedRouter.post("/settings/gemini/test", admin, testGeminiSetting);
adminProtectedRouter.post("/broadcast", admin, sendBroadcast);
adminProtectedRouter.get("/promo-codes", admin, listPromoCodes);
adminProtectedRouter.post("/promo-codes", admin, createPromoCode);
adminProtectedRouter.delete("/promo-codes/:id", admin, deletePromoCode);
adminProtectedRouter.post("/promo-codes/:id/activate", admin, activatePromoCode);
adminProtectedRouter.post("/promo-codes/:id/deactivate", admin, deactivatePromoCode);
adminProtectedRouter.post("/promo-codes/:id/use", admin, usePromoCode);

router.use("/", adminProtectedRouter);

export default router;
