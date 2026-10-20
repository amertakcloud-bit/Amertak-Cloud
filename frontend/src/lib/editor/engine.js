import { clipEnd, clipsAt, drawOrder, projectDuration } from "./model.js";

// Realtime preview + export engine.
// One <video>/<audio>/<img> element per clip, drawn onto a canvas; audio goes through WebAudio so
// the very same graph can be recorded for export (canvas.captureStream + MediaRecorder).
const FONT = '"Kantumruy Pro","Kantumruy","Noto Sans Khmer","Noto Sans SC",system-ui,sans-serif';

export class Engine {
  constructor({ canvas, getProject, onTime, onState }) {
    this.canvas = canvas;
    this.ctx2d = canvas.getContext("2d");
    this.getProject = getProject;
    this.onTime = onTime || (() => {});
    this.onState = onState || (() => {});
    this.urls = new Map(); // mediaId → object URL
    this.els = new Map(); // clipId → { el, kind, mediaId, gain, src }
    this.t = 0;
    this.playing = false;
    this.exporting = false;
    this.raf = 0;
    this.wall = 0;
    this.base = 0;
    this.audio = null;
    this.dest = null;
    this.dirty = true;
    this.disposed = false;
  }

  // ── media ──
  setMedia(mediaId, blob) {
    const old = this.urls.get(mediaId);
    if (old) URL.revokeObjectURL(old);
    this.urls.set(mediaId, URL.createObjectURL(blob));
    for (const [id, e] of this.els) if (e.mediaId === mediaId) { this.dropEl(id); }
    this.requestRender();
  }
  hasMedia(mediaId) { return this.urls.has(mediaId); }
  dropEl(id) {
    const e = this.els.get(id);
    if (!e) return;
    try { e.el.pause?.(); e.el.removeAttribute?.("src"); e.el.load?.(); } catch { /* ignore */ }
    try { e.node?.disconnect(); e.gain?.disconnect(); } catch { /* ignore */ }
    this.els.delete(id);
  }

  ensureAudio() {
    if (!this.audio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.audio = new AC();
      this.dest = this.audio.createMediaStreamDestination();
    }
    if (this.audio.state === "suspended") this.audio.resume().catch(() => {});
    return this.audio;
  }

  elFor(clip) {
    let e = this.els.get(clip.id);
    const url = this.urls.get(clip.mediaId);
    if (e && e.src !== url) { this.dropEl(clip.id); e = null; }
    if (e) return e;
    if (!url) return null;
    let el;
    if (clip.type === "image") {
      el = new Image();
      el.onload = () => this.requestRender();
      el.src = url;
    } else {
      el = document.createElement(clip.type === "video" ? "video" : "audio");
      el.preload = "auto";
      el.playsInline = true;
      el.crossOrigin = "anonymous";
      el.src = url;
      el.addEventListener("seeked", () => this.requestRender());
      el.addEventListener("loadeddata", () => this.requestRender());
    }
    e = { el, kind: clip.type, mediaId: clip.mediaId, src: url, gain: null, node: null };
    if (clip.type !== "image") {
      const ac = this.ensureAudio();
      try {
        e.node = ac.createMediaElementSource(el);
        e.gain = ac.createGain();
        e.node.connect(e.gain);
        e.gain.connect(ac.destination);
        e.gain.connect(this.dest);
      } catch { /* element already wired */ }
    }
    this.els.set(clip.id, e);
    return e;
  }

  // ── transport ──
  duration() { return projectDuration(this.getProject()); }
  seek(t) {
    this.t = Math.max(0, t);
    this.base = this.t;
    this.wall = performance.now();
    this.syncMedia(false);
    this.onTime(this.t);
    this.requestRender();
  }
  play() {
    if (this.playing) return;
    const dur = this.duration();
    if (dur <= 0) return;
    if (this.t >= dur - 0.05) this.t = 0;
    this.ensureAudio();
    this.playing = true;
    this.base = this.t;
    this.wall = performance.now();
    this.onState({ playing: true });
    this.loop();
  }
  pause() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    for (const e of this.els.values()) e.el.pause?.();
    this.onState({ playing: false });
    this.requestRender();
  }
  toggle() { this.playing ? this.pause() : this.play(); }

  loop = () => {
    if (!this.playing || this.disposed) return;
    this.t = this.base + (performance.now() - this.wall) / 1000;
    const dur = this.duration();
    if (this.t >= dur) {
      this.t = dur;
      this.syncMedia(true);
      this.draw();
      this.onTime(this.t);
      this.pause();
      this.onEnded?.();
      return;
    }
    this.syncMedia(true);
    this.draw();
    this.onTime(this.t);
    this.raf = requestAnimationFrame(this.loop);
  };

  // Keeps every media element aligned with the playhead.
  syncMedia(playing) {
    const p = this.getProject();
    const active = new Map(clipsAt(p, this.t).map((c) => [c.id, c]));
    for (const c of p.clips) {
      if (c.type === "image" || c.type === "text" || c.type === "caption") continue;
      const on = active.get(c.id);
      const e = on ? this.elFor(c) : this.els.get(c.id);
      if (!e) continue;
      if (!on) { if (!e.el.paused) e.el.pause(); continue; }
      const want = (c.offset || 0) + (this.t - c.start);
      if (e.gain) e.gain.gain.value = Math.max(0, Math.min(2, c.volume ?? 1));
      if (Math.abs(e.el.currentTime - want) > (playing ? 0.3 : 0.02)) {
        try { e.el.currentTime = want; } catch { /* not seekable yet */ }
      }
      if (playing) { if (e.el.paused && e.el.readyState >= 2) e.el.play().catch(() => {}); }
      else if (!e.el.paused) e.el.pause();
    }
  }

  requestRender() {
    this.dirty = true;
    if (this.playing || this.disposed || this.pending) return;
    this.pending = requestAnimationFrame(() => { this.pending = 0; this.draw(); });
  }

  // ── drawing ──
  draw() {
    const p = this.getProject();
    const { canvas, ctx2d: g } = this;
    if (canvas.width !== p.width || canvas.height !== p.height) { canvas.width = p.width; canvas.height = p.height; }
    g.fillStyle = "#000";
    g.fillRect(0, 0, canvas.width, canvas.height);
    for (const c of drawOrder(clipsAt(p, this.t))) {
      g.save();
      g.globalAlpha = c.opacity ?? 1;
      if (c.type === "text" || c.type === "caption") this.drawText(g, c, p);
      else this.drawVisual(g, c, p);
      g.restore();
    }
    this.dirty = false;
  }

  drawVisual(g, c, p) {
    const e = this.elFor(c);
    if (!e) return;
    const el = e.el;
    const sw = el.videoWidth || el.naturalWidth || 0, sh = el.videoHeight || el.naturalHeight || 0;
    if (!sw || !sh || (c.type === "video" && el.readyState < 2)) return;
    const fit = Math.min(p.width / sw, p.height / sh) * (c.scale ?? 1);
    const w = sw * fit, h = sh * fit;
    g.drawImage(el, (c.x ?? 0.5) * p.width - w / 2, (c.y ?? 0.5) * p.height - h / 2, w, h);
  }

  drawText(g, c, p) {
    const st = c.style || {};
    const px = Math.max(8, Math.round((st.size || 6) / 100 * p.height));
    g.font = `${st.bold ? "700" : "400"} ${px}px ${FONT}`;
    g.textBaseline = "middle";
    g.textAlign = st.align === "left" ? "left" : st.align === "right" ? "right" : "center";
    const maxW = p.width * 0.9;
    const lines = wrap(g, String(c.text || ""), maxW);
    const lh = px * 1.3;
    const cx = (c.x ?? 0.5) * p.width;
    const top = (c.y ?? 0.5) * p.height - (lines.length * lh) / 2;
    if (st.bg && st.bg !== "rgba(0,0,0,0)" && st.bg !== "transparent") {
      const w = Math.min(maxW, Math.max(...lines.map((l) => g.measureText(l).width))) + px * 0.8;
      const bx = st.align === "left" ? cx - px * 0.4 : st.align === "right" ? cx - w + px * 0.4 : cx - w / 2;
      g.fillStyle = st.bg;
      roundRect(g, bx, top - px * 0.15, w, lines.length * lh + px * 0.3, px * 0.25);
      g.fill();
    }
    lines.forEach((l, i) => {
      const y = top + lh * i + lh / 2;
      if (st.outline) { g.lineWidth = Math.max(2, px / 7); g.strokeStyle = "rgba(0,0,0,.85)"; g.lineJoin = "round"; g.strokeText(l, cx, y, maxW); }
      g.fillStyle = st.color || "#fff";
      g.fillText(l, cx, y, maxW);
    });
  }

  // ── export ──
  static pickMime() {
    const list = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    return list.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || "";
  }

  // Plays the timeline once in real time and records it. Resolves { blob, ext }.
  async exportVideo({ onProgress = () => {}, signal } = {}) {
    if (this.exporting) throw new Error("Already exporting");
    const dur = this.duration();
    if (dur <= 0) throw new Error("EMPTY");
    const mime = Engine.pickMime();
    if (!mime || !window.MediaRecorder) throw new Error("NO_RECORDER");
    this.pause();
    this.exporting = true;
    this.ensureAudio();
    this.seek(0);
    // Make sure every clip's element is created & ready before recording starts.
    const p = this.getProject();
    await Promise.all(p.clips.filter((c) => ["video", "audio", "image"].includes(c.type)).map((c) => this.whenReady(this.elFor(c))));
    this.seek(0);
    const stream = this.canvas.captureStream(p.fps || 30);
    this.dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const finished = new Promise((resolve, reject) => {
      rec.onstop = resolve;
      rec.onerror = (e) => reject(e.error || new Error("RECORDER_ERROR"));
    });
    const tick = setInterval(() => onProgress(Math.min(1, this.t / dur)), 250);
    let aborted = false;
    const onAbort = () => { aborted = true; this.pause(); if (rec.state !== "inactive") rec.stop(); };
    signal?.addEventListener("abort", onAbort);
    this.onEnded = () => { if (rec.state !== "inactive") setTimeout(() => rec.stop(), 150); };
    try {
      rec.start(500);
      this.play();
      await finished;
    } finally {
      clearInterval(tick);
      signal?.removeEventListener("abort", onAbort);
      this.onEnded = null;
      this.exporting = false;
      stream.getTracks().forEach((t) => t.stop());
      if (rec.state !== "inactive") rec.stop();
    }
    if (aborted) throw Object.assign(new Error("ABORTED"), { code: "ABORTED" });
    onProgress(1);
    return { blob: new Blob(chunks, { type: mime.split(";")[0] }), ext: mime.startsWith("video/mp4") ? "mp4" : "webm" };
  }

  whenReady(e) {
    if (!e || e.kind === "image") return e?.el?.complete ? Promise.resolve() : new Promise((r) => { if (e) e.el.onload = r; else r(); });
    if (e.el.readyState >= 2) return Promise.resolve();
    return new Promise((r) => { e.el.addEventListener("loadeddata", r, { once: true }); setTimeout(r, 4000); });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.pending);
    for (const id of [...this.els.keys()]) this.dropEl(id);
    for (const u of this.urls.values()) URL.revokeObjectURL(u);
    this.urls.clear();
    this.audio?.close?.().catch(() => {});
  }
}

// Wraps text to a pixel width (works for Khmer/Chinese too: breaks per grapheme when a word is too long).
function wrap(g, text, maxW) {
  const out = [];
  for (const para of text.split("\n")) {
    const words = para.split(/(\s+)/).filter((w) => w.length);
    let line = "";
    const pushLine = () => { if (line.trim()) out.push(line.trim()); line = ""; };
    for (const w of words) {
      if (g.measureText(line + w).width <= maxW) { line += w; continue; }
      pushLine();
      if (g.measureText(w).width <= maxW) { line = w; continue; }
      for (const ch of Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(w), (s) => s.segment)) {
        if (g.measureText(line + ch).width > maxW) pushLine();
        line += ch;
      }
    }
    pushLine();
    if (!para.trim()) out.push("");
  }
  return out.length ? out : [""];
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
