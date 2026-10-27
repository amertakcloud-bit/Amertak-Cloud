import { Router } from "express";
import { deleteGeminiKey, getDashboard, getGeminiKeyStatus, getMe, saveGeminiKey, updateMe } from "../controllers/userController.js";
import { listLedger, listNotifications, markAllRead, markRead } from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

// All user routes require a valid auth cookie.
router.get("/me", protect, getMe);
router.put("/me", protect, updateMe);

router.get("/dashboard", protect, getDashboard);
router.get("/notifications", protect, listNotifications);
router.post("/notifications/read-all", protect, markAllRead);
router.post("/notifications/:id/read", protect, markRead);
router.get("/ledger", protect, listLedger);
router.get("/gemini-key", protect, getGeminiKeyStatus);
router.put("/gemini-key", protect, saveGeminiKey);
router.delete("/gemini-key", protect, deleteGeminiKey);

export default router;
