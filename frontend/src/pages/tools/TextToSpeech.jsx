import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { toolsApi } from "../../services/toolsApi";
import { friendlyError } from "../../lib/errors";
import { useFeedback } from "../../components/ui/Feedback";
import { useLanguage } from "../../context/LanguageContext";
import Select from "../../components/ui/Select";
import { KeyNotice, useGeminiAccess } from "../../components/tools/GeminiKey";
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
const STYLE_ICONS = { natural: "ri-user-voice-line", warm: "ri-heart-3-line", calm: "ri-leaf-line", cheerful: "ri-emotion-happy-line", serious: "ri-shield-star-line", fast: "ri-speed-up-line" };
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
  const ownKey = access.ready; // the site key (set by the admin) works for everyone, guests included
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

  const quick = km
    ? ["សួស្តី! សូមស្វាគមន៍មកកាន់ AmertakCloud។", "ថ្ងៃនេះអាកាសធាតុល្អណាស់។", "សូមអរគុណច្រើនចំពោះការគាំទ្ររបស់អ្នក។"]
    : ["Hello! Welcome to AmertakCloud.", "The weather is lovely today.", "Thank you very much for your support."];
  const canGo = !isGenerating && ownKey && text.trim().length > 0;

  return (
    <div className="page tts-page">
      <header className="tts-head">
        <span className="tts-badge"><i className="ri-voice-ai-line" aria-hidden="true" /></span>
        <div>
          <h1 style={{fontWeight: "normal"}} className="tts-title">{t("TextToSpeech")}</h1>
          <p className="tts-sub">{km ? "បម្លែងអត្ថបទទៅជាសម្លេង AI ពិត ដោយឥតគិតថ្លៃ — មិនបាច់ចូលគណនី។" : "Turn text into natural AI speech — free, no login needed."}</p>
        </div>
      </header>

      <KeyNotice access={access} />

      <form className="tts-grid" onSubmit={handleGenerate}>
        <section className="tts-card tts-main">
          <p className="tts-label" htmlFor="tts-text"><i className="ri-edit-2-line" aria-hidden="true" /> {km ? "បញ្ចូលអត្ថបទ" : "Your text"}</p>
          <textarea id="tts-text" className="tts-text" value={text} maxLength={3000} onChange={(e) => setText(e.target.value)} rows={8} placeholder={km ? "វាយបញ្ចូលអត្ថបទ..." : "Type or paste your text…"} />
          <div className="tts-meta">
            <div className="tts-quick">
              {quick.map((q) => <button key={q} type="button" className="tts-chip" onClick={() => setText(q)}>{q.length > 28 ? q.slice(0, 28) + "…" : q}</button>)}
            </div>
            <span className="tts-count">{text.length} / 3000 {t("ttsChars")}</span>
          </div>
        </section>

        <aside className="tts-card tts-side">
          <div className="tts-field">
            <p className="tts-label"><i className="ri-mic-ai-line" aria-hidden="true" /> {km ? "ប្រភេទសម្លេង" : "Voice"}</p>
            <div className="tts-voices" role="radiogroup" aria-label="Voice">
              {voices.map((v) => (
                <button key={v.value} type="button" role="radio" aria-checked={voice === v.value} className={`tts-voice ${voice === v.value ? "on" : ""}`} onClick={() => setVoice(v.value)}>
                  <i className={v.gender === "Female" ? "ri-women-line" : "ri-men-line"} aria-hidden="true" />
                  <b>{v.label}</b><small>{v.gender === "Female" ? (km ? "ស្រី" : "Female") : (km ? "ប្រុស" : "Male")}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="tts-field" style={{ fontFamily: "Kantumruy"}}>
            <p className="tts-label"><i className="ri-emotion-line" aria-hidden="true" /> {km ? "រចនាប័ទ្មសម្លេង" : "Style"}</p>
            <Select value={style} onChange={(e) => setStyle(e.target.value)}>
              {Object.entries(STYLE_LABELS).map(([k, [en, kh]]) => <option key={k} value={k}><i className={STYLE_ICONS[k]} aria-hidden="true" /> {km ? kh : en}</option>)}
            </Select>
          </div>

          <div className="tts-field">
            <p className="tts-label"><i className="ri-speed-up-line" aria-hidden="true" /> {km ? "ល្បឿនចាក់" : "Playback speed"}</p>
            <div className="tts-seg" role="radiogroup" aria-label="Speed">
              {SPEED_OPTIONS.map((o) => <button key={o} type="button" role="radio" aria-checked={speed === o} className={speed === o ? "on" : ""} onClick={() => setSpeed(o)}>{o}×</button>)}
            </div>
          </div>

          <button type="submit" className="tts-go primary-btn" disabled={!canGo}>
            <i className={isGenerating ? "ri-loader-4-line tts-spin" : "ri-voice-ai-line"} aria-hidden="true" />
            <span>{isGenerating ? (km ? "កំពុងបង្កើត…" : "Generating…") : (km ? "បង្កើតសម្លេង" : "Generate voice")}</span>
          </button>
          
        </aside>
      </form>

      {audioUrl && (
        <section className="tts-card tts-player" aria-label="Player">
          <div ref={waveformRef} className="tts-wave" />
          <div className="tts-ctl">
            <button type="button" className="tts-play" onClick={handlePlayPause} disabled={!isReady} aria-label={isPlaying ? "Pause" : "Play"}>
              <i className={isPlaying ? "ri-pause-fill" : "ri-play-fill"} aria-hidden="true" />
            </button>
            <span className="tts-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
            <input className="tts-seek" type="range" min={0} max={duration || 0} step={0.01} value={currentTime} onChange={handleSeek} disabled={!isReady} aria-label="Seek" />
            <button type="button" className="tts-dl" onClick={handleDownload}><i className="ri-download-line" aria-hidden="true" /><span>{km ? "ទាញយក" : "Download"}</span></button>
          </div>
        </section>
      )}
    </div>
  );
}
