import { AppError } from "../../lib/AppError.js";
import { deps as geminiDeps, getModels, extractText, mapGeminiError, parseModelJson } from "../../lib/geminiClient.js";

export const STYLES = {
  detailed: "a rich, detailed natural-language prompt (subject, setting, composition, lighting, colours, mood, camera/lens, art style) that could recreate this image in a text-to-image model",
  midjourney: "a Midjourney-style prompt: comma-separated descriptive phrases, ending with parameters such as --ar and --style when sensible",
  stable_diffusion: "a Stable Diffusion prompt as comma-separated weighted keywords, plus a separate short negative prompt",
  short: "a single concise sentence (max 30 words)",
};
const MIME = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];

export function sniffMime(buf) {
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 12 && buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  const brand = buf.slice(4, 12).toString("ascii");
  if (/^ftyp(heic|heix|mif1|heif)/.test(brand)) return "image/heic";
  return null;
}

export async function imageToPrompt({ apiKey, image, style = "detailed", language = "en" }) {
  const mime = sniffMime(image);
  if (!mime || !MIME.includes(mime)) throw new AppError(415, "UNSUPPORTED_IMAGE", "Please upload a PNG, JPEG or WebP image.");
  if (!STYLES[style]) throw new AppError(400, "INVALID_STYLE", `Unknown style. Use one of: ${Object.keys(STYLES).join(", ")}.`);
  const lang = language === "km" ? "Khmer (ភាសាខ្មែរ)" : "English";

  const instruction =
    `Look carefully at the image and write ${STYLES[style]}.\n` +
    `Write the prompt in ${lang}. Describe only what is really visible; do not invent text or brands.\n` +
    `Reply with ONLY JSON: {"prompt": string, "negativePrompt": string, "tags": string[] (5-10 short keywords in English), "title": string (max 6 words, ${lang})}.`;

  try {
    const client = await geminiDeps.createClient(apiKey);
    const res = await client.models.generateContent({
      model: getModels().general,
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: mime, data: image.toString("base64") } }, { text: instruction }] }],
      config: { responseMimeType: "application/json", temperature: 0.4 },
    });
    const parsed = parseModelJson(extractText(res));
    const prompt = String(parsed?.prompt ?? "").trim();
    if (!prompt) throw new AppError(502, "EMPTY_RESULT", "The AI returned no prompt. Please try again.");
    return {
      prompt,
      negativePrompt: String(parsed?.negativePrompt ?? "").trim(),
      tags: Array.isArray(parsed?.tags) ? parsed.tags.map(String).slice(0, 12) : [],
      title: String(parsed?.title ?? "").trim(),
      style,
      language,
      model: getModels().general,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw mapGeminiError(err);
  }
}
