import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import { dbReady } from "../middleware/dbReady.js";
import { requireGeminiKey } from "../middleware/geminiKey.js";
import { aiLimiter, lightLimiter } from "../middleware/rateLimiters.js";
import { create, list, read, remove, translate, update } from "../controllers/editorController.js";

const router = Router();

router.use(dbReady, protect);
router.get("/projects", lightLimiter, list);
router.post("/projects", lightLimiter, create);
router.get("/projects/:id", lightLimiter, read);
router.put("/projects/:id", lightLimiter, update);
router.delete("/projects/:id", lightLimiter, remove);
router.post("/translate", aiLimiter, requireGeminiKey, translate);

export default router;
