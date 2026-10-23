import { AppError } from "../../lib/AppError.js";
import { toSrtTime, parseTime } from "./time.js";

// Validates + normalizes cues coming from the browser.
export function validateCues(cues) {
  if (!Array.isArray(cues) || cues.length === 0) {
    throw new AppError(400, "INVALID_CUES", "At least one subtitle is required.");
  }
  if (cues.length > 20000) throw new AppError(400, "INVALID_CUES", "Too many subtitles.");
  return cues.map((c, i) => {
    const start = parseTime(c?.start);
    const end = parseTime(c?.end);
    const text = String(c?.text ?? "").replace(/\r\n?/g, "\n").trim();
    if (start === null || end === null || start < 0 || end <= start) {
      throw new AppError(400, "INVALID_CUES", `Subtitle #${i + 1}: end time must be greater than start time.`);
    }
    if (!text) throw new AppError(400, "INVALID_CUES", `Subtitle #${i + 1}: the text is empty.`);
    return { start, end, text };
  });
}

export function buildSrt(cues) {
  return cues
    .map((c, i) => `${i + 1}\n${toSrtTime(c.start)} --> ${toSrtTime(c.end)}\n${c.text}\n`)
    .join("\n");
}
