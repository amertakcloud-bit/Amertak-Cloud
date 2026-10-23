import { Router } from "express";
import { getTtsStatus, synthesizeText } from "../controllers/ttsController.js";
import { ttsLimiter } from "../middleware/rateLimiters.js";

const router = Router();
router.get("/", getTtsStatus);
router.get("/voices", getTtsStatus);
router.post("/", ttsLimiter, synthesizeText);
router.post("/synthesize", ttsLimiter, synthesizeText);
export default router;
