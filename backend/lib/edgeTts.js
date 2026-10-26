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
const CHROME = "130.0.2849.68";
const WS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";

export function secMsGec(now = Date.now(), skewMs = 0) {
  let ticks = Math.floor((now + skewMs) / 1000) + 11644473600;
  ticks -= ticks % 300;
  return createHash("sha256").update(`${ticks * 1e7}${TOKEN}`).digest("hex").toUpperCase();
}
const esc = (t) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const stamp = () => new Date().toUTCString().replace("GMT", "GMT+0000 (Coordinated Universal Time)");

export const deps = {
  // Returns an MP3 Buffer. Replaceable in tests.
  async synthesize({ text, voice, rate, pitch, volume, outputFormat, timeout }) {
    const { default: WebSocket } = await import("ws");
    const id = randomUUID().replace(/-/g, "");
    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/XMLSchema' xml:lang='km-KH'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>${esc(text)}</prosody></voice></speak>`;
    let skew = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          const url = `${WS_URL}?TrustedClientToken=${TOKEN}&Sec-MS-GEC=${secMsGec(Date.now(), skew)}&Sec-MS-GEC-Version=1-${CHROME}&ConnectionId=${id}`;
          const ws = new WebSocket(url, {
            headers: {
              Pragma: "no-cache", "Cache-Control": "no-cache",
              Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
              "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME.split(".")[0]}.0.0.0 Safari/537.36 Edg/${CHROME.split(".")[0]}.0.0.0`,
              "Accept-Language": "en-US,en;q=0.9",
            },
          });
          const chunks = [];
          const timer = setTimeout(() => { ws.terminate(); reject(new Error("timeout")); }, timeout);
          const fail = (e) => { clearTimeout(timer); reject(e); };
          ws.on("unexpected-response", (_req, res) => {
            const e = new Error(`HTTP ${res.statusCode}`); e.status = res.statusCode; e.date = res.headers?.date; fail(e); ws.terminate();
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
};

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
      const audio = await deps.synthesize(options);
      if (!audio?.length) throw new Error("empty audio");
      return { audio, voice: v, contentType: "audio/mpeg" };
    } catch (err) {
      if (err instanceof AppError) throw err;
      lastErr = err;
    }
  }
  console.error("[tts] failed:", lastErr?.message);
  throw new AppError(502, "TTS_UNAVAILABLE", "The voice service (Microsoft Edge TTS) could not be reached. Please try again in a moment.", String(lastErr?.message || "").slice(0, 200));
}
