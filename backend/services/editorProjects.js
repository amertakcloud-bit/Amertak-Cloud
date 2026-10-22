import { AppError } from "../lib/AppError.js";
import { getCloudConnection, isCloudShareAvailable } from "./cloudShareService.js";

// Video-editor projects live in the CloudShare database (CLOUD_MONGODB_URI).
// Only the project JSON (timeline, text, caption cues, media references) is stored — the media
// files themselves stay in the user's browser (IndexedDB), because Vercel limits request bodies
// to 4.5 MB.
export const MAX_PROJECT_BYTES = 1.5 * 1024 * 1024;
export const MAX_PROJECTS_PER_USER = 50;

export const deps = { getModel: null }; // test seam

async function model() {
  if (deps.getModel) return deps.getModel();
  if (!isCloudShareAvailable()) {
    throw new AppError(503, "STORAGE_UNAVAILABLE", "Video projects need the CloudShare database (set CLOUD_MONGODB_URI, or CLOUD_DATABASE_PATH for a local SQLite file).");
  }
  const conn = await getCloudConnection();
  const mongoose = await (await import("../lib/odm/index.js")).cloudOdm();
  if (conn.models.EditorProject) return conn.models.EditorProject;
  const schema = new mongoose.Schema(
    {
      owner: { type: String, required: true, index: true },
      name: { type: String, required: true, maxlength: 120 },
      width: { type: Number, default: 1280 },
      height: { type: Number, default: 720 },
      duration: { type: Number, default: 0 },
      data: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true, minimize: false }
  );
  return conn.model("EditorProject", schema);
}

const meta = (d) => ({
  id: String(d._id ?? d.id),
  name: d.name,
  width: d.width,
  height: d.height,
  duration: d.duration,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

function clean(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? "").trim().slice(0, 120);
    if (!name) throw new AppError(400, "INVALID_NAME", "Please give the project a name.");
    out.name = name;
  }
  if (body.data !== undefined) {
    if (typeof body.data !== "object" || body.data === null || Array.isArray(body.data)) {
      throw new AppError(400, "INVALID_PROJECT", '"data" must be a project object.');
    }
    if (Buffer.byteLength(JSON.stringify(body.data)) > MAX_PROJECT_BYTES) {
      throw new AppError(413, "PROJECT_TOO_LARGE", "This project is too large to save (max 1.5 MB of timeline data).");
    }
    out.data = body.data;
  }
  const num = (v, lo, hi) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : undefined);
  const w = num(body.width, 120, 4096), h = num(body.height, 120, 4096), d = num(body.duration, 0, 24 * 3600);
  if (w !== undefined) out.width = Math.round(w);
  if (h !== undefined) out.height = Math.round(h);
  if (d !== undefined) out.duration = d;
  return out;
}

export async function listProjects(owner) {
  const M = await model();
  const docs = await M.find({ owner: String(owner) }).select("-data").sort({ updatedAt: -1 }).limit(MAX_PROJECTS_PER_USER);
  return docs.map(meta);
}

export async function createProject(owner, body) {
  const M = await model();
  const count = await M.countDocuments({ owner: String(owner) });
  if (count >= MAX_PROJECTS_PER_USER) {
    throw new AppError(409, "TOO_MANY_PROJECTS", `You can keep up to ${MAX_PROJECTS_PER_USER} projects. Delete one first.`);
  }
  const doc = await M.create({ owner: String(owner), ...clean(body) });
  return { ...meta(doc), data: doc.data };
}

export async function getProject(owner, id) {
  const M = await model();
  const doc = await findOwned(M, owner, id);
  return { ...meta(doc), data: doc.data };
}

export async function updateProject(owner, id, body) {
  const M = await model();
  await findOwned(M, owner, id);
  const set = clean(body, { partial: true });
  const doc = await M.findOneAndUpdate({ _id: id, owner: String(owner) }, { $set: set }, { new: true });
  if (!doc) throw notFound();
  return meta(doc);
}

export async function deleteProject(owner, id) {
  const M = await model();
  await findOwned(M, owner, id);
  await M.deleteOne({ _id: id, owner: String(owner) });
}

const notFound = () => new AppError(404, "PROJECT_NOT_FOUND", "Project not found.");

async function findOwned(M, owner, id) {
  let doc = null;
  try {
    doc = await M.findOne({ _id: id, owner: String(owner) });
  } catch {
    throw notFound(); // malformed id
  }
  if (!doc) throw notFound();
  return doc;
}
