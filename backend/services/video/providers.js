import { AppError } from "../../lib/AppError.js";
import { safeFetch } from "./ssrf.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export function detectProvider(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new AppError(400, "INVALID_URL", "Please paste a valid link.");
  }
  const h = u.hostname.toLowerCase().replace(/^www\./, "");
  if (h === "tiktok.com" || h.endsWith(".tiktok.com")) return "tiktok";
  if (h === "pinterest.com" || h.endsWith(".pinterest.com") || /^pinterest\.[a-z.]+$/.test(h) || h === "pin.it") return "pinterest";
  if (/(^|\.)(youtube\.com|youtu\.be|facebook\.com|fb\.watch|instagram\.com|twitter\.com|x\.com)$/.test(h)) return "unsupported";
  return "direct";
}

const abs = (v, base) => {
  if (!v) return null;
  try {
    return new URL(v, base).toString();
  } catch {
    return null;
  }
};

export async function fetchTikTok(link) {
  const body = new URLSearchParams({ url: link, hd: "1" });
  let json;
  try {
    const { res } = await safeFetch(
      "https://www.tikwm.com/api/",
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA }, body },
      { timeoutMs: 20000 }
    );
    json = await res.json();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, "PROVIDER_UNAVAILABLE", "The TikTok resolver is unavailable right now. Please try again later.");
  }
  if (json?.code !== 0 || !json.data) {
    throw new AppError(404, "VIDEO_NOT_FOUND", "Could not find that TikTok video. It may be private, removed or the link is wrong.");
  }
  const d = json.data;
  const base = "https://www.tikwm.com";
  const formats = [];
  const push = (label, u, kind = "video", ext = "mp4") => {
    const url = abs(u, base);
    if (url) formats.push({ id: `${kind}-${label}`, label, kind, ext, url });
  };
  push("HD (no watermark)", d.hdplay);
  push("Standard (no watermark)", d.play);
  push("With watermark", d.wmplay);
  push("Audio only", d.music, "audio", "mp3");
  if (!formats.length) throw new AppError(404, "VIDEO_NOT_FOUND", "No downloadable file was found for that video.");
  return {
    provider: "tiktok",
    title: String(d.title || "TikTok video").slice(0, 200),
    author: d.author?.nickname || d.author?.unique_id || "",
    duration: Number(d.duration) || null,
    thumbnail: abs(d.cover || d.origin_cover, base),
    formats,
  };
}

function metaContent(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  const m = html.match(re);
  return m ? (m[1] || m[2]).replace(/&amp;/g, "&") : null;
}

export async function fetchPinterest(link) {
  let html, finalUrl;
  try {
    const { res, url } = await safeFetch(link, { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" } }, { timeoutMs: 15000 });
    finalUrl = url;
    if (!res.ok) throw new AppError(404, "VIDEO_NOT_FOUND", "Could not open that Pinterest link.");
    html = (await res.text()).slice(0, 3_000_000);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, "PROVIDER_UNAVAILABLE", "Pinterest could not be reached. Please try again later.");
  }
  const title = (metaContent(html, "og:title") || "Pinterest pin").slice(0, 200);
  const thumb = abs(metaContent(html, "og:image"), finalUrl);
  const formats = [];

  // Direct mp4 renditions embedded in page JSON.
  const seen = new Set();
  for (const m of html.matchAll(/"url"\s*:\s*"(https:\\?\/\\?\/v[0-9]*\.pinimg\.com[^"]+?\.mp4)"/g)) {
    const url = m[1].replace(/\\\//g, "/");
    if (seen.has(url)) continue;
    seen.add(url);
    formats.push({ id: `video-${formats.length}`, label: `Video ${formats.length + 1}`, kind: "video", ext: "mp4", url });
  }
  const ogVideo = abs(metaContent(html, "og:video") || metaContent(html, "og:video:url"), finalUrl);
  if (ogVideo && /\.mp4(\?|$)/i.test(ogVideo) && !seen.has(ogVideo)) formats.unshift({ id: "video-og", label: "Video", kind: "video", ext: "mp4", url: ogVideo });

  if (!formats.length) {
    // Image pin: offer the original-size image.
    const img = (html.match(/"(https:\\?\/\\?\/i\.pinimg\.com\/originals\/[^"]+?\.(?:jpg|png|webp))"/) || [])[1]?.replace(/\\\//g, "/") || thumb;
    if (img) formats.push({ id: "image-0", label: "Image (original)", kind: "image", ext: (img.match(/\.(jpg|png|webp)/i) || [, "jpg"])[1].toLowerCase(), url: img });
  }
  if (!formats.length) throw new AppError(404, "VIDEO_NOT_FOUND", "No downloadable media was found on that Pinterest pin.");
  // Pinterest HLS (m3u8) is intentionally not offered (needs ffmpeg).
  return { provider: "pinterest", title, author: "", duration: null, thumbnail: thumb, formats };
}

const EXT_BY_TYPE = { "video/mp4": "mp4", "video/webm": "webm", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/wav": "wav", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export async function fetchDirect(link) {
  const { res, url } = await safeFetch(link, { method: "GET", headers: { "user-agent": UA, range: "bytes=0-0" } }, { timeoutMs: 12000 });
  res.body?.cancel?.().catch?.(() => {});
  const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!(res.ok || res.status === 206) || !EXT_BY_TYPE[type]) {
    throw new AppError(422, "UNSUPPORTED_LINK", "That link is not a direct video/audio/image file. Supported sites: TikTok, Pinterest and direct file links.");
  }
  const kind = type.split("/")[0];
  const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "file");
  return { provider: "direct", title: name.slice(0, 200), author: "", duration: null, thumbnail: kind === "image" ? url : null, formats: [{ id: `${kind}-0`, label: "Original file", kind, ext: EXT_BY_TYPE[type], url }] };
}
