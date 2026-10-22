import dns from "node:dns";
import { cloudSqlitePath, lite, mainSqlitePath, sqliteAllowed, useMongo } from "../lib/odm/index.js";

// Main database:
//   MONGODB_URI set → MongoDB.   Not set → a local SQLite file (DATABASE_PATH, default backend/data/amertak.sqlite).
// The SQLite fallback behaves like MongoDB for this app (same models/queries) and is meant for running on your own PC.

const DNS_FALLBACK = (process.env.DNS_SERVERS || "8.8.8.8,1.1.1.1").split(",").map((s) => s.trim()).filter(Boolean);
function isSrvLookupError(error) {
  return /querySrv|ESERVFAIL|ECONNREFUSED|ENOTFOUND|ETIMEOUT/i.test(String(error?.message || "")) || ["ESERVFAIL", "ECONNREFUSED", "ENOTFOUND"].includes(error?.code);
}

export const databaseKind = () => (useMongo() ? "mongodb" : "sqlite");
export function hasDatabase() {
  return useMongo() || sqliteAllowed("DATABASE_PATH");
}

async function connectInternal() {
  if (!useMongo()) {
    await lite.connect(mainSqlitePath());
    console.log(`[SQLite] Using ${mainSqlitePath()} (set MONGODB_URI to use MongoDB instead)`);
    return;
  }
  const mongoose = (await import("mongoose")).default;
  const uri = process.env.MONGODB_URI;
  mongoose.set("strictQuery", true);
  const options = { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000, maxPoolSize: 5 };
  try {
    await mongoose.connect(uri, options);
  } catch (error) {
    if (uri.startsWith("mongodb+srv") && isSrvLookupError(error)) {
      console.warn(`[MongoDB] SRV lookup failed with system DNS (${error.message}). Retrying with fallback DNS.`);
      dns.setServers(DNS_FALLBACK);
      await mongoose.connect(uri, options);
    } else {
      throw error;
    }
  }
  console.log(`[MongoDB] Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

let pending = null;
let ok = false;
export async function ensureDb() {
  if (ok) {
    if (!useMongo()) return;
    const mongoose = (await import("mongoose")).default;
    if (mongoose.connection.readyState === 1) return;
  }
  if (!pending) {
    pending = connectInternal().then(() => { ok = true; pending = null; }).catch((err) => { pending = null; throw err; });
  }
  await pending;
}

export async function connectDB() {
  if (!hasDatabase()) {
    console.error("[DB] No database configured. Set MONGODB_URI (or DATABASE_PATH for SQLite) in backend/.env.");
    process.exit(1);
  }
  try {
    await ensureDb();
  } catch (error) {
    console.error(`[${databaseKind()}] Connection failed: ${error.message}`);
    if (useMongo()) console.error("           - Check MONGODB_URI / credentials\n           - Ensure your IP is allowed in Atlas → Network Access (Vercel: allow 0.0.0.0/0)");
    process.exit(1);
  }
}
export { cloudSqlitePath };
