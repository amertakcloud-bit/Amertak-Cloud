// Khmer text helpers (Node's ICU has Khmer word/grapheme dictionaries).
const graphemeSeg = new Intl.Segmenter("km", { granularity: "grapheme" });
const wordSeg = new Intl.Segmenter("km", { granularity: "word" });

export const graphemes = (s) => Array.from(graphemeSeg.segment(s), (x) => x.segment);
export const graphemeLength = (s) => graphemes(s).length;

// Splits text into words (keeps punctuation as separate tokens).
export function splitWords(s) {
  return Array.from(wordSeg.segment(s), (x) => x.segment).filter((t) => t.trim().length > 0);
}

export const SENTENCE_END = /[។៕?!؟.…]$/;
const KHMER = /[ក-៿]/;
const WORDLIKE = /[\p{L}\p{N}]/u;

// Khmer is written without spaces; Latin words/numbers need one.
export function joinWords(parts) {
  let out = "";
  for (const raw of parts) {
    const w = String(raw).trim();
    if (!w) continue;
    if (out) {
      const prev = out[out.length - 1];
      const next = w[0];
      if (WORDLIKE.test(prev) && WORDLIKE.test(next) && !KHMER.test(prev) && !KHMER.test(next)) out += " ";
    }
    out += w;
  }
  return out;
}

// For comparing text: NFC, drop spaces, punctuation and zero-width characters.
export function normalizeForMatch(s) {
  return String(s)
    .normalize("NFC")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[^\p{L}\p{N}\p{M}]/gu, "");
}
