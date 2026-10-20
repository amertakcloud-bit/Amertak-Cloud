// Browser-side storage for the project's media files (IndexedDB). The server only keeps the
// project JSON, so files stay on this device (Vercel limits uploads to 4.5 MB anyway).
const DB = "amertak-editor";
const STORE = "media";

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is not available"));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req?.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

const key = (projectId, mediaId) => `${projectId}:${mediaId}`;
export const putMedia = (projectId, mediaId, blob) => tx("readwrite", (s) => s.put(blob, key(projectId, mediaId)));
export const getMedia = (projectId, mediaId) => tx("readonly", (s) => s.get(key(projectId, mediaId)));
export const deleteMedia = (projectId, mediaId) => tx("readwrite", (s) => s.delete(key(projectId, mediaId)));
export async function deleteProjectMedia(projectId) {
  const db = await open();
  try {
    await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, "readwrite");
      const s = t.objectStore(STORE);
      const req = s.openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        if (String(c.key).startsWith(`${projectId}:`)) c.delete();
        c.continue();
      };
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

// Reads duration / size of a media file in the browser.
export function probeMedia(file) {
  const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("image/") ? "image" : null;
  if (!kind) return Promise.reject(new Error("UNSUPPORTED"));
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const done = (v) => { URL.revokeObjectURL(url); resolve(v); };
    const fail = () => { URL.revokeObjectURL(url); reject(new Error("UNREADABLE")); };
    if (kind === "image") {
      const img = new Image();
      img.onload = () => done({ kind, duration: 0, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = fail;
      img.src = url;
      return;
    }
    const el = document.createElement(kind === "video" ? "video" : "audio");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const d = Number.isFinite(el.duration) ? el.duration : 0;
      done({ kind, duration: d, width: el.videoWidth || 0, height: el.videoHeight || 0 });
    };
    el.onerror = fail;
    el.src = url;
  });
}
