import { Router } from "express";
import multer from "multer";
import {
  downloadCloudShareFile,
  getCloudShareFileInfo,
  getCloudShareConfigHandler,
  uploadCloudShareFile,
} from "../controllers/cloudShareController.js";

import { CLOUDSHARE_MAX_BYTES } from "../services/cloudShareService.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CLOUDSHARE_MAX_BYTES + 1024,
  },
});

router.get("/config", getCloudShareConfigHandler);
router.post("/upload", upload.single("file"), uploadCloudShareFile);
router.get("/files/:shareId", getCloudShareFileInfo);
router.get("/files/:shareId/download", downloadCloudShareFile);

export default router;
