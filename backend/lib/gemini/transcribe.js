// Gemini calls used by the SRT tool.
//
//  1) gemini-3.5-transcribe + word timestamps (Interactions API — the shape documented by Google):
//       generation_config.transcription_config.mode = { type: "verbatim", timestamp_granularities: ["word"] }
//       result words are annotations: { type: "word_info", text, start_offset: "0.100s", end_offset: "0.450s" }
//  2) legacy generateContent with audioTranscriptionConfig.wordTimestamp (older SDK shape)
//  3) general model (gemini-3.8-flash) → segment-level JSON when the transcribe model is unavailable.
//
// Timestamps are produced by the model from the real audio — nothing here estimates them.
import { AppError } from "../AppError.js";
import { extractText, getModels, mapGeminiError, parseModelJson } from "../geminiClient.js";
import { parseTime } from "../../services/srt/time.js";

export function extractWords(response) {
  const words = [];
  const push = (text, s, e) => {
    const start = parseTime(s);
    const end = parseTime(e);
    if (text != null && start !== null && end !== null) words.push({ text: String(text), start, end });
  };
  for (const step of response?.steps ?? []) {
    for (const content of step?.content ?? []) {
      for (const a of content?.annotations ?? []) {
        if (a?.type === "word_info") {
          push(a.text ?? a.word, a.start_offset ?? a.startOffset, a.end_offset ?? a.endOffset);
        }
      }
    }
  }
  if (!words.length) {
    for (const cand of response?.candidates ?? []) {
      for (const part of cand?.content?.parts ?? []) {
        for (const w of part?.audioTranscription?.words ?? []) push(w.word, w.startOffset, w.endOffset);
      }
    }
  }
  return words;
}

const looksLikeInlineUnsupported = (err) => {
  const m = String(err?.message || "").toLowerCase();
  return (Number(err?.status) === 400 || m.includes("invalid_argument")) && (m.includes("inline") || m.includes("data") || m.includes("size"));
};

async function viaInteractions(client, wav, model) {
  const create = (input) =>
    client.interactions.create({
      model,
      input,
      generation_config: {
        transcription_config: { mode: { type: "verbatim", timestamp_granularities: ["word"] } },
      },
    });

  try {
    return await create([{ type: "audio", data: wav.toString("base64"), mime_type: "audio/wav" }]);
  } catch (err) {
    if (!looksLikeInlineUnsupported(err)) throw err;
    // Fallback: upload through the Files API (works for every audio input form).
    const file = await client.files.upload({ file: new Blob([wav], { type: "audio/wav" }), config: { mimeType: "audio/wav" } });
    try {
      return await create([{ type: "audio", uri: file.uri, mime_type: file.mimeType || "audio/wav" }]);
    } finally {
      try {
        if (file?.name) await client.files.delete({ name: file.name });
      } catch {
        /* Gemini deletes uploaded files automatically after 48 h */
      }
    }
  }
}

async function viaLegacy(client, wav, model) {
  return client.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } }] }],
    config: { audioTranscriptionConfig: { wordTimestamp: true } },
  });
}

// → { words: [{text,start,end}] } with times RELATIVE to the chunk.
export async function transcribeWords(client, wav) {
  const { transcribe } = getModels();
  let response;
  try {
    response =
      client.interactions && typeof client.interactions.create === "function"
        ? await viaInteractions(client, wav, transcribe)
        : await viaLegacy(client, wav, transcribe);
  } catch (err) {
    throw mapGeminiError(err);
  }
  return { words: extractWords(response), text: extractText(response) };
}

const SEGMENT_PROMPT = `Transcribe this Khmer (ភាសាខ្មែរ) audio exactly as spoken, in Khmer Unicode script. Do not translate and do not add words that are not spoken.
Split it into subtitle segments of one sentence or phrase each (about 7 seconds at most).
Return ONLY a JSON array, no markdown. Each item: {"start":"MM:SS.mmm","end":"MM:SS.mmm","text":"..."}.
Timestamps must be the real times in the audio, in order and not overlapping. If there is no speech, return [].`;

// → segments [{text,start,end}] RELATIVE to the chunk (lower precision than word timestamps).
export async function transcribeSegments(client, wav) {
  const { general } = getModels();
  let response;
  try {
    response = await client.models.generateContent({
      model: general,
      contents: [
        {
          role: "user",
          parts: [{ text: SEGMENT_PROMPT }, { inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } }],
        },
      ],
      config: { responseMimeType: "application/json" },
    });
  } catch (err) {
    throw mapGeminiError(err);
  }
  const arr = parseModelJson(extractText(response));
  if (!Array.isArray(arr)) throw new AppError(502, "BAD_MODEL_OUTPUT", "Gemini did not return a segment list.");
  return arr
    .map((s) => ({ start: parseTime(s.start), end: parseTime(s.end), text: String(s.text ?? "").trim() }))
    .filter((s) => s.text && s.start !== null && s.end !== null && s.end > s.start);
}
