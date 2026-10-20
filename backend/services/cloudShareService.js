import crypto from "node:crypto";
import dns from "node:dns";

// CloudShare stores files in its OWN MongoDB database (CLOUD_MONGODB_URI), separate from
// the main app database. Works on Vercel (no filesystem needed).
// Vercel limits a request body to ~4.5 MB, so the default limit there is 4 MB.
const DEFAULT_MB = process.env.VERCEL ? 4 : 15;
const MAX_MB = Math.min(Number(process.env.CLOUDSHARE_MAX_MB || process.env.MAX_FILE_SIZE_MB || DEFAULT_MB) || DEFAULT_MB, 15);
export const CLOUDSHARE_MAX_BYTES = MAX_MB * 1024 * 1024;

const EXPIRY_OPTIONS = Object.freeze({
  never: null,
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
});

export function isCloudShareAvailable() {
  return Boolean(process.env.CLOUD_MONGODB_URI);
}

let connPromise = null;
let Model = null;

export async function getCloudModel() {
  if (Model && Model.db.readyState === 1) return Model;
  if (!isCloudShareAvailable()) {
    const e = new Error("CloudShare database is not configured (CLOUD_MONGODB_URI).");
    e.code = "STORAGE_UNAVAILABLE";
    throw e;
  }
  if (!connPromise) {
    connPromise = (async () => {
      const { default: mongoose } = await import("mongoose"); // lazy: keeps unit tests light
    const fileSchema = new mongoose.Schema(
      {
        shareId: { type: String, required: true, unique: true, index: true },
        originalName: { type: String, required: true },
        mimeType: { type: String, default: "application/octet-stream" },
        size: { type: Number, required: true },
        data: { type: Buffer, required: true, select: false },
        downloadCount: { type: Number, default: 0 },
        expiresAt: { type: Date, default: null },
      },
      { timestamps: true }
    );
    // MongoDB removes expired documents automatically (TTL); null expiresAt is ignored.
    fileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });


      const uri = process.env.CLOUD_MONGODB_URI;
      const opts = { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000, maxPoolSize: 5 };
      let conn;
      try {
        conn = await mongoose.createConnection(uri, opts).asPromise();
      } catch (err) {
        if (uri.startsWith("mongodb+srv") && /querySrv|ESERVFAIL|ECONNREFUSED|ENOTFOUND/i.test(String(err?.message))) {
          dns.setServers((process.env.DNS_SERVERS || "8.8.8.8,1.1.1.1").split(",").map((s) => s.trim()).filter(Boolean));
          conn = await mongoose.createConnection(uri, opts).asPromise();
        } else throw err;
      }
      Model = conn.model("CloudFile", fileSchema);
      return Model;
    })().catch((err) => {
      connPromise = null; // retry on next request
      throw err;
    });
  }
  return connPromise;
}

// Test hook: inject a fake model.
export function __setCloudModel(m) {
  Model = m;
  connPromise = m ? Promise.resolve(m) : null;
  if (m && !m.db) m.db = { readyState: 1 };
}

export function getCloudShareConfig() {
  return {
    available: isCloudShareAvailable(),
    maxFileSizeMB: MAX_MB,
    maxFileSizeBytes: CLOUDSHARE_MAX_BYTES,
    expirationOptions: Object.keys(EXPIRY_OPTIONS),
  };
}

function sanitizeFilename(name) {
  const n = String(name || "upload").replace(/[\\/<>:"|?*\u0000-\u001F]/g, "_").trim();
  return n.slice(0, 200) || "upload";
}

function getExpiresAt(expiresIn) {
  const key = String(expiresIn || "never").toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(EXPIRY_OPTIONS, key)) {
    const e = new Error("Invalid expiration option.");
    e.code = "INVALID_EXPIRATION";
    throw e;
  }
  const d = EXPIRY_OPTIONS[key];
  return d === null ? null : new Date(Date.now() + d);
}

export async function createCloudShareRecord({ originalName, mimeType, buffer, expiresIn }) {
  const expiresAt = getExpiresAt(expiresIn);
  const M = await getCloudModel();
  const doc = await M.create({
    shareId: crypto.randomBytes(9).toString("base64url"),
    originalName: sanitizeFilename(originalName),
    mimeType: mimeType || "application/octet-stream",
    size: buffer.length,
    data: buffer,
    expiresAt,
  });
  return plain(doc);
}

function plain(doc) {
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return { ...o, expiresAt: o.expiresAt ? new Date(o.expiresAt).toISOString() : null };
}

export async function findCloudShareRecord(shareId, { withData = false } = {}) {
  const M = await getCloudModel();
  let q = M.findOne({ shareId: String(shareId) });
  if (withData) q = q.select("+data");
  const doc = await q;
  if (!doc) return null;
  const rec = plain(doc);
  if (rec.expiresAt && new Date(rec.expiresAt).getTime() <= Date.now()) return null;
  return rec;
}

export async function incrementCloudShareDownloadCount(shareId) {
  const M = await getCloudModel();
  await M.updateOne({ shareId: String(shareId) }, { $inc: { downloadCount: 1 } });
}

export function toPublicCloudShareRecord(r) {
  return {
    shareId: r.shareId,
    name: r.originalName,
    size: r.size,
    mimeType: r.mimeType,
    downloadCount: r.downloadCount || 0,
    expiresAt: r.expiresAt || null,
    createdAt: r.createdAt || null,
  };
}
