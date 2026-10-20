import { useSyncExternalStore } from "react";
import api from "./api";

// The Gemini key saved in the signed-in user's account (stored encrypted on the server).
// The browser only ever learns { hasKey, masked } — never the key itself.
let state = { loaded: false, hasKey: false, masked: "" };
const listeners = new Set();
const set = (next) => { state = { ...state, ...next }; listeners.forEach((l) => l()); };

export async function loadAccountKey() {
  try {
    const r = await api.get("/users/gemini-key");
    set({ loaded: true, hasKey: Boolean(r?.data?.hasKey), masked: r?.data?.masked || "" });
  } catch {
    set({ loaded: true, hasKey: false, masked: "" });
  }
}
export async function saveAccountKey(key) {
  const r = await api.put("/users/gemini-key", { key });
  set({ loaded: true, hasKey: true, masked: r?.data?.masked || "" });
}
export async function removeAccountKey() {
  await api.delete("/users/gemini-key");
  set({ hasKey: false, masked: "" });
}
export const resetAccountKey = () => set({ loaded: false, hasKey: false, masked: "" });

export function useAccountKey() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => state, () => state);
}
