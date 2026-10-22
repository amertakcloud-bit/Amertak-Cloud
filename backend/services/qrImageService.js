import crypto from "node:crypto";
import { getCloudConnection, isCloudShareAvailable } from "./cloudShareService.js";

// Images that a QR code points to. Stored in the CLOUD database (CLOUD_MONGODB_URI).
// Only raster formats are accepted (no SVG → no script injection) and they are verified by magic bytes.
export const QR_IMAGE_MAX_BYTES = 3 * 1024 * 1024; // keeps multipart under Vercel's 4.5 MB body limit
export const QR_IMAGE_PER_USER = 50;

export function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

let Model = null;
export function __setQrImageModel(m) { Model = m; }

async function model() {
  if (Model) return Model;
  if (!isCloudShareAvailable()) {
    const e = new Error("Image storage is not configured (CLOUD_MONGODB_URI or CLOUD_DATABASE_PATH).");
    e.code = "STORAGE_UNAVAILABLE";
    throw e;
  }
  const conn = await getCloudConnection();
  const { cloudOdm } = await import("../lib/odm/index.js");
  const mongoose = await cloudOdm();
  const schema = new mongoose.Schema(
    {
      imageId: { type: String, required: true, unique: true, index: true },
      owner: { type: String, required: true, index: true },
      name: { type: String, default: "image" },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true },
      data: { type: Buffer, required: true, select: false },
      views: { type: Number, default: 0 },
    },
    { timestamps: true }
  );
  Model = conn.models.QrImage || conn.model("QrImage", schema);
  return Model;
}

export async function saveQrImage({ owner, name, buffer }) {
  const mimeType = sniffImage(buffer);
  if (!mimeType) { const e = new Error("Only PNG, JPG, GIF or WebP images are allowed."); e.code = "BAD_IMAGE"; throw e; }
  if (buffer.length > QR_IMAGE_MAX_BYTES) { const e = new Error("Image is too large."); e.code = "IMAGE_TOO_LARGE"; throw e; }
  const M = await model();
  if ((await M.countDocuments({ owner: String(owner) })) >= QR_IMAGE_PER_USER) {
    const e = new Error(`You can store up to ${QR_IMAGE_PER_USER} QR images. Delete some first.`); e.code = "QR_IMAGE_LIMIT"; throw e;
  }
  const imageId = crypto.randomBytes(9).toString("base64url");
  await M.create({ imageId, owner: String(owner), name: String(name || "image").replace(/[\\/<>:"|?*\u0000-\u001F]/g, "_").slice(0, 120), mimeType, size: buffer.length, data: buffer });
  return { imageId, mimeType, size: buffer.length };
}

export async function readQrImage(imageId) {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(String(imageId))) return null;
  const M = await model();
  const doc = await M.findOneAndUpdate({ imageId }, { $inc: { views: 1 } }).select("+data mimeType");
  return doc ? { mimeType: doc.mimeType, data: doc.data } : null;
}

export async function listQrImages(owner) {
  const M = await model();
  const rows = await M.find({ owner: String(owner) }).sort({ createdAt: -1 }).limit(QR_IMAGE_PER_USER).select("imageId name size mimeType views createdAt").lean();
  return rows.map((r) => ({ imageId: r.imageId, name: r.name, size: r.size, mimeType: r.mimeType, views: r.views, createdAt: r.createdAt }));
}

export async function deleteQrImage(owner, imageId) {
  const M = await model();
  const r = await M.deleteOne({ imageId: String(imageId), owner: String(owner) });
  return r.deletedCount > 0;
}
