import { encryptSecret, decryptSecret } from "./secretBox.js";

// Admin-managed settings (stored in the database, cached for a short time).
// Gemini API key: set by the admin in the admin panel → users are never asked for a key.
// Falls back to the GEMINI_API_KEY environment variable when the admin has not set one.
const TTL = 30_000;
const cache = new Map();

export const deps = {
  async read(key) {
    const { default: Setting } = await import("../models/Setting.js");
    return (await Setting.findOne({ key }))?.value ?? null;
  },
  async write(key, value, userId) {
    const { default: Setting } = await import("../models/Setting.js");
    const cur = await Setting.findOne({ key });
    if (cur) { cur.value = value; cur.updatedBy = userId || null; cur.updatedAt = new Date(); await cur.save(); }
    else await Setting.create({ key, value, updatedBy: userId || null });
  },
  async hasDb() {
    const { hasDatabase } = await import("../config/database.js");
    return hasDatabase();
  },
};

export async function getSetting(key, fallback = null) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value ?? fallback;
  let value = null;
  try { if (await deps.hasDb()) { const { ensureDb } = await import("../config/database.js"); await ensureDb(); value = await deps.read(key); } } catch (e) { console.warn("[settings] read failed:", e.message); }
  cache.set(key, { at: Date.now(), value });
  return value ?? fallback;
}

export async function setSetting(key, value, userId) {
  await deps.write(key, value, userId);
  cache.set(key, { at: Date.now(), value });
}
export const clearSettingsCache = () => cache.clear();

const mask = (k) => (k ? `${k.slice(0, 4)}…${k.slice(-3)}` : "");

// The Gemini key the SITE uses: admin's key first, then the environment variable.
export async function getAdminGeminiKey() {
  const v = await getSetting("gemini");
  const fromDb = v?.keyEnc ? decryptSecret(v.keyEnc) : "";
  if (fromDb) return { key: fromDb, source: "admin" };
  const env = (process.env.GEMINI_API_KEY || "").trim();
  return env ? { key: env, source: "env" } : { key: "", source: "none" };
}

export async function geminiAdminStatus() {
  const v = (await getSetting("gemini")) || {};
  const { key, source } = await getAdminGeminiKey();
  return { hasKey: Boolean(key), source, masked: mask(key), ttsModel: v.ttsModel || "", textModel: v.textModel || "", updatedAt: v.updatedAt || null };
}

export async function saveAdminGemini({ key, ttsModel, textModel }, userId) {
  const cur = (await getSetting("gemini")) || {};
  const next = { ...cur, updatedAt: new Date().toISOString() };
  if (typeof key === "string") next.keyEnc = key ? encryptSecret(key) : "";
  if (typeof ttsModel === "string") next.ttsModel = ttsModel.trim().slice(0, 80);
  if (typeof textModel === "string") next.textModel = textModel.trim().slice(0, 80);
  await setSetting("gemini", next, userId);
  return geminiAdminStatus();
}

// Models chosen by the admin (empty = built-in defaults / env).
export async function getModelOverrides() {
  const v = (await getSetting("gemini")) || {};
  return { ttsModel: v.ttsModel || "", textModel: v.textModel || "" };
}

// Admin-chosen model names are applied through the same environment variables the code already reads.
const ORIG = { tts: process.env.GEMINI_TTS_MODEL, text: process.env.GEMINI_MODEL };
export async function applyModelOverrides() {
  const o = await getModelOverrides();
  const set = (name, v, orig) => { if (v) process.env[name] = v; else if (orig === undefined) delete process.env[name]; else process.env[name] = orig; };
  set("GEMINI_TTS_MODEL", o.ttsModel, ORIG.tts);
  set("GEMINI_MODEL", o.textModel, ORIG.text);
}
