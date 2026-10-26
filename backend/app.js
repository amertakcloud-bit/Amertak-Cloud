import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";

import { hasDatabase } from "./config/database.js";
import { configurePassport } from "./config/passport.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import promoRoutes from "./routes/promoRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import ttsRoutes from "./routes/ttsRoutes.js";
import cloudShareRoutes from "./routes/cloudShareRoutes.js";
import srtRoutes from "./routes/srtRoutes.js";
import editorRoutes from "./routes/editorRoutes.js";
import toolsRoutes from "./routes/toolsRoutes.js";
import { AppError } from "./lib/AppError.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import { dbReady } from "./middleware/dbReady.js";

// Express app WITHOUT app.listen() so it can run both locally (server.js) and as a
// Vercel serverless function (api/index.js).

export function allowedOrigins() {
  const fromEnv = [process.env.CLIENT_URL, process.env.ALLOWED_ORIGINS]
    .filter(Boolean)
    .join(",")
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, ""))
    .filter(Boolean);
  const dev = process.env.NODE_ENV === "production" ? [] : ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173"];
  return [...new Set([...fromEnv, ...dev])];
}

export function createApp() {
  const app = express();
  app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 1)); // 2 when the frontend proxies /api (Deployment.md)
  app.disable("x-powered-by");

  const origins = allowedOrigins();
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || origins.includes(origin)) return cb(null, true);
        console.warn(`[CORS] blocked origin ${origin}. Allowed: ${origins.join(", ") || "(none — set CLIENT_URL)"}`);
        return cb(null, false); // no CORS headers → the browser blocks it (no 500)
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-gemini-api-key"],
      exposedHeaders: ["Content-Disposition", "X-QR-Content", "X-Voice"],
      maxAge: 86400,
    })
  );

  // rawBody is kept for the KHQR.dev webhook: its HMAC signature is computed over the exact bytes.
  app.use(express.json({ limit: "4mb", verify: (req, _res, buf) => { if (req.originalUrl?.startsWith("/api/payments/webhook")) req.rawBody = buf; } }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());
  configurePassport();
  app.use(passport.initialize());

  // Diagnostics: call with an Origin header to check CORS, e.g.
  //   curl -H "Origin: https://YOUR-FRONTEND.vercel.app" https://YOUR-BACKEND.vercel.app/api/health
  app.get("/api/health", (req, res) => {
    const origin = req.get("origin") || null;
    res.json({
      success: true,
      status: "ok",
      time: new Date().toISOString(),
      database: hasDatabase(),
      production: process.env.NODE_ENV === "production",
      cors: { requestOrigin: origin, allowed: origin ? origins.includes(origin) : null, allowedOrigins: origins },
      google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    });
  });

  // Public tool APIs (no database needed)
  app.use("/api/tts", ttsRoutes);
  app.use("/api/srt", srtRoutes);
  app.use("/api", toolsRoutes);

  // Database-backed APIs
  app.use("/api/auth", dbReady, authRoutes);
  app.use("/api/users", dbReady, userRoutes);
  app.use("/api/payments", dbReady, paymentRoutes);
  app.use("/api/promo-codes", dbReady, promoRoutes);
  app.use("/api/admin", dbReady, adminRoutes);
  app.use("/api/cloudshare", cloudShareRoutes);
  app.use("/api/editor", editorRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp();
