import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

// Waveform + transport for a local audio/video File (object URL, never uploaded).
// ref API: play(), pause(), toggle(), seek(sec), playRange(start,end)
const Waveform = forwardRef(function Waveform({ file, onTime, onReady, onPlayState, height = 72 }, ref) {
  const box = useRef(null);
  const ws = useRef(null);
  const stopAt = useRef(null);
  const cb = useRef({});
  cb.current = { onTime, onReady, onPlayState };
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!file || !box.current) return undefined;
    setFailed(false);
    const url = URL.createObjectURL(file);
    const s = WaveSurfer.create({
      container: box.current,
      waveColor: "rgba(139,92,246,.35)",
      progressColor: "#8b5cf6",
      cursorColor: "#e600ff",
      cursorWidth: 2, barWidth: 2, barGap: 1.5, barRadius: 2, height, normalize: true,
      url,
    });
    ws.current = s;
    s.on("ready", (d) => cb.current.onReady?.(d));
    s.on("error", () => setFailed(true));
    s.on("timeupdate", (time) => {
      cb.current.onTime?.(time);
      if (stopAt.current != null && time >= stopAt.current) { stopAt.current = null; s.pause(); }
    });
    s.on("play", () => cb.current.onPlayState?.(true));
    s.on("pause", () => cb.current.onPlayState?.(false));
    s.on("finish", () => cb.current.onPlayState?.(false));
    return () => {
      try { s.destroy(); } catch { /* already destroyed */ }
      ws.current = null;
      URL.revokeObjectURL(url);
    };
  }, [file, height]);

  useImperativeHandle(ref, () => ({
    play: () => ws.current?.play(),
    pause: () => ws.current?.pause(),
    toggle: () => ws.current?.playPause(),
    seek: (sec) => { const d = ws.current?.getDuration(); if (d) ws.current.setTime(Math.max(0, Math.min(d, sec))); },
    playRange: (a, b) => { const w = ws.current; if (!w) return; stopAt.current = b; w.setTime(a); w.play(); },
  }), []);

  if (failed) return <div className="tk-hint">Preview unavailable for this file (the subtitles still work).</div>;
  return <div ref={box} className="wave" />;
});

export default Waveform;
