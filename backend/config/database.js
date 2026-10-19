import mongoose from "mongoose";
import dns from "node:dns";

// Public DNS fallback used ONLY when an SRV lookup (mongodb+srv://) fails
// with the system resolver — some corporate/VPN DNS servers refuse SRV queries.
// Configurable via DNS_SERVERS in server/.env (comma separated).
const DNS_FALLBACK = (process.env.DNS_SERVERS || "8.8.8.8,1.1.1.1")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isSrvLookupError(error) {
  return (
    /querySrv|ESERVFAIL|ECONNREFUSED|ENOTFOUND|ETIMEOUT/i.test(String(error?.message || "")) ||
    ["ESERVFAIL", "ECONNREFUSED", "ENOTFOUND"].includes(error?.code)
  );
}

export function hasDatabase() {
  return Boolean(process.env.MONGODB_URI);
}

// Shared connection logic. Throws on failure (no process.exit) so it is safe in serverless.
async function connectInternal() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing.");

  mongoose.set("strictQuery", true);
  // bufferCommands off → fail fast instead of hanging when the DB is down (serverless).
  const options = { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000, maxPoolSize: 5 };

  try {
    await mongoose.connect(uri, options);
  } catch (error) {
    // mongodb+srv:// + failed SRV lookup → retry once with public DNS servers.
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

// ensureDb
// Connection cached across warm serverless invocations (and reused by the normal server).
// A failed attempt is not cached, so the next request retries.
let pending = null;
export async function ensureDb() {
  if (mongoose.connection.readyState === 1) return;
  if (!pending) {
    pending = connectInternal().catch((err) => {
      pending = null;
      throw err;
    });
  }
  await pending;
}

// connectDB
// Used by server.js (long-running server). Exits with a clear message on failure.
export async function connectDB() {
  if (!hasDatabase()) {
    console.error("[MongoDB] MONGODB_URI is missing.\n           Add it to backend/.env (see backend/.env.example).");
    process.exit(1);
  }
  try {
    await ensureDb();
  } catch (error) {
    console.error(`[MongoDB] Connection failed: ${error.message}`);
    console.error("           - Check MONGODB_URI / credentials\n           - Ensure your IP is allowed in Atlas → Network Access (Vercel: allow 0.0.0.0/0)");
    process.exit(1);
  }
}
