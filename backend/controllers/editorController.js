import { AppError } from "../lib/AppError.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import { deps as geminiDeps, extractText, getModels, mapGeminiError, parseModelJson } from "../lib/geminiClient.js";
import { withCharge } from "../lib/billing.js";
import { planEdits } from "../services/editorAi.js";
import { createProject, deleteProject, getProject, listProjects, updateProject } from "../services/editorProjects.js";

export const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { projects: await listProjects(req.user._id) } });
});
export const create = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: { project: await createProject(req.user._id, req.body || {}) } });
});
export const read = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { project: await getProject(req.user._id, req.params.id) } });
});
export const update = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { project: await updateProject(req.user._id, req.params.id, req.body || {}) } });
});
export const remove = asyncHandler(async (req, res) => {
  await deleteProject(req.user._id, req.params.id);
  res.json({ success: true });
});

const LANGS = { auto: "the source language (Chinese or English)", zh: "Chinese", en: "English" };
export const MAX_TRANSLATE_CUES = 400;
export const MAX_TRANSLATE_CHARS = 30000;

// Pure helper (unit-tested): translates a list of subtitle lines to Khmer with Gemini and
// returns exactly one Khmer string per input line.
export async function translateToKhmer({ apiKey, lines, from = "auto", speakers = false }) {
  const src = LANGS[from] || LANGS.auto;
  const prompt =
    `Translate each subtitle line from ${src} to natural, spoken Khmer (ភាសាខ្មែរ) that a voice actor can read aloud.\n` +
    `Keep the meaning, keep each line short, do not merge or split lines, and do not add notes. ` +
    `Write numbers and names the way Khmer speakers say them.\n` +
    (speakers
      ? `The lines are consecutive dialogue. For each line decide the speaker's gender from context (names, pronouns, tone, who is being addressed): "m" male or "f" female; the same speaker keeps the same gender; when unsure use "m".\n` +
        `Reply with ONLY a JSON array of exactly ${lines.length} objects {"t": "<Khmer text>", "g": "m"|"f"}, in the same order.\n\n`
      : `Reply with ONLY a JSON array of exactly ${lines.length} strings, in the same order.\n\n`) +
    JSON.stringify(lines);
  try {
    const client = await geminiDeps.createClient(apiKey);
    const res = await client.models.generateContent({
      model: getModels().general,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", temperature: 0.2 },
    });
    const parsed = parseModelJson(extractText(res));
    const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.translations) ? parsed.translations : null;
    if (!arr || arr.length !== lines.length) {
      throw new AppError(502, "BAD_TRANSLATION", "The AI returned an unexpected translation. Please try again.");
    }
    if (speakers) return arr.map((x) => (typeof x === "string" ? { text: x.trim(), gender: "m" } : { text: String(x?.t ?? x?.text ?? "").trim(), gender: String(x?.g ?? x?.gender ?? "m").toLowerCase().startsWith("f") ? "f" : "m" }));
    return arr.map((x) => String(x ?? "").trim());
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw mapGeminiError(err);
  }
}

// POST /api/editor/translate  { lines: string[], from?: "auto"|"zh"|"en" }
export const translate = asyncHandler(async (req, res) => {
  const lines = req.body?.lines;
  if (!Array.isArray(lines) || !lines.length) throw new AppError(400, "INVALID_BODY", '"lines" must be a non-empty array of text.');
  if (lines.length > MAX_TRANSLATE_CUES) throw new AppError(400, "TOO_MANY_LINES", `Translate at most ${MAX_TRANSLATE_CUES} lines at a time.`);
  const clean = lines.map((l) => String(l ?? "").replace(/\s+/g, " ").trim());
  if (clean.join("").length > MAX_TRANSLATE_CHARS) throw new AppError(413, "TEXT_TOO_LONG", "That is too much text to translate at once.");
  const speakers = req.body?.speakers === true;
  const out = await translateToKhmer({ apiKey: req.gemini.key, lines: clean, from: req.body?.from, speakers });
  res.json({ success: true, data: speakers
    ? { lines: out.map((x) => x.text), genders: out.map((x) => x.gender), keySource: req.gemini.source }
    : { lines: out, keySource: req.gemini.source } });
});

export const AI_EDIT_COST = 1; // tokens per AI instruction (refunded automatically if it fails)

// POST /api/editor/ai  { instruction, project: { width,height,duration,playhead,selected,clips[] } }
export const aiEdit = asyncHandler(async (req, res) => {
  const { result, balance } = await withCharge(
    req.user._id, AI_EDIT_COST,
    () => planEdits({ apiKey: req.gemini.key, instruction: req.body?.instruction, project: req.body?.project }),
    "aiedit"
  );
  res.json({ success: true, data: { ...result, cost: AI_EDIT_COST, tokens: balance, keySource: req.gemini.source } });
});
