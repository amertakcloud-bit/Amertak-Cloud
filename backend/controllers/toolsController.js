import { RATES, tokensForBytes, withCharge } from "../lib/billing.js";
import { Readable } from "node:stream";
import { AppError } from "../lib/AppError.js";
import { serverKeyConfigured, getModels } from "../lib/geminiClient.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import { KHMER_VOICES } from "../lib/edgeTts.js";
import { generateQr } from "../services/qr/index.js";
import { QR_TYPES } from "../services/qr/payload.js";
import { imageToPrompt, STYLES } from "../services/imagePrompt/index.js";
import { resolveVideo } from "../services/video/index.js";
import { verifyMediaToken } from "../services/video/sign.js";
import { safeFetch } from "../services/video/ssrf.js";
import { BITRATES, convertToAudio, FORMATS } from "../services/audio/convert.js";
import { MAX_UPLOAD_MB } from "../lib/limits.js";

// GET /api/tools — what the frontend can offer, straight from the server's real config.
export const getTools = (req, res) => {
  res.json({
    success: true,
    data: {
      loggedIn: Boolean(req.user),
      limits: { uploadMb: MAX_UPLOAD_MB },
      rates: { captionPerMB: RATES.captionPerMB, cloudSharePerMB: RATES.cloudSharePerMB },
      tools: {
        qr: { available: true, types: QR_TYPES },
        tts: { available: true, voices: KHMER_VOICES },
        srt: { available: true, model: getModels().transcribe, serverKey: serverKeyConfigured() },
        imagePrompt: { available: true, styles: Object.keys(STYLES), serverKey: serverKeyConfigured() },
        videoEditor: { available: Boolean(process.env.CLOUD_MONGODB_URI), voices: ["piseth", "sreymom"], captionPerMB: RATES.captionPerMB },
        video: { available: true, providers: ["tiktok", "pinterest", "direct"] },
        audio: { available: true, formats: Object.keys(FORMATS), bitrates: BITRATES, serverMaxMb: MAX_UPLOAD_MB },
      },
    },
  });
};

// POST /api/qr  { type, data, options } → image bytes (png/svg)
export const createQr = asyncHandler(async (req, res) => {
  const { type, data, options } = req.body || {};
  const out = await generateQr(type, data, options);
  res.set({
    "Content-Type": out.contentType,
    "Content-Disposition": `inline; filename="qr.${out.ext}"`,
    "Cache-Control": "no-store",
    "X-QR-Content": encodeURIComponent(out.text).slice(0, 1500),
  });
  res.send(out.buffer);
});

// POST /api/image-prompt  multipart: image, style, language
export const createImagePrompt = asyncHandler(async (req, res) => {
  if (!req.file?.buffer?.length) throw new AppError(400, "NO_FILE", 'Attach an image in the "image" field.');
  // Charged when the button is pressed: ceil(MB × 5) whole tokens, refunded if generation fails.
  const cost = tokensForBytes(req.file.size ?? req.file.buffer.length, RATES.captionPerMB);
  const { result: data, balance } = await withCharge(req.user._id, cost, () =>
    imageToPrompt({
      apiKey: req.gemini.key,
      image: req.file.buffer,
      style: req.body?.style || "detailed",
      language: req.body?.language === "km" ? "km" : "en",
    })
  );
  res.json({ success: true, data: { ...data, keySource: req.gemini.source, cost, tokens: balance } });
});

// POST /api/video/resolve  { url }
export const resolveVideoLink = asyncHandler(async (req, res) => {
  const data = await resolveVideo(req.body?.url);
  res.json({ success: true, data });
});

// GET /api/video/download?token=…  → streams the file with a download header
export const downloadVideo = asyncHandler(async (req, res) => {
  const { url, name } = verifyMediaToken(req.query.token);
  const headers = { "user-agent": "Mozilla/5.0" };
  if (req.headers.range) headers.range = req.headers.range;
  const { res: upstream } = await safeFetch(url, { headers }, { timeoutMs: 20000 });
  if (!(upstream.ok || upstream.status === 206) || !upstream.body) {
    throw new AppError(502, "UPSTREAM_FAILED", "The source refused the download. Fetch the video again.");
  }
  res.status(upstream.status);
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) res.set(h, v);
  }
  res.set({
    "Content-Disposition": `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(name)}`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const stream = Readable.fromWeb(upstream.body);
  stream.on("error", () => res.destroy());
  req.on("close", () => stream.destroy());
  stream.pipe(res);
});

// POST /api/audio/convert  multipart: file, format, bitrate, [start, end]
export const convertAudio = asyncHandler(async (req, res) => {
  if (!req.file?.buffer?.length) throw new AppError(400, "NO_FILE", 'Attach a file in the "file" field.');
  const out = await convertToAudio(req.file.buffer, {
    format: String(req.body?.format || "mp3"),
    bitrate: req.body?.bitrate,
    startSec: req.body?.start,
    endSec: req.body?.end,
  });
  const base = String(req.body?.name || "audio").replace(/\.[^.]+$/, "").replace(/[^\w\-ក-៿ ]+/g, "_").slice(0, 80) || "audio";
  res.set({
    "Content-Type": out.type,
    "Content-Disposition": `attachment; filename="audio.${out.ext}"; filename*=UTF-8''${encodeURIComponent(base)}.${out.ext}`,
    "Cache-Control": "no-store",
  });
  res.send(out.audio);
});
