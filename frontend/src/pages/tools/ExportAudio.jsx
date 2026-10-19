import { useEffect, useRef, useState } from "react";
import ToolShell from "../../components/tools/ToolShell";
import Dropzone from "../../components/tools/Dropzone";
import Waveform from "../../components/tools/Waveform";
import { useLanguage } from "../../context/LanguageContext";
import { useFeedback } from "../../components/ui/Feedback";
import useToolsStatus from "../../hooks/useToolsStatus";
import { toolsApi } from "../../services/toolsApi";
import { friendlyError } from "../../lib/errors";
import { decodeFull } from "../../lib/audio/decode";
import { encodeWav } from "../../lib/audio/wav";
import { baseName, formatBytes, formatClock, saveBlob } from "../../lib/download";
import { parseClock } from "../../lib/srtEdit";

const FORMATS = ["mp3", "m4a", "ogg", "wav"];
const BITRATES = [64, 96, 128, 192, 256, 320];
const MAX_WAVE_BYTES = 60 * 1024 * 1024;

export default function ExportAudio() {
  const { t } = useLanguage();
  const { toast } = useFeedback();
  const { data: status } = useToolsStatus();
  const serverMb = status?.tools?.audio?.serverMaxMb ?? 4;
  const serverBytes = serverMb * 1024 * 1024;

  const [file, setFile] = useState(null);
  const [format, setFormat] = useState("mp3");
  const [bitrate, setBitrate] = useState(192);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [duration, setDuration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null); // { blob, name }
  const [error, setError] = useState("");
  const abort = useRef(null);

  const big = file ? file.size > serverBytes : false;
  const route = format === "wav" || big ? "browser" : "server";
  useEffect(() => { if (big && format !== "wav") setFormat("wav"); }, [big]); // eslint-disable-line
  useEffect(() => () => abort.current?.abort(), []);

  const s0 = start ? parseClock(start) : 0;
  const e0 = end ? parseClock(end) : 0;
  const rangeBad = (start && s0 === null) || (end && e0 === null) || (e0 && s0 !== null && e0 <= s0);

  function onFile(f) {
    setFile(f); setOut(null); setError(""); setStart(""); setEnd(""); setDuration(0);
    if (f.size > serverBytes) toast.info(t("eaBigFile").replace("{mb}", String(serverMb)));
  }

  async function run() {
    if (!file || busy || rangeBad) return;
    setBusy(true); setError(""); setOut(null);
    abort.current = new AbortController();
    try {
      let blob;
      if (route === "server") {
        ({ blob } = await toolsApi.audioConvert(file, { format, bitrate, start: s0 || 0, end: e0 || 0 }, abort.current.signal));
      } else {
        const { channels, rate } = await decodeFull(file);
        const a = Math.floor((s0 || 0) * rate);
        const b = e0 ? Math.min(channels[0].length, Math.floor(e0 * rate)) : channels[0].length;
        if (b <= a) throw Object.assign(new Error("Empty range"), { code: "EMPTY_RANGE" });
        blob = encodeWav(channels.map((c) => c.subarray(a, b)), rate);
      }
      const name = `${baseName(file.name)}.${route === "browser" ? "wav" : format}`;
      setOut({ blob, name });
      saveBlob(blob, name);
      toast.success(t("eaDone"));
    } catch (e) {
      if (e.code !== "ABORTED") { const m = friendlyError(e, t); setError(m); toast.error(m); }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell icon="ri-music-2-line" titleKey="ExportAudio" subKey="dExportAudio">
      <div className="tk-grid-2">
        <div className="tk-card">
          <Dropzone accept="video/*,audio/*,.mp4,.mov,.mkv,.webm,.mp3,.wav,.m4a,.ogg,.flac,.aac" file={file} onFile={onFile} onClear={() => { setFile(null); setOut(null); }} disabled={busy} icon="ri-film-line" hintKey="eaDropHint" />
          {file && file.size <= MAX_WAVE_BYTES && (
            <div className="srt-wave"><Waveform file={file} height={64} onReady={(d) => setDuration(d)} /></div>
          )}
          {file && <div className="tk-hint">{formatBytes(file.size)}{duration ? ` · ${formatClock(duration)}` : ""}</div>}
        </div>

        <div className="tk-card">
          <div>
            <div className="tk-label"><i className="ri-file-music-line" />{t("eaFormat")}</div>
            <div className="tk-seg" role="radiogroup">
              {FORMATS.map((f) => (
                <button key={f} type="button" role="radio" aria-checked={format === f} className={format === f ? "active" : ""} disabled={big && f !== "wav"} onClick={() => setFormat(f)}>{f.toUpperCase()}</button>
              ))}
            </div>
            {big && <div className="tk-hint" style={{ marginTop: 6 }}>{t("eaWavOnly").replace("{mb}", String(serverMb))}</div>}
          </div>

          {route === "server" && (
            <div>
              <div className="tk-label"><i className="ri-equalizer-line" />{t("eaBitrate")}</div>
              <select className="tk-select" value={bitrate} onChange={(e) => setBitrate(+e.target.value)}>
                {BITRATES.map((b) => <option key={b} value={b}>{b} kbps</option>)}
              </select>
            </div>
          )}

          <div className="tk-fields">
            <div><div className="tk-label"><i className="ri-scissors-cut-line" />{t("eaStart")}</div>
              <input className="tk-input" value={start} onChange={(e) => setStart(e.target.value)} placeholder="0:00" aria-invalid={Boolean(start && s0 === null)} /></div>
            <div><div className="tk-label">{t("eaEnd")}</div>
              <input className="tk-input" value={end} onChange={(e) => setEnd(e.target.value)} placeholder={duration ? formatClock(duration) : "—"} aria-invalid={Boolean(end && e0 === null)} /></div>
          </div>
          {rangeBad && <div className="tk-alert err" role="alert"><i className="ri-error-warning-line" />{t("eaRangeBad")}</div>}

          <button type="button" className="tk-btn full" disabled={!file || busy || rangeBad} onClick={run}>
            <i className={busy ? "ri-loader-4-line spin" : "ri-download-2-line"} />{busy ? t("eaWorking") : t("eaExport")}
          </button>
          <div className="tk-hint">{route === "server" ? t("eaServerNote") : t("eaBrowserNote")}</div>
          {error && <div className="tk-alert err" role="alert"><i className="ri-error-warning-line" />{error}</div>}
          {out && (
            <div className="tk-file">
              <i className="ri-checkbox-circle-line" style={{ color: "#22c55e" }} />
              <div className="meta"><div className="name">{out.name}</div><div className="sub">{formatBytes(out.blob.size)}</div></div>
              <button type="button" className="tk-btn small" onClick={() => saveBlob(out.blob, out.name)}><i className="ri-download-2-line" />{t("download")}</button>
            </div>
          )}
        </div>
      </div>
    </ToolShell>
  );
}
