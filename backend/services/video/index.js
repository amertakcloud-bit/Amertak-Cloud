import { AppError } from "../../lib/AppError.js";
import { detectProvider, fetchDirect, fetchPinterest, fetchTikTok } from "./providers.js";
import { signMediaToken } from "./sign.js";
import { assertPublicUrl } from "./ssrf.js";

export const deps = { fetchTikTok, fetchPinterest, fetchDirect };

const safeName = (s) => String(s || "video").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "video";

export async function resolveVideo(link) {
  const text = String(link || "").trim();
  if (!text || text.length > 2000) throw new AppError(400, "INVALID_URL", "Please paste a link.");
  await assertPublicUrl(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  const provider = detectProvider(url);
  if (provider === "unsupported") {
    throw new AppError(422, "UNSUPPORTED_SITE", "This site is not supported (YouTube, Facebook, Instagram and X block automated downloads). Supported: TikTok, Pinterest and direct file links.");
  }
  const info = await deps[{ tiktok: "fetchTikTok", pinterest: "fetchPinterest", direct: "fetchDirect" }[provider]](url);
  const base = safeName(info.title);
  return {
    provider: info.provider,
    title: info.title,
    author: info.author,
    duration: info.duration,
    thumbnail: info.thumbnail,
    formats: info.formats.map((f) => ({
      id: f.id,
      label: f.label,
      kind: f.kind,
      ext: f.ext,
      token: signMediaToken({ url: f.url, name: `${base}.${f.ext}` }),
    })),
  };
}
