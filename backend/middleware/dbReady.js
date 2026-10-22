import { ensureDb, hasDatabase } from "../config/database.js";
import { AppError } from "../lib/AppError.js";
import { asyncHandler } from "./errorMiddleware.js";

// Routes that need MongoDB wait for a (cached) connection first.
export const dbReady = asyncHandler(async (_req, _res, next) => {
  if (!hasDatabase()) {
    throw new AppError(503, "NO_DATABASE", "This feature needs the database, which is not configured on the server.");
  }
  try {
    await ensureDb();
  } catch (err) {
    console.error("[DB] connect failed:", err.message);
    throw new AppError(503, "DATABASE_UNAVAILABLE", "The database is unreachable right now. Please try again shortly.");
  }
  next();
});
