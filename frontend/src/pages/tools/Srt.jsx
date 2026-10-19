import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ToolShell from "../../components/tools/ToolShell";
import Dropzone from "../../components/tools/Dropzone";
import Waveform from "../../components/tools/Waveform";
import GeminiKeyPanel, { useGeminiAccess } from "../../components/tools/GeminiKey";
import { useLanguage } from "../../context/LanguageContext";
import { useFeedback } from "../../components/ui/Feedback";
import useToolsStatus from "../../hooks/useToolsStatus";
import { toolsApi } from "../../services/toolsApi";
import { friendlyError } from "../../lib/errors";
import { transcribeFile } from "../../lib/srtClient";
import { baseName, formatBytes, formatClock, saveBlob } from "../../lib/download";
import { cueIssues, fixOverlaps, fmt, mergeWithNext, parseClock, removeCue, shiftAll, splitCue, toPayload, updateCue, withIds } from "../../lib/srtEdit";

const DEFAULTS = { maxCharsPerLine: 42, maxLines: 2, maxDuration: 7, minDuration: 0.6, pauseThreshold: 0.7 };
const SETTING_FIELDS = [
  { key: "maxCharsPerLine", label: "srtMaxChars", min: 10, max: 120, step: 1 },
  { key: "maxLines", label: "srtMaxLines", min: 1, max: 3, step: 1 },
  { key: "maxDuration", label: "srtMaxDur", min: 1, max: 20, step: 0.5 },
  { key: "minDuration", label: "srtMinDur", min: 0.2, max: 3, step: 0.1 },
  { key: "pauseThreshold", label: "srtPause", min: 0.1, max: 3, step: 0.1 },
];

// A time box that accepts "00:01:02,500", "1:02.5" or "62.5" and commits on blur/Enter.
function TimeBox({ value, onCommit, label }) {
  const [text, setText] = useState(fmt(value));
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(fmt(value)); setBad(false); }, [value]);
  const commit = () => {
    const v = parseClock(text);
    if (v === null) { setBad(true); return; }
    setBad(false);
    if (Math.abs(v - value) > 0.0005) onCommit(v); else setText(fmt(value));
  };
  return (
    <input className="tk-input" value={text} aria-label={label} aria-invalid={bad} spellCheck={false}
      onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
  );
}

const CueRow = memo(function CueRow({ cue, index, issues, active, onChange, onPlay, onSplit, onMerge, onRemove, canMerge, t }) {
  return (
    <div className={`srt-cue${active ? " active" : ""}${issues.length ? " bad" : ""}`} data-cue={cue.id}>
      <div className="idx">{index + 1}</div>
      <div className="body">
        <div className="srt-times">
          <TimeBox value={cue.start} label={t("srtStart")} onCommit={(v) => onChange(cue.id, { start: v })} />
          <i className="ri-arrow-right-line arrow" aria-hidden="true" />
          <TimeBox value={cue.end} label={t("srtEnd")} onCommit={(v) => onChange(cue.id, { end: v })} />
          <span className="tk-hint">{(cue.end - cue.start).toFixed(2)}s</span>
          <div className="srt-actions">
            <button type="button" title={t("srtPlayCue")} aria-label={t("srtPlayCue")} onClick={() => onPlay(cue)}><i className="ri-play-circle-line" /></button>
            <button type="button" title={t("srtSplit")} aria-label={t("srtSplit")} onClick={() => onSplit(cue.id)}><i className="ri-scissors-2-line" /></button>
            <button type="button" title={t("srtMerge")} aria-label={t("srtMerge")} disabled={!canMerge} onClick={() => onMerge(cue.id)}><i className="ri-merge-cells-horizontal" /></button>
            <button type="button" title={t("delete")} aria-label={t("delete")} onClick={() => onRemove(cue.id)}><i className="ri-delete-bin-6-line" /></button>
          </div>
        </div>
        <textarea className="tk-textarea" value={cue.text} rows={2} onChange={(e) => onChange(cue.id, { text: e.target.value })} aria-label={t("srtText")} />
        {issues.length > 0 && <div className="srt-issue">{issues.map((i) => t(`srtIssue_${i}`)).join(" · ")}</div>}
      </div>
    </div>
  );
});

export default function Srt() {
  const { t } = useLanguage();
  const { toast, confirm } = useFeedback();
  const { data: status } = useToolsStatus();
  const access = useGeminiAccess(status);

  const [file, setFile] = useState(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { timeline, timing, model, duration, chunks, warnings }
  const [cues, setCues] = useState([]);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [bom, setBom] = useState(false);
  const [shift, setShift] = useState("0");
  const [exporting, setExporting] = useState(false);
  const [aligning, setAligning] = useState(false);
  const wave = useRef(null);
  const abort = useRef(null);
  const list = useRef(null);

  // server-side defaults (single source of truth)
  useEffect(() => {
    toolsApi.srtStatus().then((r) => r.data?.defaults && setSettings((s) => ({ ...s, ...r.data.defaults }))).catch(() => {});
  }, []);
  useEffect(() => () => abort.current?.abort(), []);

  const issues = useMemo(() => cueIssues(cues), [cues]);
  const issueCount = issues.filter((x) => x.length).length;
  const activeId = useMemo(() => cues.find((c) => time >= c.start && time < c.end)?.id, [cues, time]);

  // keep the active cue in view while playing
  useEffect(() => {
    if (!playing || !activeId || !list.current) return;
    const el = list.current.querySelector(`[data-cue="${activeId}"]`);
    if (el) {
      const box = list.current.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (r.top < box.top || r.bottom > box.bottom) list.current.scrollTo({ top: el.offsetTop - list.current.offsetTop - 12, behavior: "smooth" });
    }
  }, [activeId, playing]);

  async function generate() {
    if (!file || busy) return;
    if (!access.ready) { toast.info(t("keyRequired")); return; }
    setBusy(true); setError(""); setResult(null); setCues([]); setProgress({ stage: "decode", percent: 2 });
    abort.current = new AbortController();
    try {
      const r = await transcribeFile(file, { settings, onProgress: setProgress, signal: abort.current.signal });
      setResult(r);
      setCues(withIds(r.cues));
      toast.success(t("srtDone").replace("{n}", String(r.cues.length)));
    } catch (e) {
      if (e.code === "ABORTED") toast.info(t("cancelled"));
      else { const m = friendlyError(e, t); setError(m); toast.error(m); }
    } finally {
      setBusy(false); setProgress(null);
    }
  }

  const onChange = useCallback((id, patch) => setCues((c) => updateCue(c, id, patch)), []);
  const onSplit = useCallback((id) => setCues((c) => splitCue(c, id)), []);
  const onMerge = useCallback((id) => setCues((c) => mergeWithNext(c, id)), []);
  const onRemove = useCallback((id) => setCues((c) => removeCue(c, id)), []);
  const onPlay = useCallback((cue) => wave.current?.playRange(cue.start, cue.end), []);

  async function applySettings() {
    if (!result?.timeline?.length) return;
    if (cues.some((c) => c.edited) && !(await confirm({ title: t("srtRebuildTitle"), message: t("srtRebuildMsg"), confirmText: t("srtRebuild"), danger: true }))) return;
    try {
      const res = await toolsApi.srtCues({ words: result.timeline, duration: result.duration, settings });
      setCues(withIds(res.data.cues));
      toast.success(t("srtRebuilt"));
    } catch (e) { toast.error(friendlyError(e, t)); }
  }

  async function realign() {
    if (!result?.timeline?.length || aligning) return;
    setAligning(true);
    try {
      const res = await toolsApi.srtAlign({ cues: cues.map(({ text, start, end }) => ({ text, start, end })), words: result.timeline });
      const merged = res.data.cues.map((c, i) => ({ ...cues[i], text: c.text, start: c.start, end: c.end, edited: false }));
      setCues(merged);
      if (res.data.warnings?.length) toast.info(res.data.warnings[0] + (res.data.warnings.length > 1 ? ` (+${res.data.warnings.length - 1})` : ""));
      else toast.success(t("srtAligned"));
    } catch (e) { toast.error(friendlyError(e, t)); }
    finally { setAligning(false); }
  }

  function applyShift() {
    const d = parseFloat(shift);
    if (!Number.isFinite(d) || d === 0) return;
    setCues((c) => shiftAll(c, d));
    setShift("0");
  }

  async function exportSrt() {
    if (!cues.length || exporting) return;
    if (issueCount && !(await confirm({ title: t("srtIssuesTitle"), message: t("srtIssuesMsg").replace("{n}", String(issueCount)), confirmText: t("srtExportAnyway") }))) return;
    setExporting(true);
    const name = `${baseName(file?.name || "subtitles")}.srt`;
    try {
      const { blob } = await toolsApi.srtExport({ cues: toPayload(cues), bom, filename: name });
      saveBlob(blob, name);
      toast.success(t("downloaded"));
    } catch (e) {
      toast.error(friendlyError(e, t));
    } finally { setExporting(false); }
  }

  const stageText = progress
    ? progress.stage === "decode" ? t("srtStageDecode")
    : progress.stage === "transcribe" ? t("srtStageChunk").replace("{i}", progress.chunk).replace("{n}", progress.chunks)
    : progress.stage === "cues" ? t("srtStageCues") : t("srtStageDone")
    : "";

  return (
    <ToolShell icon="ri-closed-captioning-line" titleKey="Srt" subKey="srtSub">
      <GeminiKeyPanel status={status} access={access} />

      <div className="tk-card">
        <Dropzone accept="audio/*,video/*,.mp3,.wav,.m4a,.ogg,.flac,.aac,.mp4,.mov,.webm,.mkv" file={file} onFile={(f) => { setFile(f); setResult(null); setCues([]); setError(""); }}
          onClear={() => { setFile(null); setResult(null); setCues([]); }} disabled={busy} icon="ri-voice-recognition-line" hintKey="srtDropHint" />

        <details>
          <summary className="tk-label" style={{ cursor: "pointer" }}><i className="ri-equalizer-3-line" />{t("srtSettings")}</summary>
          <div className="tk-fields" style={{ marginTop: 10 }}>
            {SETTING_FIELDS.map((f) => (
              <div key={f.key}>
                <div className="tk-label">{t(f.label)}</div>
                <input className="tk-input" type="number" min={f.min} max={f.max} step={f.step} value={settings[f.key]}
                  onChange={(e) => setSettings((s) => ({ ...s, [f.key]: e.target.value === "" ? "" : Number(e.target.value) }))} />
              </div>
            ))}
          </div>
          {result?.timeline?.length > 0 && <button type="button" className="tk-btn ghost small" style={{ marginTop: 10 }} onClick={applySettings}><i className="ri-refresh-line" />{t("srtRebuild")}</button>}
        </details>

        <div className="tk-row">
          <button type="button" className="tk-btn" disabled={!file || busy || !access.ready} onClick={generate}>
            <i className={busy ? "ri-loader-4-line spin" : "ri-sparkling-2-line"} />{busy ? t("srtWorking") : t("srtGenerate")}
          </button>
          {busy && <button type="button" className="tk-btn ghost" onClick={() => abort.current?.abort()}><i className="ri-stop-circle-line" />{t("cancel")}</button>}
          {file && !busy && <span className="tk-hint">{formatBytes(file.size)}</span>}
        </div>

        {busy && progress && (
          <div aria-live="polite">
            <div className="tk-progress" role="progressbar" aria-valuenow={progress.percent} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress.percent}%` }} /></div>
            <div className="tk-hint" style={{ marginTop: 6 }}>{stageText}</div>
          </div>
        )}
        {error && <div className="tk-alert err" role="alert"><i className="ri-error-warning-line" />{error}</div>}
      </div>

      {result && (
        <div className="tk-card srt-layout" data-aos="fade-up">
          <div className="tk-row">
            <span className="tk-chip ok"><i className="ri-checkbox-circle-line" />{cues.length} {t("srtCues")}</span>
            <span className={`tk-chip ${result.timing === "word-level" ? "ok" : "warn"}`}>{result.timing === "word-level" ? t("srtWordLevel") : t("srtSegLevel")}</span>
            <span className="tk-chip">{formatClock(result.duration)}</span>
            {result.model && <span className="tk-chip">{result.model}</span>}
            {issueCount > 0 && <span className="tk-chip err">{issueCount} {t("srtIssues")}</span>}
          </div>

          {result.warnings.length > 0 && (
            <div className="tk-alert" role="status"><i className="ri-alert-line" /><div>{t("srtWarnings")}<ul>{result.warnings.slice(0, 6).map((w, i) => <li key={i}>{w}</li>)}{result.warnings.length > 6 && <li>+{result.warnings.length - 6}</li>}</ul></div></div>
          )}

          <div className="srt-wave">
            <Waveform ref={wave} file={file} onTime={setTime} onPlayState={setPlaying} />
            <div className="srt-player">
              <button type="button" className="tk-btn small" onClick={() => wave.current?.toggle()}><i className={playing ? "ri-pause-fill" : "ri-play-fill"} />{playing ? t("pause") : t("play")}</button>
              <span className="srt-time">{formatClock(time)} / {formatClock(result.duration)}</span>
              <span className="tk-hint" style={{ marginLeft: "auto" }}>{cues.find((c) => c.id === activeId)?.text.split("\n")[0]}</span>
            </div>
          </div>

          <div className="tk-row spread">
            <div className="tk-row">
              <input className="tk-input" style={{ width: 84 }} value={shift} onChange={(e) => setShift(e.target.value)} aria-label={t("srtShift")} inputMode="decimal" />
              <button type="button" className="tk-btn ghost small" onClick={applyShift}><i className="ri-time-line" />{t("srtShiftBtn")}</button>
              <button type="button" className="tk-btn ghost small" onClick={() => setCues(fixOverlaps)}><i className="ri-magic-line" />{t("srtFixOverlaps")}</button>
              {result.timeline?.length > 0 && <button type="button" className="tk-btn ghost small" disabled={aligning} onClick={realign}><i className={aligning ? "ri-loader-4-line spin" : "ri-focus-3-line"} />{t("srtRealign")}</button>}
            </div>
          </div>

          <div className="srt-list" ref={list}>
            {cues.map((c, i) => (
              <CueRow key={c.id} cue={c} index={i} issues={issues[i]} active={c.id === activeId} canMerge={i < cues.length - 1}
                onChange={onChange} onPlay={onPlay} onSplit={onSplit} onMerge={onMerge} onRemove={onRemove} t={t} />
            ))}
            {!cues.length && <div className="tk-empty"><i className="ri-closed-captioning-line" />{t("srtNoCues")}</div>}
          </div>

          <div className="tk-row spread">
            <label className="tk-hint" style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={bom} onChange={(e) => setBom(e.target.checked)} />{t("srtBom")}
            </label>
            <button type="button" className="tk-btn" disabled={!cues.length || exporting} onClick={exportSrt}>
              <i className={exporting ? "ri-loader-4-line spin" : "ri-download-2-line"} />{t("srtExport")}
            </button>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
