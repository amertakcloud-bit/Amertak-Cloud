import { RATES, chargeTokens, refundTokens, tokensForBytes } from "../lib/billing.js";
import { CLOUDSHARE_MAX_BYTES, isCloudShareAvailable, createCloudShareRecord, findCloudShareRecord, getCloudShareConfig, incrementCloudShareDownloadCount, toPublicCloudShareRecord } from "../services/cloudShareService.js";

const MAX_FILE_SIZE = CLOUDSHARE_MAX_BYTES;

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
      error: { code: "STORAGE_UNAVAILABLE", message: "CloudShare is not set up on this server (set CLOUD_MONGODB_URI, or CLOUD_DATABASE_PATH for local SQLite)." },
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

  // 2 tokens per MB, rounded UP to whole tokens (5 MB = 10 tokens). Refunded if storing fails.
  const cost = tokensForBytes(req.file.size, RATES.cloudSharePerMB);
  let balance;
  try {
    balance = await chargeTokens(req.user._id, cost, "cloudshare");
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || "INTERNAL_ERROR", message: err.message },
    });
  }

  try {
    const record = await createCloudShareRecord({
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      buffer: req.file.buffer,
      expiresIn: req.body?.expiresIn,
    });

    const baseUrl = process.env.PUBLIC_URL || process.env.SERVER_URL || `${req.protocol}://${req.get("host")}`;
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
      cost,
      tokens: balance,
    });
  } catch (error) {
    await refundTokens(req.user._id, cost, "cloudshare").catch(() => {});
    const code = ["INVALID_EXPIRATION", "STORAGE_UNAVAILABLE"].includes(error.code) ? error.code : "INTERNAL_ERROR";
    return res.status(code === "INVALID_EXPIRATION" ? 400 : code === "STORAGE_UNAVAILABLE" ? 503 : 500).json({
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
    return res.status(error.code === "STORAGE_UNAVAILABLE" ? 503 : error.status || 500).json({
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
    const record = await findCloudShareRecord(shareId, { withData: true });
    if (!record) {
      throw makeError(404, "FILE_NOT_FOUND", "The requested file was not found or has expired.");
    }
    await incrementCloudShareDownloadCount(shareId);

    const d = record.data;
    const buf = Buffer.isBuffer(d) ? d : Buffer.isBuffer(d?.buffer) ? d.buffer : Buffer.from(d);
    const safe = record.originalName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
    res.setHeader("Content-Type", record.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(record.originalName)}`);
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader("Cache-Control", "private, no-store");
    res.end(buf);
  } catch (error) {
    return res.status(error.code === "STORAGE_UNAVAILABLE" ? 503 : error.status || 500).json({
      success: false,
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: error.message || "Unable to download the file.",
      },
    });
  }
}
