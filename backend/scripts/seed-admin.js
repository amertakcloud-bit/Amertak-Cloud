import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/react_dashboard";

async function seedAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("[Seed] Connected to MongoDB");

    const existing = await User.findOne({ email: "admin@admin.com" });
    if (existing) {
      console.log("[Seed] Admin user already exists");
      process.exit(0);
    }

    const admin = new User({
      name: "Amertak Admin",
      email: "amertak@admin.dev",
      password: "amertakdev&superdev@admin",
      role: "admin",
      provider: "local",
    });

    await admin.save();
    console.log("[Seed] Admin user created:");
    console.log("[Seed]   Email: admin@admin.com");
    console.log("[Seed]   Password: admin123456");
    console.log("[Seed]   Role: admin");
  } catch (error) {
    console.error("[Seed] Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("[Seed] Disconnected from MongoDB");
    process.exit(0);
  }
}

seedAdmin();
