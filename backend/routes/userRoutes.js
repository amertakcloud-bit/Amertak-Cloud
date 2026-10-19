import { Router } from "express";
import { getMe, updateMe } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

// All user routes require a valid auth cookie.
router.get("/me", protect, getMe);
router.put("/me", protect, updateMe);

export default router;
