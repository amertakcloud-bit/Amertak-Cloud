import { useSyncExternalStore } from "react";

// The user's own Gemini API key.
//  - lives in MEMORY only (a module variable) — never localStorage, never a URL, never logged
//  - optional "keep for this tab" uses sessionStorage (cleared when the tab closes)
//  - sent to OUR backend only, in the x-gemini-api-key header
let key = "";
const listeners = new Set();
const SS = "gk";

try {
  key = sessionStorage.getItem(SS) || "";
} catch {
  /* sessionStorage unavailable */
}

const emit = () => listeners.forEach((l) => l());

export function setGeminiKey(value, { remember = false } = {}) {
  key = String(value || "").trim();
  try {
    if (remember && key) sessionStorage.setItem(SS, key);
    else sessionStorage.removeItem(SS);
  } catch {
    /* ignore */
  }
  emit();
}

export const clearGeminiKey = () => setGeminiKey("");
export const getGeminiKey = () => key;
export const geminiHeaders = () => (key ? { "x-gemini-api-key": key } : {});
export const isKeyFormatOk = (v) => /^[\x21-\x7E]{8,512}$/.test(String(v || "").trim());

export function useGeminiKey() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => key,
    () => ""
  );
}

export const maskKey = (k) => (k ? `${k.slice(0, 4)}…${k.slice(-3)}` : "");
