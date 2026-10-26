import { spawn } from "node:child_process";
import { AppError } from "../../lib/AppError.js";

// Server-side media → audio conversion using a bundled ffmpeg (ffmpeg-static).
// Only for small files (Vercel body limit). The browser handles larger files itself.

export const FORMATS = {
  mp3: { args: ["-codec:a", "libmp3lame"], type: "audio/mpeg", bitrate: true },
  m4a: { args: ["-codec:a", "aac", "-movflags", "+faststart"], type: "audio/mp4", bitrate: true },
  ogg: { args: ["-codec:a", "libvorbis"], type: "audio/ogg", bitrate: false, quality: true },
  wav: { args: ["-codec:a", "pcm_s16le"], type: "audio/wav", bitrate: false },
};
export const BITRATES = [64, 96, 128, 192, 256, 320];

export const deps = {
  async ffmpegPath() {
    if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
    const mod = await import("ffmpeg-static");
    return mod.default;
  },
};

export function sniffMedia(buf) {
  const s4 = buf.slice(0, 4).toString("latin1");
  if (s4 === "RIFF") return "wav/avi";
  if (s4 === "OggS") return "ogg";
  if (s4 === "fLaC") return "flac";
  if (buf.slice(4, 8).toString("latin1") === "ftyp") return "mp4";
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm/mkv";
  if (s4.startsWith("ID3") || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return "mp3";
  return null;
}

export async function convertToAudio(input, { format = "mp3", bitrate = 192, startSec, endSec, timeoutMs = 50000 } = {}) {
  const f = FORMATS[format];
  if (!f) throw new AppError(400, "INVALID_FORMAT", `Format must be one of: ${Object.keys(FORMATS).join(", ")}.`);
  if (!sniffMedia(input)) throw new AppError(415, "UNSUPPORTED_MEDIA", "That file does not look like a supported audio or video file.");
  const br = BITRATES.includes(Number(bitrate)) ? Number(bitrate) : 192;
  const ff = await deps.ffmpegPath();
  if (!ff) throw new AppError(503, "FFMPEG_MISSING", "Audio conversion is not available on this server.");

  // Everything streams through pipes (stdin → stdout): nothing is written to disk, so no temp files on Vercel.
  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  if (Number(startSec) > 0) args.push("-ss", String(Number(startSec)));
  args.push("-i", "pipe:0");
  if (Number(endSec) > 0) args.push("-to", String(Number(endSec)));
  args.push("-vn", ...f.args);
  if (f.bitrate) args.push("-b:a", `${br}k`);
  // Vorbis rejects some bitrate/sample-rate pairs → use quality scale (VBR) instead.
  if (f.quality) args.push("-q:a", String({ 64: 2, 96: 3, 128: 4, 192: 6, 256: 7, 320: 8 }[br]));
  // A pipe cannot be seeked back: MP4/M4A are written as fragmented MP4, WAV is streamed.
  const outFmt = { mp3: "mp3", m4a: "ipod", ogg: "ogg", wav: "wav" }[format];
  if (format === "m4a") args.push("-movflags", "frag_keyframe+empty_moov");
  args.push("-f", outFmt, "pipe:1");

  const audio = await new Promise((resolve, reject) => {
    const p = spawn(ff, args, { stdio: ["pipe", "pipe", "pipe"] });
    const out = [];
    let err = "";
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => { err = (err + d).slice(-2000); });
    p.stdin.on("error", () => {}); // ffmpeg may close early (e.g. -to reached)
    const timer = setTimeout(() => { p.kill("SIGKILL"); reject(new AppError(504, "CONVERT_TIMEOUT", "Conversion took too long. Try a shorter file.")); }, timeoutMs);
    p.on("error", () => { clearTimeout(timer); reject(new AppError(503, "FFMPEG_MISSING", "Audio conversion is not available on this server.")); });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new AppError(422, "CONVERT_FAILED", /no audio|does not contain any stream|Output file does not contain/i.test(err)
        ? "That file has no audio track."
        : /moov atom not found|Invalid data found/i.test(err) ? "This video cannot be read as a stream. Use “Extract audio” in the Video Editor (done in your browser) first." : "Could not convert that file. It may be corrupted."));
    });
    p.stdin.end(input);
  });
  if (!audio.length) throw new AppError(422, "CONVERT_FAILED", "The conversion produced no audio.");
  return { audio, type: f.type, ext: format };
}
