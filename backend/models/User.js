import mongoose from "../lib/odm/index.js";
import bcrypt from "bcryptjs";

// User
// Supports both Local (email + password) and Google (googleId) accounts.
// The password is hashed before every save and is never selected by default.
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [60, "Name must be at most 60 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    password: {
      type: String,
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
      // Google and Telegram accounts do not have a password.
      required: function () {
        return this.provider !== "google" && this.provider !== "telegram";
      },
    },
    avatar: {
      type: String,
      default: "",
      maxlength: [2048, "Avatar is too long"],
    },
    provider: {
      type: String,
      enum: {
        values: ["local", "google", "telegram"],
        message: "Provider must be local, google, or telegram",
      },
      default: "local",
    },
    googleId: {
      type: String,
      default: null,
    },
    telegramId: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    // The user's own Gemini API key, AES-256-GCM encrypted (never returned to the client).
    geminiKeyEnc: { type: String, default: "", select: false },
    // Token balance credited by successful plan payments.
    tokens: {
      type: Number,
      default: 0,
      min: [0, "Tokens cannot be negative"],
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Hash the password before save, but only when it changed.
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare a plain password with the stored hash.
userSchema.methods.matchPassword = function (enteredPassword) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
