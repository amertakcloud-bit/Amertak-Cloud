// Downsizes big photos in the browser so they fit Vercel's 4.5 MB request limit.
// Returns the original file when it is already small enough.
export async function shrinkImage(file, { maxBytes = 3.5 * 1024 * 1024, maxSide = 1600 } = {}) {
  if (file.size <= maxBytes && /^image\/(png|jpeg|webp)$/.test(file.type)) return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (file.size <= maxBytes) return file; // e.g. HEIC the browser can't draw — send as is
    throw Object.assign(new Error("This image could not be read."), { code: "IMAGE_UNREADABLE" });
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  for (const q of [0.85, 0.7, 0.55]) {
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= maxBytes) return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  }
  throw Object.assign(new Error("The image is too large."), { code: "TOO_LARGE" });
}
