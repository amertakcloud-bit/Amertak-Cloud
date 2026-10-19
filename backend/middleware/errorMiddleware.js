import { redact } from "../lib/AppError.js";

// asyncHandler
// Wraps async route handlers so thrown/rejected errors reach the error middleware.
export function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// notFound
// Centralized 404 for unknown API routes.
export function notFound(req, _res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

// errorHandler
// Centralized error handler — every error response has the same shape:
// { success: false, message: string, code?: string }
export function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || "Something went wrong. Please try again.";
  const code = err.name === "AppError" ? err.code : undefined;

  // Body too large / malformed JSON (express.json) → clear client errors.
  if (err.type === "entity.too.large") {
    statusCode = 413;
    message = "The request is too large.";
  } else if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid JSON body.";
  }

  // multer upload errors (file too large, too many files …)
  if (err.name === "MulterError") {
    statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? "The uploaded file is too large."
        : `Upload error: ${err.message}`;
  }

  // Mongoose: duplicate key (email already registered)
  if (err.code === 11000) {
    statusCode = 409;
    message = "An account with this email already exists.";
  }

  // Mongoose: validation errors — return the first field message
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(" ");
  }

  // Mongoose: invalid ObjectId
  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid resource id.";
  }

  // Never leak internal error details in production.
  if (process.env.NODE_ENV === "production" && statusCode === 500) {
    message = "Internal server error.";
  }

  if (statusCode >= 500) {
    console.error("[Error]", redact(err?.stack || err?.message || err));
  }

  const body = { success: false, message: redact(message) };
  if (code) body.code = code;
  if (err.name === "AppError" && err.details !== undefined) body.details = redact(err.details);

  res.status(statusCode).json(body);
}
