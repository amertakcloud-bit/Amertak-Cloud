import { createHash, randomUUID } from "node:crypto";
import { AppError } from "./AppError.js";

// Real Microsoft Edge neural voices via the pure-JS `node-edge-tts` package
// (no Python / no binaries → works on Vercel). Audio is MP3.
// If the voice service cannot be reached we FAIL with a clear error — we never return
// fake "beep" audio.

export const KHMER_VOICES = [
  { value: "km-KH-PisethNeural", label: "Piseth", gender: "Male" },
  { value: "km-KH-SreymomNeural", label: "Sreymom", gender: "Female" },
];
export const KHMER_TTS_VOICES = { piseth: KHMER_VOICES[0].value, sreymom: KHMER_VOICES[1].value, default: KHMER_VOICES[0].value };

// Pure-JS Edge read-aloud client (WebSocket, all in memory — nothing is written to disk, so it is
// safe on Vercel). Includes the Sec-MS-GEC token Microsoft now requires (older clients get 403).
const TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROME_VERSIONS = ["143.0.3650.75", "130.0.2849.68", "130.0.2849.68:min"]; // tried in order (Microsoft rejects very old ones)
const WS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";

export function secMsGec(now = Date.now(), skewMs = 0) {
  let ticks = Math.floor((now + skewMs) / 1000) + 11644473600;
  ticks -= ticks % 300;
  return createHash("sha256").update(`${ticks * 1e7}${TOKEN}`).digest("hex").toUpperCase();
}
const esc = (t) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const stamp = () => new Date().toUTCString().replace(/^(\w+), (\d+) (\w+) (\d+)/, "$1 $3 $2 $4").replace("GMT", "GMT+0000 (Coordinated Universal Time)");

export const deps = {
  // Returns an MP3 Buffer. Replaceable in tests.
  async synthesizeEdge({ text, voice, rate, pitch, volume, outputFormat, timeout, chrome: variant = CHROME_VERSIONS[0] }) {
    const minimal = variant.endsWith(":min"); // the plain handshake of the old node-edge-tts package
    const chrome = variant.replace(":min", "");
    const { default: WebSocket } = await import("ws");
    const id = randomUUID().replace(/-/g, "");
    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/XMLSchema' xml:lang='km-KH'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>${esc(text)}</prosody></voice></speak>`;
    let skew = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          const url = `${WS_URL}?TrustedClientToken=${TOKEN}&Sec-MS-GEC=${secMsGec(Date.now(), skew)}&Sec-MS-GEC-Version=1-${chrome}${minimal ? "" : `&ConnectionId=${id}`}`;
          const ws = new WebSocket(url, {
            headers: {
              ...(minimal ? {} : { Pragma: "no-cache", "Cache-Control": "no-cache" }),
              Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
              "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome.split(".")[0]}.0.0.0 Safari/537.36 Edg/${chrome.split(".")[0]}.0.0.0`,
              "Accept-Language": "en-US,en;q=0.9",
              ...(minimal ? {} : { Cookie: `muid=${randomUUID().replace(/-/g, "").toUpperCase()};` }),
            },
          });
          const chunks = [];
          const timer = setTimeout(() => { ws.terminate(); reject(new Error("timeout")); }, timeout);
          const fail = (e) => { clearTimeout(timer); reject(e); };
          ws.on("unexpected-response", (_req, res) => {
            const e = new Error(`HTTP ${res.statusCode}`); e.status = res.statusCode; e.date = res.headers?.date; fail(e); ws.terminate(); res.resume?.();
          });
          ws.on("error", fail);
          ws.on("open", () => {
            ws.send(`X-Timestamp:${stamp()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
              JSON.stringify({ context: { synthesis: { audio: { metadataoptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "false" }, outputFormat } } } }));
            ws.send(`X-RequestId:${id}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${stamp()}Z\r\nPath:ssml\r\n\r\n${ssml}`);
          });
          ws.on("message", (data, isBinary) => {
            if (!isBinary) {
              if (String(data).includes("Path:turn.end")) { clearTimeout(timer); ws.close(); resolve(Buffer.concat(chunks)); }
              return;
            }
            const buf = Buffer.from(data);
            const headLen = buf.readUInt16BE(0);
            if (buf.subarray(2, 2 + headLen).toString().includes("Path:audio")) chunks.push(buf.subarray(2 + headLen));
          });
          ws.on("close", () => { clearTimeout(timer); if (chunks.length) resolve(Buffer.concat(chunks)); else reject(new Error("closed without audio")); });
        });
      } catch (e) {
        // 403 usually means our clock differs from Microsoft's → retry once with the server's clock.
        if (attempt === 0 && e.status === 403 && e.date) { skew = Date.parse(e.date) - Date.now(); continue; }
        throw e;
      }
    }
  },


  // Official Azure Speech REST API — same neural voices (km-KH-PisethNeural / SreymomNeural), not blocked on
  // cloud IPs. Free tier F0: 500 000 characters / month. Needs AZURE_SPEECH_KEY + AZURE_SPEECH_REGION.
  async synthesizeAzure({ text, voice, rate, pitch, volume, outputFormat, timeout }) {
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    if (!key || !region) throw new Error("azure not configured");
    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='km-KH'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>${esc(text)}</prosody></voice></speak>`;
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": outputFormat, "User-Agent": "AmertakCloud" },
      body: ssml,
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) throw new Error(`azure HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 120)}`);
    return Buffer.from(await res.arrayBuffer());
  },

  // Fallback provider: Google Translate voice (Khmer, one voice, no rate/pitch). Max ~200 characters per request.
  async synthesizeGoogle({ text, timeout }) {
    const parts = [];
    for (const sentence of text.split(/(?<=[។៕?!.])\s*/u)) {
      for (let i = 0; i < sentence.length; i += 170) parts.push(sentence.slice(i, i + 170));
    }
    const bufs = [];
    for (const q of parts.filter((x) => x.trim())) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=km&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/143.0.0.0 Safari/537.36", Referer: "https://translate.google.com/" }, signal: AbortSignal.timeout(timeout) });
      if (!res.ok) throw new Error(`google HTTP ${res.status}`);
      bufs.push(Buffer.from(await res.arrayBuffer()));
    }
    return Buffer.concat(bufs);
  },

  // Edge TTS running on ANOTHER server of yours (e.g. your Render backend) when this host's IP is refused by Microsoft.
  async synthesizeRemote(options) {
    const url = process.env.TTS_REMOTE_URL;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.TTS_REMOTE_SECRET ? { "x-tts-secret": process.env.TTS_REMOTE_SECRET } : {}) },
      body: JSON.stringify({ text: options.text, voice: options.voice, rate: Number.parseInt(options.rate, 10) || 0, pitch: Number.parseInt(options.pitch, 10) || 0, volume: Number.parseInt(options.volume, 10) || 0 }),
      signal: AbortSignal.timeout(options.timeout + 5000),
    });
    if (!res.ok) throw new Error(`remote HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  },

  // Tries every provider in order; returns { audio, provider, errors }.
  async synthesize(options) {
    const errors = [];
    if (process.env.TTS_REMOTE_URL) {
      try { return { audio: await deps.synthesizeRemote(options), provider: "remote-edge", errors }; }
      catch (e) { errors.push(`remote: ${e.message}`); }
    }
    if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) {
      try { return { audio: await deps.synthesizeAzure(options), provider: "azure", errors }; }
      catch (e) { errors.push(`azure: ${e.message}`); }
    }
    for (const chrome of CHROME_VERSIONS) {
      try { return { audio: await deps.synthesizeEdge({ ...options, chrome }), provider: "edge", errors }; }
      catch (e) { errors.push(`edge(${chrome.replace(/\..*:/, ":").split(".")[0]}${chrome.endsWith(":min") ? " min" : ""}): ${e.message}`); }
    }
    // Google has only ONE (non Piseth/Sreymom) voice, so it is used only when explicitly allowed.
    if (process.env.TTS_ALLOW_FALLBACK === "true") {
      try { return { audio: await deps.synthesizeGoogle(options), provider: "google", errors }; }
      catch (e) { errors.push(`google: ${e.message}`); }
    }
    const err = new Error(errors.join(" | ")); err.errors = errors; throw err;
  },
};

export const defaultSynthesize = deps.synthesize;

export function normalizeVoice(voice) {
  const raw = String(voice || "").trim();
  const key = raw.toLowerCase();
  if (!key) return KHMER_TTS_VOICES.default;
  if (key.includes("piseth")) return KHMER_VOICES[0].value;
  if (key.includes("sreymom") || key.includes("syreymom")) return KHMER_VOICES[1].value;
  throw new AppError(400, "INVALID_VOICE", "Unknown voice. Use Piseth or Sreymom.");
}

const pct = (n, lo, hi, unit) => {
  const v = Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
  return `${v >= 0 ? "+" : ""}${v}${unit}`;
};
export const ratePct = (n) => pct(n, -50, 100, "%");
export const pitchHz = (n) => pct(n, -50, 50, "Hz");
export const volumePct = (n) => pct(n, -50, 50, "%");

export async function synthesizeSpeech(text, { voice, rate = 0, pitch = 0, volume = 0, timeout = 25000 } = {}) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) throw new AppError(400, "EMPTY_TEXT", "Please enter some text to convert to speech.");
  const v = normalizeVoice(voice);
  const options = { text: clean, voice: v, outputFormat: "audio-24khz-48kbitrate-mono-mp3", rate: ratePct(rate), pitch: pitchHz(pitch), volume: volumePct(volume), timeout };
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await deps.synthesize(options);
      const audio = Buffer.isBuffer(r) ? r : r?.audio; // tests may return a bare Buffer
      if (!audio?.length) throw new Error("empty audio");
      return { audio, voice: v, contentType: "audio/mpeg", provider: r?.provider || "edge" };
    } catch (err) {
      if (err instanceof AppError) throw err;
      lastErr = err;
    }
  }
  console.error("[tts] failed:", lastErr?.message);
  const detail = String(lastErr?.message || "").slice(0, 400);
  throw new AppError(502, "TTS_UNAVAILABLE", `The Piseth/Sreymom voice service (Microsoft Edge TTS) could not be reached. Reason: ${detail.slice(0, 160) || "unknown"}`, detail);
}

// Used by GET /api/tts/diagnose: runs every provider once so the real failure reason is visible.
export async function diagnose() {
  const base = { text: "សួស្តី", voice: KHMER_VOICES[0].value, rate: "+0%", pitch: "+0Hz", volume: "+0%", outputFormat: "audio-24khz-48kbitrate-mono-mp3", timeout: 12000 };
  const out = [];
  const t0 = () => Date.now();
  for (const chrome of CHROME_VERSIONS) {
    const s = t0();
    try { const a = await deps.synthesizeEdge({ ...base, chrome }); out.push({ provider: `edge ${chrome}`, ok: a.length > 0, bytes: a.length, ms: Date.now() - s }); }
    catch (e) { out.push({ provider: `edge ${chrome}`, ok: false, error: String(e.message).slice(0, 200), ms: Date.now() - s }); }
  }
  if (process.env.AZURE_SPEECH_KEY) {
    const sa = t0();
    try { const a = await deps.synthesizeAzure(base); out.push({ provider: "azure", ok: a.length > 0, bytes: a.length, ms: Date.now() - sa }); }
    catch (e) { out.push({ provider: "azure", ok: false, error: String(e.message).slice(0, 200), ms: Date.now() - sa }); }
  }
  const s = t0();
  try { const a = await deps.synthesizeGoogle(base); out.push({ provider: "google", ok: a.length > 0, bytes: a.length, ms: Date.now() - s }); }
  catch (e) { out.push({ provider: "google", ok: false, error: String(e.message).slice(0, 200), ms: Date.now() - s }); }
  return out;
}
