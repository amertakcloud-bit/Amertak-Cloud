import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { ensureDb, hasDatabase } from "../config/database.js";
import { AUTH_COOKIE } from "./authMiddleware.js";

// optionalAuth
// Like `protect`, but never rejects: when a valid auth cookie exists req.user is set,
// otherwise the request continues as a guest. Used by tools that are public but let
// logged-in users use the server's built-in Gemini key.
export async function optionalAuth(req, _res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token || !hasDatabase()) return next();

    const secret = process.env.SESSION_SECRET || "insecure-dev-secret-change-me";
    const decoded = jwt.verify(token, secret);
    await ensureDb();
    const user = await User.findById(decoded.id);
    if (user) req.user = user;
  } catch {
    /* invalid/expired cookie → treat as guest */
  }
  return next();
}
