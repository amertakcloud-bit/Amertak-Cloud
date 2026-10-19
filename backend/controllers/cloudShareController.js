import { isCloudShareAvailable, createCloudShareRecord, findCloudShareRecord, getCloudShareConfig, incrementCloudShareDownloadCount, toPublicCloudShareRecord } from "../services/cloudShareService.js";
import fs from "node:fs";

const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE_MB || 100) * 1024 * 1024;

function makeError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export async function getCloudShareConfigHandler(_req, res) {
  res.json({
    success: true,
    config: getCloudShareConfig(),
  });
}

export async function uploadCloudShareFile(req, res) {
  if (!isCloudShareAvailable()) {
    return res.status(503).json({
      success: false,
      error: { code: "STORAGE_UNAVAILABLE", message: "CloudShare needs persistent file storage, which this deployment does not have." },
    });
  }
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { code: "NO_FILE", message: "Please attach a file in the file field." },
    });
  }

  if (req.file.size === 0) {
    return res.status(400).json({
      success: false,
      error: { code: "EMPTY_FILE", message: "The uploaded file is empty." },
    });
  }

  if (req.file.size > MAX_FILE_SIZE) {
    return res.status(413).json({
      success: false,
      error: { code: "FILE_TOO_LARGE", message: `The file exceeds the ${MAX_FILE_SIZE / (1024 * 1024)} MB limit.` },
    });
  }

  try {
    const record = await createCloudShareRecord({
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      buffer: req.file.buffer,
      expiresIn: req.body?.expiresIn,
    });

    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
    const downloadUrl = `${baseUrl}/api/cloudshare/files/${record.shareId}/download`;

    return res.status(201).json({
      success: true,
      file: {
        shareId: record.shareId,
        name: record.originalName,
        size: record.size,
        mimeType: record.mimeType,
        url: downloadUrl,
        downloadUrl,
        infoUrl: `${baseUrl}/api/cloudshare/files/${record.shareId}`,
        expiresAt: record.expiresAt || null,
      },
    });
  } catch (error) {
    const code = error.code === "INVALID_EXPIRATION" ? "INVALID_EXPIRATION" : "INTERNAL_ERROR";
    return res.status(error.code === "INVALID_EXPIRATION" ? 400 : 500).json({
      success: false,
      error: {
        code,
        message: error.message || "Unable to store the uploaded file.",
      },
    });
  }
}

export async function getCloudShareFileInfo(req, res) {
  const { shareId } = req.params;

  try {
    const record = await findCloudShareRecord(shareId);
    if (!record) {
      throw makeError(404, "FILE_NOT_FOUND", "The requested file was not found or has expired.");
    }

    return res.json({
      success: true,
      file: toPublicCloudShareRecord(record),
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: error.message || "Unable to fetch file info.",
      },
    });
  }
}

export async function downloadCloudShareFile(req, res) {
  const { shareId } = req.params;

  try {
    const record = await findCloudShareRecord(shareId);
    if (!record) {
      throw makeError(404, "FILE_NOT_FOUND", "The requested file was not found or has expired.");
    }

    const updatedRecord = await incrementCloudShareDownloadCount(shareId);
    if (!updatedRecord) {
      throw makeError(404, "FILE_NOT_FOUND", "The requested file was not found.");
    }

    const fileStream = fs.createReadStream(record.storagePath);
    fileStream.on("error", () => {
      if (!res.headersSent) {
        res.status(404).json({
          success: false,
          error: { code: "FILE_NOT_FOUND", message: "The file could not be accessed." },
        });
      }
    });

    res.setHeader("Content-Type", record.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(record.originalName)}"`);
    res.setHeader("Content-Length", String(record.size));
    res.setHeader("Cache-Control", "private, no-store");

    fileStream.pipe(res);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: error.message || "Unable to download the file.",
      },
    });
  }
}
