import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, "..");
// On Vercel the project directory is read-only and /tmp is wiped between invocations, so
// CloudShare is only available there when CLOUDSHARE_STORAGE_DIR points at a persistent
// writable volume (it normally does not) — see Deployment.md.
const STORAGE_ROOT = process.env.CLOUDSHARE_STORAGE_DIR ? path.resolve(process.env.CLOUDSHARE_STORAGE_DIR) : SERVER_ROOT;
const STORAGE_DIR = process.env.CLOUDSHARE_STORAGE_DIR ? path.join(STORAGE_ROOT, "files") : path.join(SERVER_ROOT, "uploads");
const METADATA_PATH = path.join(STORAGE_ROOT, process.env.CLOUDSHARE_STORAGE_DIR ? "" : "data", "cloudshare-metadata.json");

export function isCloudShareAvailable() {
  return !process.env.VERCEL || Boolean(process.env.CLOUDSHARE_STORAGE_DIR);
}

const EXPIRY_OPTIONS = Object.freeze({
  never: null,
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
});

let records = [];

async function ensureStorage() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  await fs.mkdir(path.dirname(METADATA_PATH), { recursive: true });

  try {
    const raw = await fs.readFile(METADATA_PATH, "utf8");
    if (raw.trim()) {
      const parsed = JSON.parse(raw);
      records = Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function persistMetadata() {
  await fs.writeFile(METADATA_PATH, JSON.stringify(records, null, 2), "utf8");
}

function sanitizeFilename(name) {
  const fileName = String(name || "upload")
    .replace(/[\\/<>:"|?*\u0000-\u001F]/g, "_")
    .trim();

  return fileName || "upload";
}

function getExpiresAt(expiresIn) {
  const key = String(expiresIn || "never").toLowerCase();

  if (!Object.prototype.hasOwnProperty.call(EXPIRY_OPTIONS, key)) {
    const error = new Error("Invalid expiration option.");
    error.code = "INVALID_EXPIRATION";
    throw error;
  }

  const duration = EXPIRY_OPTIONS[key];
  if (duration === null) return null;

  return new Date(Date.now() + duration).toISOString();
}

function isExpired(record) {
  return Boolean(record.expiresAt) && new Date(record.expiresAt).getTime() <= Date.now();
}

export async function pruneExpiredFiles() {
  await ensureStorage();

  const remaining = [];
  for (const record of records) {
    if (isExpired(record)) {
      try {
        await fs.unlink(record.storagePath).catch(() => {});
      } catch {
        // ignore cleanup failures; stale entries are removed below
      }
      continue;
    }

    remaining.push(record);
  }

  if (remaining.length !== records.length) {
    records = remaining;
    await persistMetadata();
  }
}

export async function createCloudShareRecord({ originalName, mimeType, buffer, expiresIn }) {
  await ensureStorage();

  const safeName = sanitizeFilename(originalName);
  let shareId = "";
  let storagePath = "";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    shareId = crypto.randomBytes(8).toString("hex");
    storagePath = path.join(STORAGE_DIR, `${shareId}${path.extname(safeName) || ""}`);

    if (!records.some((record) => record.shareId === shareId)) {
      break;
    }
  }

  await fs.writeFile(storagePath, buffer);

  const record = {
    shareId,
    originalName: safeName,
    mimeType: mimeType || "application/octet-stream",
    size: buffer.length,
    storagePath,
    downloadCount: 0,
    createdAt: new Date().toISOString(),
    expiresAt: getExpiresAt(expiresIn),
  };

  records.push(record);
  await persistMetadata();
  return record;
}

export function getCloudShareConfig() {
  return {
    available: isCloudShareAvailable(),
    maxFileSizeMB: Number(process.env.MAX_FILE_SIZE_MB || 100),
    maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_MB || 100) * 1024 * 1024,
    expirationOptions: Object.keys(EXPIRY_OPTIONS),
  };
}

export async function findCloudShareRecord(shareId) {
  await pruneExpiredFiles();

  const record = records.find((item) => item.shareId === shareId);
  if (!record) {
    return null;
  }

  if (isExpired(record)) {
    await pruneExpiredFiles();
    return null;
  }

  return record;
}

export async function incrementCloudShareDownloadCount(shareId) {
  const record = await findCloudShareRecord(shareId);
  if (!record) {
    return null;
  }

  const index = records.findIndex((item) => item.shareId === shareId);
  if (index !== -1) {
    records[index].downloadCount = Number(records[index].downloadCount || 0) + 1;
    await persistMetadata();
  }

  return records[index];
}

export function toPublicCloudShareRecord(record) {
  return {
    shareId: record.shareId,
    name: record.originalName,
    size: record.size,
    mimeType: record.mimeType,
    downloadCount: record.downloadCount,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt || null,
  };
}

export { EXPIRY_OPTIONS };
