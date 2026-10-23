import { AppError } from "../../lib/AppError.js";
import { buildPayload } from "./payload.js";

export const deps = { loadQr: async () => (await import("qrcode")).default };

const HEX = /^#[0-9a-f]{6}$/i;
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export function sanitizeQrOptions(o = {}) {
  const dark = HEX.test(o.dark) ? o.dark : "#000000";
  const light = o.transparent ? null : HEX.test(o.light) ? o.light : "#ffffff";
  if (light) {
    const a = lum(dark), b = lum(light);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (ratio < 2.5) throw new AppError(400, "LOW_CONTRAST", "Foreground and background colours are too similar — the QR code would not scan.");
    if (a > b) throw new AppError(400, "LOW_CONTRAST", "The foreground must be darker than the background so scanners can read it.");
  }
  const size = Math.max(128, Math.min(2048, Math.round(Number(o.size) || 512)));
  const margin = Math.max(0, Math.min(10, Math.round(Number(o.margin ?? 2))));
  const ecc = ["L", "M", "Q", "H"].includes(o.ecc) ? o.ecc : "M";
  const format = ["png", "svg"].includes(o.format) ? o.format : "png";
  return { dark, light, size, margin, ecc, format };
}

export async function generateQr(type, data, options) {
  const opts = sanitizeQrOptions(options);
  const text = buildPayload(type, data);
  const QR = await deps.loadQr();
  const color = { dark: opts.dark, light: opts.light ?? "#00000000" };
  try {
    if (opts.format === "svg") {
      const svg = await QR.toString(text, { type: "svg", errorCorrectionLevel: opts.ecc, margin: opts.margin, color, width: opts.size });
      return { buffer: Buffer.from(svg, "utf8"), contentType: "image/svg+xml; charset=utf-8", ext: "svg", text, options: opts };
    }
    const buffer = await QR.toBuffer(text, { type: "png", errorCorrectionLevel: opts.ecc, margin: opts.margin, color, width: opts.size });
    return { buffer, contentType: "image/png", ext: "png", text, options: opts };
  } catch (err) {
    if (/too big|capacity|amount of data/i.test(String(err?.message))) {
      throw new AppError(400, "QR_TOO_LARGE", "That content is too long for a QR code. Shorten it or lower the error-correction level.");
    }
    throw new AppError(500, "QR_FAILED", "Could not generate the QR code.");
  }
}
