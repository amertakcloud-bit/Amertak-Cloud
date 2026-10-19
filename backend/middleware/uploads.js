import multer from "multer";

// Vercel rejects request bodies over 4.5 MB before our code runs, so tool uploads that go
// through the API are limited accordingly. Self-hosted? raise MAX_UPLOAD_MB.
import { MAX_UPLOAD_MB } from "../lib/limits.js";
export { MAX_UPLOAD_MB };

function memoryUploader(fieldBytes, fileBytes) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: fileBytes, files: 1, fields: 20, fieldSize: fieldBytes },
  });
}

// SRT audio chunks: ≤ ~100 s of 16 kHz mono 16-bit PCM ≈ 3.2 MB.
export const uploadAudioChunk = memoryUploader(64 * 1024, Math.min(MAX_UPLOAD_MB, 4.2) * 1024 * 1024).single("audio");
// Image → prompt (the browser downsizes large photos first).
export const uploadImage = memoryUploader(64 * 1024, MAX_UPLOAD_MB * 1024 * 1024).single("image");
// Export audio (video/audio → mp3/m4a/…): only small files can pass through the API on Vercel.
export const uploadMedia = memoryUploader(64 * 1024, MAX_UPLOAD_MB * 1024 * 1024).single("file");
