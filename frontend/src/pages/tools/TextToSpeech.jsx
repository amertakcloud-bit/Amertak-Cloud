import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { toolsApi } from "../../services/toolsApi";
import { friendlyError } from "../../lib/errors";
import { useFeedback } from "../../components/ui/Feedback";
import { useLanguage } from "../../context/LanguageContext";
import Select from "../../components/ui/Select";
import GeminiKeyPanel, { useGeminiAccess } from "../../components/tools/GeminiKey";
import useToolsStatus from "../../hooks/useToolsStatus";

// Gemini TTS voices (the server sends the real list; this is the fallback while it loads).
const FALLBACK_VOICES = [
  { value: "Puck", label: "Puck", gender: "Male" }, { value: "Charon", label: "Charon", gender: "Male" },
  { value: "Fenrir", label: "Fenrir", gender: "Male" }, { value: "Orus", label: "Orus", gender: "Male" },
  { value: "Kore", label: "Kore", gender: "Female" }, { value: "Zephyr", label: "Zephyr", gender: "Female" },
  { value: "Aoede", label: "Aoede", gender: "Female" }, { value: "Leda", label: "Leda", gender: "Female" },
];
const SPEED_OPTIONS = [0.5, 1, 1.5, 2];
// delivery style → [English, ខ្មែរ]
const STYLE_LABELS = {
  natural: ["Natural", "ធម្មតា"], warm: ["Warm & friendly", "កក់ក្តៅ ស្និទ្ធស្នាល"], calm: ["Calm & slow", "ស្ងប់ និងយឺត"],
  cheerful: ["Cheerful", "រីករាយ"], serious: ["Serious & clear", "ម៉ឺងម៉ាត់ ច្បាស់"], fast: ["A bit faster", "លឿនបន្តិច"],
};

const formatTime = (value) => {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
};

export default function TextToSpeech() {
  const { t, language } = useLanguage();
  const { toast } = useFeedback();
  const km = language === "km";
  const { data: toolsStatus } = useToolsStatus();
  const access = useGeminiAccess(toolsStatus);
  // The free voice tool never uses the site's key: only a key typed here or saved in the account counts.
  const ownKey = access.source === "user" || access.source === "account";
  const panelAccess = ownKey ? access : { ...access, source: "none", ready: false };
  const [text, setText] = useState("");
  const [voices, setVoices] = useState(FALLBACK_VOICES);
  const [voice, setVoice] = useState("Puck");
  const [style, setStyle] = useState("natural");
  const [speed, setSpeed] = useState(1); // playback speed of the player (the voice itself is generated at natural pace)
  useEffect(() => {
    toolsApi.ttsVoices().then((r) => { if (r.provider === "gemini" && r.voices?.length) setVoices(r.voices); }).catch(() => {});
  }, []);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioExt, setAudioExt] = useState("mp3");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const waveformRef = useRef(null);
  const waveSurferRef = useRef(null);

  const speedRef = useRef(speed);
  speedRef.current = speed;

  // The waveform container only exists once there is audio, so the player is created the
  // first time audioUrl is set (creating it on mount found no container → Play stayed
  // disabled after the very first generation).
  useEffect(() => {
    if (!audioUrl || !waveformRef.current) {
      setIsReady(false);
      setDuration(0);
      setCurrentTime(0);
      return;
    }

    let wavesurfer = waveSurferRef.current;
    if (!wavesurfer) {
      const css = getComputedStyle(document.documentElement);
      const color = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
      wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: color("--primary-soft", "rgba(139,92,246,.35)"),
        progressColor: color("--primary", "#8b5cf6"),
        cursorColor: color("--primary", "#8b5cf6"),
        cursorWidth: 2,
        barWidth: 2,
        barGap: 1.5,
        barRadius: 2,
        height: 64,
        normalize: true,
        interact: true,
      });
      waveSurferRef.current = wavesurfer;
      wavesurfer.on("ready", () => {
        setIsReady(true);
        setDuration(wavesurfer.getDuration());
        setCurrentTime(0);
        wavesurfer.setPlaybackRate(speedRef.current);
      });
      wavesurfer.on("timeupdate", (time) => setCurrentTime(time));
      wavesurfer.on("play", () => setIsPlaying(true));
      wavesurfer.on("pause", () => setIsPlaying(false));
      wavesurfer.on("finish", () => {
        setIsPlaying(false);
        setCurrentTime(wavesurfer.getDuration());
      });
      wavesurfer.on("error", () => toast.error(t("err_UNKNOWN")));
    }

    setIsReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    wavesurfer.load(audioUrl);
  }, [audioUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    waveSurferRef.current?.setPlaybackRate(speed);
  }, [speed]);

  useEffect(() => () => {
    try { waveSurferRef.current?.destroy(); } catch { /* already gone */ }
    waveSurferRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleGenerate = async (event) => {
    event.preventDefault();

    const trimmedText = text.trim();
    if (!trimmedText) {
      toast.info(t("ttsEmpty"));
      return;
    }

    if (!ownKey) { toast.info(t("keyRequired")); return; }
    setError("");
    setStatus("");
    setIsGenerating(true);

    try {
      const { blob } = await toolsApi.tts({ text: trimmedText, voice, style });
      const nextAudioUrl = URL.createObjectURL(blob);

      setAudioUrl(nextAudioUrl);
      setAudioExt(/wav/i.test(blob.type) ? "wav" : "mp3");
      setError("");
      setStatus("");
      setIsPlaying(false);
      toast.success(t("ttsReady"));
    } catch (err) {
      const message = friendlyError(err, t);
      setError("");
      setStatus("");
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPause = () => {
    if (!waveSurferRef.current || !audioUrl) return;
    waveSurferRef.current.playPause();
  };

  const handleSeek = (event) => {
    const nextTime = Number(event.target.value);
    const wavesurfer = waveSurferRef.current;
    if (!wavesurfer || !duration) return;

    const ratio = nextTime / duration;
    wavesurfer.seekTo(ratio);
    setCurrentTime(nextTime);
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `khmer-voice-${voice}.${audioExt}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "28px 24px 20px",
          borderRadius: 24,
          background: "var(--bg)",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "2.4rem",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "var(--text)",
          }}
        >
          Khmer AI <span style={{ color: "var(--primary)" }}>Voice</span>
        </h1>

        <GeminiKeyPanel status={toolsStatus} access={panelAccess} />
        <p className="tk-hint" style={{ margin: "6px 0 12px" }}>{km ? "ឧបករណ៍នេះឥតគិតថ្លៃ ប្រើ Gemini API key ផ្ទាល់ខ្លួនរបស់អ្នក (មិនកាត់ token)។" : "This tool is free — it uses your own Gemini API key (no tokens are charged)."}</p>
        <form onSubmit={handleGenerate} style={{ display: "grid", gap: 18 }}>
          <div>
            <div style={{ marginBottom: 8, fontWeight: 600, color: "var(--text-muted)", fontFamily: 'Kantumruy' }}>បញ្ចូលអត្ថបទ</div>
            <textarea
              value={text}
              maxLength={3000}
              onChange={(event) => setText(event.target.value)}
              rows={7}
              placeholder="វាយបញ្ចូលអត្ថបទ..."
              style={{
                width: "100%",
                padding: "1rem 1rem 0.8rem",
                borderRadius: 16,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                resize: "vertical",
                minHeight: 160,
                fontSize: 16,
                color: "var(--text)",
                outline: "none",
                WebkitTapHighlightColor: "",
                boxShadow: "inset 0 1px 2px rgba(15,23,42,0.04)",
              }}
            />
            <div style={{ marginTop: 8, textAlign: "right", color: "var(--text-muted)", fontSize: 13 }}>
              {text.length} / 3000 {t("ttsChars")}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <div>
              <div style={{ marginBottom: 8, fontWeight: 600, color: "var(--text-muted)", fontFamily: 'Kantumruy' }}>
                <i className="ri-mic-ai-line"></i>
                <span> ប្រភេទសម្លេង</span>
              </div>

              <Select value={voice} onChange={(e) => setVoice(e.target.value)} aria-label="Voice">
                {voices.map((v) => (
                  <option key={v.value} value={v.value}>{v.label} · {v.gender === "Female" ? (km ? "ស្រី" : "Female") : (km ? "ប្រុស" : "Male")}</option>
                ))}
              </Select>
            </div>

            <div style={{display: 'none'}}>
              <div style={{ marginBottom: 8, fontWeight: 600, color: "var(--text-muted)" }}>ភាសា</div>
              <select
                value="Khmer Cambodia"
                disabled
                style={{
                  width: "100%",
                  padding: "0.9rem 1rem",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text-muted)",
                }}
              >
                <option>🇰🇭 Khmer Cambodia</option>
              </select>
            </div>
          </div>

          <div>
            <div style={{ marginBottom: 8, fontWeight: 600, color: "var(--text-muted)", fontFamily: 'Kantumruy'}}>
              <i className="ri-emotion-line"></i>
              <span> {km ? "រចនាប័ទ្មសម្លេង" : "Voice style"}</span>
            </div>
            <Select value={style} onChange={(e) => setStyle(e.target.value)} aria-label="Style">
              {Object.entries(STYLE_LABELS).map(([k, [en, kh]]) => <option key={k} value={k}>{km ? kh : en}</option>)}
            </Select>
          </div>

          <div>
            <div style={{ marginBottom: 8, fontWeight: 600, color: "var(--text-muted)", fontFamily: 'Kantumruy'}}>
              <i className="ri-speed-up-line"></i>
              <span> {km ? "ល្បឿនចាក់" : "Playback speed"}</span>
            </div>
            <div className="speed-option" style={{ display: "flex", gap: 8 }}>
              {SPEED_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSpeed(option)}
                  style={{
                    border: "1px solid rgba(220, 36, 100, 0)",
                    background: speed === option ? "var(--bg)" : "var(--text)",
                    color: speed === option ? "var(--text)" : "var(--bg)",
                    borderRadius: 7,
                    padding: "0.6rem 0.9rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    minWidth: 64,
                  }}
                >
                  {option}×
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isGenerating || !ownKey}
            style={{
              border: "none",
              background: "var(--text)",
              color: "var(--bg)",
              borderRadius: 10,
              display: 'flex',
              flexBasis: '100%',
              alignItems: "center",
              margin: '0 auto',
              padding: "0.3rem",
              fontWeight: 700,
              gap: '.5rem',
              cursor: isGenerating ? "not-allowed" : "pointer",
              opacity: isGenerating ? 0.75 : 1,
              boxShadow: "0 14px 30px rgba(134, 36, 220, 0.25)",
            }}
          >
            <i className="ri-voice-ai-line"
              style={{
                color: 'var(--text)',
                background: 'var(--bg)',
                padding: '.8rem',
                borderRadius: 7
              }}
            ></i>
            <span>{isGenerating ? "កំពុងបង្កើត…" : "Generate Voice"}</span>
          </button>

        </form>

        {audioUrl && (
          <div
            style={{
              marginTop: 24,
              padding: 16,
              borderRadius: 18,
              background: "var(--bg)",
              border: "1px solid var(--border)",
            }}
          >
            <div ref={waveformRef} style={{ width: "100%", minHeight: 80, marginBottom: 12 }} />

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handlePlayPause}
                disabled={!isReady}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: ".5rem",
                  border: "none",
                  borderRadius: 10,
                  background: "var(--text)",
                  color: "var(--bg)",
                  padding: ".3rem",
                  cursor: isReady ? "pointer" : "not-allowed",
                  opacity: isReady ? 1 : 0.45,
                }}
              > 
                <i className={isPlaying ? "ri-pause-fill" : "ri-play-fill"}
                  style={{
                    background: "var(--bg)",
                    color: "var(--text)",
                    padding: 10,
                    borderRadius: 7,
                  }}
                ></i>
                <span>{isPlaying ? "Pause" : "Play"}</span>
              </button>

              <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.01}
                value={currentTime}
                onChange={handleSeek}
                disabled={!isReady}
                style={{ flex: 1, accentColor: "#dc2464", minWidth: 120 }}
              />

              <button
                type="button"
                onClick={handleDownload}
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--primary)",
                  color: "var(--text)",
                  borderRadius: 10,
                  padding: ".3rem",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                <i className="ri-download-line"
                  style={{
                    background: "var(--bg)"
                  }}
                ></i>
                <span>Download</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
