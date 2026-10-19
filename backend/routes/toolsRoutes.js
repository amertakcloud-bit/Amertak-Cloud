import { Router } from "express";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { requireGeminiKey } from "../middleware/geminiKey.js";
import { aiLimiter, downloadLimiter, lightLimiter } from "../middleware/rateLimiters.js";
import { uploadImage, uploadMedia } from "../middleware/uploads.js";
import { convertAudio, createImagePrompt, createQr, downloadVideo, getTools, resolveVideoLink } from "../controllers/toolsController.js";

const router = Router();

router.get("/tools", optionalAuth, getTools);
router.post("/qr", lightLimiter, createQr);
router.post("/image-prompt", aiLimiter, optionalAuth, requireGeminiKey, uploadImage, createImagePrompt);
router.post("/video/resolve", downloadLimiter, resolveVideoLink);
router.get("/video/download", downloadLimiter, downloadVideo);
router.post("/audio/convert", lightLimiter, uploadMedia, convertAudio);

export default router;
