// AppError
// Throwable error that carries an HTTP status + a stable machine-readable code.
// The central errorHandler turns it into: { success:false, message, code }.
export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

// redact
// Removes anything that looks like an API key from text before it is logged or
// sent to a client (Google keys: "AIza…", "AQ.…", plus key=value / header forms).
export function redact(text) {
  return String(text ?? "")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_KEY]")
    .replace(/\bAQ\.[0-9A-Za-z_.-]{20,}/g, "[REDACTED_KEY]")
    .replace(
      /(x-gemini-api-key|api[_-]?key|key)(["'=:\s]+)[\x21-\x7E]{16,}/gi,
      "$1$2[REDACTED_KEY]"
    );
}
