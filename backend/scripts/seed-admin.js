import "dotenv/config";
import crypto from "node:crypto";
import { databaseKind, ensureDb } from "../config/database.js";
import User from "../models/User.js";

// Creates (or promotes) an admin account.  Works with MongoDB or the local SQLite fallback.
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-password' npm run seed:admin
// Without ADMIN_PASSWORD a random one is generated and printed once.
const email = (process.env.ADMIN_EMAIL || "admin@admin.com").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");

try {
  await ensureDb();
  console.log(`[Seed] Connected (${databaseKind()})`);
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== "admin") { existing.role = "admin"; await existing.save(); console.log(`[Seed] ${email} promoted to admin.`); }
    else console.log(`[Seed] ${email} is already an admin.`);
  } else {
    await new User({ name: "Amertak Admin", email, password, role: "admin", provider: "local" }).save();
    console.log(`[Seed] Admin created.\n[Seed]   Email:    ${email}\n[Seed]   Password: ${process.env.ADMIN_PASSWORD ? "(the ADMIN_PASSWORD you set)" : password}`);
  }
  process.exit(0);
} catch (e) {
  console.error("[Seed] Error:", e.message);
  process.exit(1);
}
