import { API_URL, getToken } from "./api";
import { geminiHeaders } from "./geminiKey";

// Fetch layer for the tool APIs. Every function maps 1:1 to a backend endpoint.
export class ApiError extends Error {
  constructor(message, { status = 0, code = "ERROR", data = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function request(path, { method = "GET", json, form, headers = {}, blob = false, signal, params, withKey = false, job = "" } = {}) {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""))}` : "";
  let res;
  try {
    res = await fetch(`${API_URL}${path}${qs}`, {
      method,
      credentials: "include",
      signal,
      headers: {
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        ...(withKey ? geminiHeaders() : {}),
        ...(job ? { "x-job": job } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : form,
    });
  } catch (e) {
    if (e?.name === "AbortError") throw new ApiError("Cancelled", { code: "ABORTED" });
    console.error(`[API] request failed: ${API_URL}${path} (page origin: ${window.location.origin}). Check VITE_API_URL and the backend CLIENT_URL.`);
    throw new ApiError("Cannot reach the server. Please check your connection.", { code: "NETWORK" });
  }

  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* not JSON (e.g. Vercel 413 page) */ }
    const fallback = res.status === 413 ? "The file is too large for the server (max ≈ 4 MB per request)." : `Request failed (${res.status}).`;
    throw new ApiError(data?.message || fallback, { status: res.status, code: data?.code || (res.status === 413 ? "TOO_LARGE" : "HTTP_" + res.status), data });
  }
  if (blob) return { blob: await res.blob(), headers: res.headers };
  try {
    return await res.json();
  } catch {
    throw new ApiError("The server returned an unexpected response.", { status: res.status, code: "BAD_RESPONSE" });
  }
}

// retries transient failures (network / 429 / 5xx) with backoff
export async function withRetry(fn, { retries = 2, baseMs = 800, signal } = {}) {
  let last;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const transient = e instanceof ApiError && (e.code === "NETWORK" || e.status === 429 || e.status >= 500 || e.status === 0) && e.code !== "ABORTED";
      if (!transient || i === retries || signal?.aborted) throw e;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    }
  }
  throw last;
}

export const toolsApi = {
  status: () => request("/tools"),

  // ── SRT
  srtStatus: () => request("/srt/status"),
  validateKey: (key) => request("/srt/validate-key", { method: "POST", headers: { "x-gemini-api-key": key } }),
  srtStart: (sizeBytes) => request("/srt/start", { method: "POST", json: { sizeBytes } }),
  srtRefund: (job) => request("/srt/refund", { method: "POST", json: { job } }),
  srtChunk: (wavBlob, offset, mode, signal, job) => {
    const form = new FormData();
    form.append("audio", wavBlob, "chunk.wav");
    form.append("offset", String(offset));
    if (mode) form.append("mode", mode);
    return request("/srt/chunk", { method: "POST", form, withKey: true, signal, job });
  },
  srtCues: (body, signal) => request("/srt/cues", { method: "POST", json: body, signal }),
  srtAlign: (body) => request("/srt/align", { method: "POST", json: body }),
  srtExport: (body) => request("/srt/export", { method: "POST", json: body, blob: true }),

  // ── TTS
  ttsVoices: () => request("/tts/voices"),
  tts: (body, signal) => request("/tts", { method: "POST", json: body, blob: true, signal }),

  // ── QR
  qr: (body) => request("/qr", { method: "POST", json: body, blob: true }),

  qrImageUpload: (file) => {
    const form = new FormData();
    form.append("image", file, file.name || "image");
    return request("/qr/image", { method: "POST", form });
  },
  // Absolute public URL that the QR code encodes (works with a relative /api base too).
  qrImageUrl: (path) => `${/^https?:/i.test(API_URL) ? API_URL : window.location.origin + API_URL}${path}`,

  // ── Image → prompt
  imagePrompt: (file, { style, language }, signal) => {
    const form = new FormData();
    form.append("image", file, file.name || "image.jpg");
    form.append("style", style);
    form.append("language", language);
    return request("/image-prompt", { method: "POST", form, withKey: true, signal });
  },

  // ── Video editor
  editorAi: (instruction, project, signal) => request("/editor/ai", { method: "POST", json: { instruction, project }, withKey: true, signal }),
  editorTranslate: (lines, from, signal) => request("/editor/translate", { method: "POST", json: { lines, from }, withKey: true, signal }),

  // ── Video downloader
  videoResolve: (url, signal) => request("/video/resolve", { method: "POST", json: { url }, signal }),
  videoDownloadUrl: (token) => `${API_URL}/video/download?token=${encodeURIComponent(token)}`,

  // ── Audio export
  audioConvert: (file, { format, bitrate, start, end }, signal) => {
    const form = new FormData();
    form.append("format", format);
    form.append("bitrate", String(bitrate));
    if (start) form.append("start", String(start));
    if (end) form.append("end", String(end));
    form.append("name", file.name);
    form.append("file", file, file.name);
    return request("/audio/convert", { method: "POST", form, blob: true, signal });
  },
};

export { API_URL };
