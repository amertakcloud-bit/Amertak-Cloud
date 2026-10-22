import path from "node:path";
import { fileURLToPath } from "node:url";
import lite from "./lite.js";

// Which database engine does this process use?
//   MONGODB_URI set            → MongoDB (mongoose)           CLOUD_MONGODB_URI set → MongoDB for CloudShare/editor
//   otherwise (local PC)       → SQLite file (better-sqlite3)  DATABASE_PATH / CLOUD_DATABASE_PATH (defaults in backend/data/)
// On Vercel the file system is read-only, so SQLite is only used there if a path is set explicitly.
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, "../../data");

export const useMongo = () => Boolean(process.env.MONGODB_URI);
export const useCloudMongo = () => Boolean(process.env.CLOUD_MONGODB_URI);
export const sqliteAllowed = (envName) => Boolean(process.env[envName]) || !process.env.VERCEL;
const resolveDb = (p) => (p === ":memory:" ? p : path.resolve(p));
export const mainSqlitePath = () => resolveDb(process.env.DATABASE_PATH || path.join(dataDir, "amertak.sqlite"));
export const cloudSqlitePath = () => resolveDb(process.env.CLOUD_DATABASE_PATH || path.join(dataDir, "cloud.sqlite"));

lite._file = mainSqlitePath();

// `mongoose` for the main database: the real one, or the SQLite look-alike.
const mongoose = useMongo() ? (await import("mongoose")).default : lite;
export default mongoose;

// Same choice for the CloudShare / editor / QR-image database.
export async function cloudOdm() {
  return useCloudMongo() ? (await import("mongoose")).default : lite;
}
export { lite };
