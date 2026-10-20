import { Router } from "express";
import { deleteGeminiKey, getGeminiKeyStatus, getMe, saveGeminiKey, updateMe } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

// All user routes require a valid auth cookie.
router.get("/me", protect, getMe);
router.put("/me", protect, updateMe);

router.get("/gemini-key", protect, getGeminiKeyStatus);
router.put("/gemini-key", protect, saveGeminiKey);
router.delete("/gemini-key", protect, deleteGeminiKey);

export default router;
