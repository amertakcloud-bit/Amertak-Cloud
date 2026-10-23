import { decodeToMono16k, sliceToWav } from "../audio/decode.js";

// Pulls the sound out of a video: mono, 16 kHz, 16-bit WAV (~1.9 MB per minute instead of tens of MB of video).
// Smaller upload ⇒ faster transcription/translation and fewer tokens (tokens are charged by file size).
export const WAV_BYTES_PER_SEC = 16000 * 2;
export const estimateWavBytes = (seconds) => Math.round(Math.max(0, seconds) * WAV_BYTES_PER_SEC) + 44;

export async function extractAudio(blob, name = "audio") {
  const { samples, rate, duration } = await decodeToMono16k(blob);
  const wav = sliceToWav(samples, 0, samples.length, rate);
  const file = new File([wav], `${String(name).replace(/\.[^.]+$/, "")}.wav`, { type: "audio/wav" });
  return { file, duration, size: file.size };
}
