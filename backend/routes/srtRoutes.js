import { Router } from "express";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { requireGeminiKey } from "../middleware/geminiKey.js";
import { srtLimiter } from "../middleware/rateLimiters.js";
import { uploadAudioChunk } from "../middleware/uploads.js";
import {
  alignHandler,
  buildCuesHandler,
  exportSrt,
  getStatus,
  transcribeChunkHandler,
  validateKey,
} from "../controllers/srtController.js";

const router = Router();

router.get("/status", optionalAuth, getStatus);
router.post("/validate-key", srtLimiter, validateKey);
router.post("/chunk", srtLimiter, optionalAuth, requireGeminiKey, uploadAudioChunk, transcribeChunkHandler);
router.post("/cues", srtLimiter, buildCuesHandler);
router.post("/align", srtLimiter, alignHandler);
router.post("/export", srtLimiter, exportSrt);

export default router;
