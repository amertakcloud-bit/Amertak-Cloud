import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { toolsApi } from "../../services/toolsApi";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useFeedback } from "../../components/ui/Feedback";
import ToolShell from "../../components/tools/ToolShell";
import GeminiKeyPanel, { useGeminiAccess } from "../../components/tools/GeminiKey";
import useToolsStatus from "../../hooks/useToolsStatus";
import Timeline from "../../components/editor/Timeline";
import Inspector from "../../components/editor/Inspector";
import { friendlyError } from "../../lib/errors";
import { saveBlob as download } from "../../lib/download";
import { RATES, tokensForBytes } from "../../lib/tokens";
import { Engine } from "../../lib/editor/engine";
import { deleteProjectMedia, getMedia, probeMedia, putMedia } from "../../lib/editor/mediaStore";
import { captionsFromFile, pool, translateLines, voiceClip, voiceForCue, voiceMedia } from "../../lib/editor/ai";
import {
  addClip, addMedia, buildSrt, cuesToCaptionClips, cuesToTimelineCaptions, duplicateClip, makeMediaClip, makeTextClip,
  newProject, parseSrt, projectDuration, removeClip, splitClip, uid, updateClip,
} from "../../lib/editor/model";
import "../../styles/tools/editor.css";

const PRESETS = [
  { id: "16:9", w: 1280, h: 720, key: "vePreset169" },
  { id: "9:16", w: 720, h: 1280, key: "vePreset916" },
  { id: "1:1", w: 1080, h: 1080, key: "vePreset11" },
];

export default function VideoEditor() {
  const { id } = useParams();
  return id ? <Workspace key={id} id={id} /> : <ProjectList />;
}

/* ───────────────────────── project list ───────────────────────── */
function ProjectList() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast, confirm } = useFeedback();
  const nav = useNavigate();
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [preset, setPreset] = useState(PRESETS[0]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const r = await api.get("/editor/projects");
      setProjects(r.data.projects);
    } catch (e) {
      setProjects([]);
      setError(friendlyError(e, t));
    }
  }, [t]);
  useEffect(() => { if (user) load(); }, [user, load]);

  async function create(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const data = newProject({ width: preset.w, height: preset.h });
      const r = await api.post("/editor/projects", { name: name.trim() || t("veUntitled"), width: preset.w, height: preset.h, duration: 0, data });
      nav(`/tools/video-editor/${r.data.project.id}`);
    } catch (err) {
      toast.error(friendlyError(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function remove(p) {
    if (!(await confirm({ title: t("veDeleteTitle"), message: t("veDeleteMsg").replace("{name}", p.name), confirmText: t("delete"), danger: true }))) return;
    try {
      await api.delete(`/editor/projects/${p.id}`);
      deleteProjectMedia(p.id).catch(() => {});
      setProjects((l) => l.filter((x) => x.id !== p.id));
    } catch (err) {
      toast.error(friendlyError(err, t));
    }
  }

  return (
    <ToolShell icon="ri-movie-2-line" titleKey="VideoEditor" subKey="veSub">
      {!user ? (
        <div className="tk-alert warn"><i className="ri-lock-line" /> {t("veLogin")} <Link to="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>{t("tokLoginBtn")}</Link></div>
      ) : (
        <>
          <form className="tk-card ve-new" onSubmit={create}>
            <input className="tk-input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder={t("veProjectName")} aria-label={t("veProjectName")} />
            <div className="tk-seg">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" className={preset.id === p.id ? "active" : ""} onClick={() => setPreset(p)}>{p.id}</button>
              ))}
            </div>
            <button type="submit" className="tk-btn" disabled={busy}><i className={busy ? "ri-loader-4-line spin" : "ri-add-line"} />{t("veCreate")}</button>
          </form>
          {error && <div className="tk-alert err" role="alert"><i className="ri-error-warning-line" />{error}</div>}
          {projects === null ? (
            <div className="tk-empty"><i className="ri-loader-4-line spin" /></div>
          ) : projects.length === 0 && !error ? (
            <p className="tk-hint">{t("veNoProjects")}</p>
          ) : (
            <div className="ve-projects">
              {projects.map((p) => (
                <div key={p.id} className="tk-card ve-proj">
                  <Link to={`/tools/video-editor/${p.id}`} className="ve-proj-main">
                    <i className="ri-movie-2-line" />
                    <b>{p.name}</b>
                    <span className="tk-hint">{p.width}×{p.height} · {Math.round(p.duration || 0)}s · {new Date(p.updatedAt).toLocaleDateString()}</span>
                  </Link>
                  <button type="button" className="tk-btn ghost small" onClick={() => remove(p)} aria-label={t("delete")}><i className="ri-delete-bin-line" /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ToolShell>
  );
}

/* ───────────────────────── editor workspace ───────────────────────── */
function Workspace({ id }) {
  const { t } = useLanguage();
  const { user, refreshUser } = useAuth();
  const { toast, confirm } = useFeedback();
  const { data: status } = useToolsStatus();
  const access = useGeminiAccess(status);
  const nav = useNavigate();

  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [project, setProject] = useState(() => newProject());
  const [selected, setSelected] = useState(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(60);
  const [tab, setTab] = useState("inspector");
  const [missing, setMissing] = useState([]);
  const [save, setSave] = useState("saved"); // saved | dirty | saving | error
  const [task, setTask] = useState(null); // { label, percent }
  const [loadError, setLoadError] = useState("");
  const [aiSource, setAiSource] = useState("");
  const [lang, setLang] = useState("auto");
  const [voice, setVoice] = useState("km-KH-PisethNeural");
  const [orig, setOrig] = useState("duck");
  const [defaults, setDefaults] = useState(null);

  const canvas = useRef(null);
  const engine = useRef(null);
  const projRef = useRef(project);
  projRef.current = project;
  const past = useRef([]);
  const future = useRef([]);
  const abort = useRef(null);
  const timeRef = useRef(0);
  timeRef.current = time;

  /* engine lifecycle */
  useEffect(() => {
    const e = new Engine({ canvas: canvas.current, getProject: () => projRef.current, onTime: setTime, onState: (s) => setPlaying(s.playing) });
    engine.current = e;
    return () => { abort.current?.abort(); e.dispose(); engine.current = null; };
  }, []);
  useEffect(() => { toolsApi.srtStatus().then((r) => setDefaults(r.data?.defaults)).catch(() => {}); }, []);

  /* load project + media */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get(`/editor/projects/${id}`);
        if (!alive) return;
        const p = r.data.project;
        const d = p.data || {};
        const proj = { ...newProject({ width: p.width, height: p.height }), ...d, width: p.width, height: p.height, media: d.media || {}, clips: d.clips || [] };
        setName(p.name);
        setProject(proj);
        projRef.current = proj;
        const miss = [];
        for (const m of Object.values(proj.media)) {
          let blob = null;
          try { blob = await getMedia(id, m.id); } catch { /* no IndexedDB */ }
          if (blob) engine.current?.setMedia(m.id, blob); else miss.push(m.id);
        }
        if (alive) { setMissing(miss); setLoaded(true); engine.current?.seek(0); }
      } catch (e) {
        if (alive) setLoadError(friendlyError(e, t));
      }
    })();
    return () => { alive = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* project edits */
  const preview = useCallback((next) => { projRef.current = next; setProject(next); engine.current?.requestRender(); }, []);
  const commit = useCallback((next, { baseline } = {}) => {
    const prev = baseline ?? past.current.pendingBase ?? projRef.current;
    if (next) { projRef.current = next; setProject(next); }
    past.current.push(prev);
    if (past.current.length > 60) past.current.shift();
    past.current.pendingBase = null;
    future.current = [];
    setSave("dirty");
    engine.current?.requestRender();
  }, []);
  // Edits that go through `edit` are one undo step each.
  const edit = useCallback((fn) => { const next = fn(projRef.current); if (next && next !== projRef.current) commit(next, { baseline: projRef.current }); return next; }, [commit]);

  // Timeline drags: remember the project at drag start; commit once on release.
  const onPreview = useCallback((next) => { if (!past.current.pendingBase) past.current.pendingBase = projRef.current; preview(next); }, [preview]);
  const onCommit = useCallback(() => { commit(projRef.current); }, [commit]);

  function undo() {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(projRef.current);
    preview(prev); setSave("dirty");
  }
  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(projRef.current);
    preview(next); setSave("dirty");
  }

  /* autosave (debounced) */
  const saveNow = useCallback(async () => {
    const p = projRef.current;
    setSave("saving");
    try {
      await api.put(`/editor/projects/${id}`, {
        name, width: p.width, height: p.height, duration: projectDuration(p),
        data: { version: p.version, fps: p.fps, media: p.media, clips: p.clips, captionStyle: p.captionStyle },
      });
      setSave("saved");
    } catch (e) {
      setSave("error");
      toast.error(friendlyError(e, t));
    }
  }, [id, name, t, toast]);
  useEffect(() => {
    if (save !== "dirty" || !loaded) return undefined;
    const h = setTimeout(saveNow, 1800);
    return () => clearTimeout(h);
  }, [save, project, loaded, saveNow]);
  useEffect(() => {
    const warn = (e) => { if (save === "dirty" || save === "saving") { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  /* media */
  async function importFiles(fileList) {
    const files = Array.from(fileList || []);
    for (const f of files) {
      try {
        const info = await probeMedia(f);
        const media = { id: uid("m"), name: f.name, kind: info.kind, duration: info.duration, width: info.width, height: info.height, size: f.size, source: "upload" };
        await putMedia(id, media.id, f);
        engine.current?.setMedia(media.id, f);
        edit((p) => addClip(addMedia(p, media), makeMediaClip(media, { start: info.kind === "audio" ? 0 : endOfLane(p, info.kind === "audio" ? "audio" : "video") })));
      } catch (e) {
        toast.error(`${f.name}: ${e.message === "UNSUPPORTED" ? t("veUnsupported") : t("veUnreadable")}`);
      }
    }
    if (files.length) { engine.current?.seek(timeRef.current); }
  }
  const endOfLane = (p, lane) => p.clips.filter((c) => c.lane === lane).reduce((m, c) => Math.max(m, c.start + c.dur), 0);

  async function relink(mediaId, file) {
    if (!file) return;
    await putMedia(id, mediaId, file);
    engine.current?.setMedia(mediaId, file);
    setMissing((m) => m.filter((x) => x !== mediaId));
  }

  function addMediaAtPlayhead(m) {
    edit((p) => addClip(p, makeMediaClip(m, { start: timeRef.current, lane: m.kind === "audio" ? (m.source === "voice" ? "voice" : "audio") : "video" })));
  }
  function addText() {
    const c = makeTextClip({ text: t("veSampleText"), start: timeRef.current });
    edit((p) => addClip(p, c));
    setSelected(c.id); setTab("inspector");
  }
  async function importSrt(file) {
    if (!file) return;
    const cues = parseSrt(await file.text());
    if (!cues.length) { toast.error(t("veSrtEmpty")); return; }
    edit((p) => ({ ...p, clips: [...p.clips, ...cuesToTimelineCaptions(cues, p.captionStyle)] }));
    toast.success(t("veSrtAdded").replace("{n}", String(cues.length)));
  }
  function exportSrt() {
    const srt = buildSrt(projRef.current.clips);
    if (!srt) { toast.info(t("veNoCaptions")); return; }
    download(new Blob(["﻿" + srt], { type: "application/x-subrip;charset=utf-8" }), `${name || "captions"}.srt`);
  }

  /* clip operations */
  const sel = project.clips.find((c) => c.id === selected) || null;
  const changeSel = (patch) => selected && edit((p) => updateClip(p, selected, patch));
  function split() {
    const target = sel || project.clips.find((c) => time > c.start && time < c.start + c.dur);
    if (!target) return;
    const r = splitClip(projRef.current, target.id, timeRef.current);
    if (r.ids) { commit(r.project, { baseline: projRef.current }); setSelected(r.ids[1]); }
  }
  function del() { if (selected) { edit((p) => removeClip(p, selected)); setSelected(null); } }
  function dup() {
    if (!selected) return;
    const r = duplicateClip(projRef.current, selected);
    if (r.id) { commit(r.project, { baseline: projRef.current }); setSelected(r.id); }
  }
  function applyCaptionStyle(clip) {
    edit((p) => ({ ...p, captionStyle: { ...clip.style }, clips: p.clips.map((c) => (c.type === "caption" ? { ...c, style: { ...clip.style }, y: clip.y } : c)) }));
  }

  /* keyboard */
  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.code === "Space") { e.preventDefault(); engine.current?.toggle(); }
      else if (e.key === "s" && !mod) split();
      else if (e.key === "Delete" || e.key === "Backspace") del();
      else if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      else if (e.key === "ArrowLeft") engine.current?.seek(timeRef.current - (e.shiftKey ? 1 : 0.1));
      else if (e.key === "ArrowRight") engine.current?.seek(timeRef.current + (e.shiftKey ? 1 : 0.1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ───────── AI: captions ───────── */
  const sourceClips = project.clips.filter((c) => (c.type === "video" || c.type === "audio") && c.lane !== "voice");
  const source = sourceClips.find((c) => c.id === aiSource) || (sel && sourceClips.find((c) => c.id === sel.id)) || sourceClips[0] || null;
  const sourceBlobSize = source ? project.media[source.mediaId]?.size || 0 : 0;
  const cost = tokensForBytes(sourceBlobSize, RATES.captionPerMB);

  async function sourceFile(clip) {
    const m = projRef.current.media[clip.mediaId];
    const blob = await getMedia(id, clip.mediaId).catch(() => null);
    if (!blob) throw new Error(t("veMissingMedia"));
    return new File([blob], m.name, { type: blob.type });
  }

  async function runTask(label, fn) {
    abort.current = new AbortController();
    setTask({ label, percent: 1 });
    try {
      await fn(abort.current.signal, (percent, l) => setTask({ label: l || label, percent: Math.round(percent) }));
    } catch (e) {
      if (e.code === "ABORTED" || abort.current?.signal.aborted) toast.info(t("cancelled"));
      else toast.error(friendlyError(e, t));
    } finally {
      setTask(null);
      refreshUser();
    }
  }

  async function checkReady(c) {
    if (!user) { toast.info(t("tokLogin")); return false; }
    if (!access.ready) { toast.info(t("keyRequired")); return false; }
    if (!source) { toast.info(t("veNeedSource")); return false; }
    if (cost > Number(user.tokens ?? 0)) { toast.error(t("err_INSUFFICIENT_TOKENS")); return false; }
    return confirm({ title: t("veUseTokensTitle"), message: t("veUseTokensMsg").replace("{n}", String(cost)).replace("{name}", c), confirmText: t("veContinue") });
  }

  async function generateCaptions() {
    if (!(await checkReady(project.media[source?.mediaId]?.name || ""))) return;
    const src = source;
    await runTask(t("veTaskCaptions"), async (signal, progress) => {
      const file = await sourceFile(src);
      const { cues, cost: spent } = await captionsFromFile(file, {
        settings: defaults || undefined, signal, onCharged: () => refreshUser(),
        onProgress: (p) => progress(p.percent || 1),
      });
      edit((p) => ({
        ...p,
        clips: [...p.clips.filter((c) => !(c.type === "caption" && c.source === src.id)), ...cuesToCaptionClips(cues, src, p.captionStyle)],
      }));
      toast.success(`${t("srtDone").replace("{n}", String(cues.length))} ${t("tokCharged").replace("{n}", String(spent))}`);
    });
  }

  /* ───────── AI: translate to Khmer voice ───────── */
  async function translateToVoice() {
    if (!(await checkReady(project.media[source?.mediaId]?.name || ""))) return;
    const src = source;
    await runTask(t("veTaskTranscribe"), async (signal, progress) => {
      const file = await sourceFile(src);
      const { cues } = await captionsFromFile(file, { settings: defaults || undefined, signal, onCharged: () => refreshUser(), onProgress: (p) => progress((p.percent || 1) * 0.5) });
      const mapped = cuesToCaptionClips(cues, src);
      if (!mapped.length) throw new Error(t("veNoSpeech"));

      progress(52, t("veTaskTranslate"));
      const km = await translateLines(mapped.map((c) => c.text), lang, signal);

      // Captions become the Khmer text (the voice reads exactly what is shown).
      const caps = mapped.map((c, i) => ({ ...c, text: km[i] || c.text, id: uid("c") }));
      edit((p) => ({ ...p, clips: [...p.clips.filter((c) => !(c.type === "caption" && c.source === src.id)), ...caps.map((c) => ({ ...c, style: { ...p.captionStyle } }))] }));

      progress(60, t("veTaskVoice"));
      const results = new Array(caps.length);
      let done = 0;
      await pool(caps, 2, async (c, i) => {
        const v = await voiceForCue({ text: c.text, voice, slot: c.dur, signal });
        results[i] = v;
        done += 1;
        progress(60 + (done / caps.length) * 38);
      }, signal);

      let next = projRef.current;
      const oldVoices = next.clips.filter((c) => c.lane === "voice" && c.source === src.id).map((c) => c.id);
      next = { ...next, clips: next.clips.filter((c) => !oldVoices.includes(c.id)) };
      for (let i = 0; i < caps.length; i++) {
        const v = results[i];
        const m = voiceMedia(`voice-${i + 1}.mp3`, v.duration, v.blob.size);
        await putMedia(id, m.id, v.blob);
        engine.current?.setMedia(m.id, v.blob);
        next = addClip(addMedia(next, m), { ...voiceClip(m, caps[i].start), source: src.id });
      }
      if (orig !== "keep") next = updateClip(next, src.id, { volume: orig === "mute" ? 0 : 0.12 });
      commit(next, { baseline: projRef.current });
      engine.current?.seek(src.start);
      toast.success(t("veVoiceDone").replace("{n}", String(caps.length)));
    });
  }

  /* ───────── export ───────── */
  async function exportVideo() {
    if (!projectDuration(projRef.current)) { toast.info(t("veEmptyProject")); return; }
    if (missing.length) { toast.error(t("veMissingMedia")); return; }
    if (!window.MediaRecorder) { toast.error(t("veNoRecorder")); return; }
    if (!(await confirm({ title: t("veExportTitle"), message: t("veExportMsg"), confirmText: t("veExportStart") }))) return;
    selectNone();
    await runTask(t("veExporting"), async (signal, progress) => {
      const { blob, ext } = await engine.current.exportVideo({ signal, onProgress: (f) => progress(f * 100) });
      download(blob, `${name || "video"}.${ext}`);
      toast.success(t("veExported"));
      engine.current.seek(0);
    });
  }
  const selectNone = () => setSelected(null);
  function cancelTask() { abort.current?.abort(); }

  const duration = projectDuration(project);
  const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${String(Math.floor((s % 1) * 10))}`;
  const mediaList = useMemo(() => Object.values(project.media), [project.media]);

  if (loadError) {
    return (
      <ToolShell icon="ri-movie-2-line" titleKey="VideoEditor" subKey="veSub">
        <div className="tk-alert err" role="alert"><i className="ri-error-warning-line" />{loadError}</div>
        <Link className="tk-btn ghost" to="/tools/video-editor"><i className="ri-arrow-left-line" />{t("veBack")}</Link>
      </ToolShell>
    );
  }

  const busy = Boolean(task);
  return (
    <div className="ve">
      <div className="ve-bar">
        <button type="button" className="tk-btn ghost small" onClick={async () => { if (save === "dirty") await saveNow(); nav("/tools/video-editor"); }}><i className="ri-arrow-left-line" />{t("veBack")}</button>
        <input className="ve-name" value={name} maxLength={120} onChange={(e) => { setName(e.target.value); setSave("dirty"); }} aria-label={t("veProjectName")} />
        <span className={`ve-save ${save}`} role="status">{t(`veSave_${save}`)}</span>
        <button type="button" className="tk-btn ghost small" onClick={saveNow} disabled={busy}><i className="ri-save-3-line" />{t("veSave")}</button>
        <button type="button" className="tk-btn small" onClick={exportVideo} disabled={busy}><i className="ri-download-2-line" />{t("veExport")}</button>
      </div>

      <div className="ve-top">
        <div className="ve-stage">
          <div className="ve-canvas-wrap" style={{ aspectRatio: `${project.width} / ${project.height}` }}>
            <canvas ref={canvas} width={project.width} height={project.height} className="ve-canvas" aria-label={t("vePreview")} />
            {!loaded && <div className="ve-loading"><i className="ri-loader-4-line spin" /></div>}
          </div>
          <div className="ve-transport">
            <button type="button" className="tk-btn small" onClick={() => engine.current?.toggle()} disabled={busy || !duration} aria-label={playing ? t("vePause") : t("vePlay")}>
              <i className={playing ? "ri-pause-fill" : "ri-play-fill"} />{playing ? t("vePause") : t("vePlay")}
            </button>
            <button type="button" className="tk-btn ghost small" onClick={() => engine.current?.seek(0)} aria-label={t("veToStart")}><i className="ri-skip-back-fill" /></button>
            <span className="ve-time">{fmtT(time)} / {fmtT(duration)}</span>
          </div>
        </div>

        <div className="ve-side tk-card">
          <div className="tk-seg" role="tablist">
            {["inspector", "media", "ai"].map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} type="button" className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{t(`veTab_${k}`)}</button>
            ))}
          </div>

          {tab === "inspector" && <Inspector clip={sel} project={project} onChange={changeSel} onApplyCaptionStyle={applyCaptionStyle} t={t} />}

          {tab === "media" && (
            <div className="ve-media">
              <label className="tk-btn small ve-file"><i className="ri-add-line" />{t("veAddMedia")}
                <input type="file" hidden multiple accept="video/*,audio/*,image/*" onChange={(e) => { importFiles(e.target.files); e.target.value = ""; }} />
              </label>
              {mediaList.length === 0 && <p className="tk-hint">{t("veNoMedia")}</p>}
              {mediaList.map((m) => (
                <div key={m.id} className="ve-mitem">
                  <i className={m.kind === "video" ? "ri-film-line" : m.kind === "audio" ? "ri-music-2-line" : "ri-image-line"} />
                  <span className="ve-mname" title={m.name}>{m.name}</span>
                  {missing.includes(m.id) ? (
                    <label className="tk-btn ghost small ve-file">{t("veRelink")}<input type="file" hidden accept="video/*,audio/*,image/*" onChange={(e) => relink(m.id, e.target.files?.[0])} /></label>
                  ) : (
                    <button type="button" className="tk-btn ghost small" onClick={() => addMediaAtPlayhead(m)} aria-label={t("veAddToTimeline")}><i className="ri-add-line" /></button>
                  )}
                </div>
              ))}
              {missing.length > 0 && <p className="tk-hint">{t("veMissingHint")}</p>}
            </div>
          )}

          {tab === "ai" && (
            <div className="ve-ai">
              <GeminiKeyPanel status={status} access={access} />
              <label className="ve-field"><span>{t("veAiSource")}</span>
                <select className="tk-input" value={source?.id || ""} onChange={(e) => setAiSource(e.target.value)} disabled={!sourceClips.length}>
                  {sourceClips.length === 0 && <option value="">{t("veNeedSource")}</option>}
                  {sourceClips.map((c) => <option key={c.id} value={c.id}>{project.media[c.mediaId]?.name || c.type}</option>)}
                </select>
              </label>
              <div className="tk-hint"><i className="ri-coin-line" /> {t("tokCost")}: <b>{source ? cost : "—"}</b> {t("tokUnit")} · {t("tokBalance")}: <b>{Number(user?.tokens ?? 0)}</b> ({t("tokPerMB").replace("{n}", String(RATES.captionPerMB))})</div>
              <button type="button" className="tk-btn full" disabled={busy || !source} onClick={generateCaptions}><i className="ri-closed-captioning-line" />{t("veGenCaptions")}</button>

              <hr className="ve-hr" />
              <div className="ve-title">{t("veTranslateTitle")}</div>
              <p className="tk-hint">{t("veTranslateHint")}</p>
              <label className="ve-field"><span>{t("veFrom")}</span>
                <select className="tk-input" value={lang} onChange={(e) => setLang(e.target.value)}>
                  <option value="auto">{t("veLangAuto")}</option><option value="zh">中文 (Chinese)</option><option value="en">English</option>
                </select>
              </label>
              <label className="ve-field"><span>{t("veVoice")}</span>
                <div className="tk-seg">
                  <button type="button" className={voice === "km-KH-PisethNeural" ? "active" : ""} onClick={() => setVoice("km-KH-PisethNeural")}>Piseth</button>
                  <button type="button" className={voice === "km-KH-SreymomNeural" ? "active" : ""} onClick={() => setVoice("km-KH-SreymomNeural")}>Sreymom</button>
                </div>
              </label>
              <label className="ve-field"><span>{t("veOriginalAudio")}</span>
                <select className="tk-input" value={orig} onChange={(e) => setOrig(e.target.value)}>
                  <option value="duck">{t("veOrigDuck")}</option><option value="mute">{t("veOrigMute")}</option><option value="keep">{t("veOrigKeep")}</option>
                </select>
              </label>
              <button type="button" className="tk-btn full" disabled={busy || !source} onClick={translateToVoice}><i className="ri-translate-2" />{t("veTranslateBtn")}</button>
            </div>
          )}
        </div>
      </div>

      <div className="ve-tools">
        <label className="tk-btn ghost small ve-file"><i className="ri-image-add-line" />{t("veAddMedia")}
          <input type="file" hidden multiple accept="video/*,audio/*,image/*" onChange={(e) => { importFiles(e.target.files); e.target.value = ""; }} />
        </label>
        <button type="button" className="tk-btn ghost small" onClick={addText}><i className="ri-text" />{t("veAddText")}</button>
        <label className="tk-btn ghost small ve-file"><i className="ri-file-text-line" />{t("veAddSrt")}
          <input type="file" hidden accept=".srt,text/plain,application/x-subrip" onChange={(e) => { importSrt(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <button type="button" className="tk-btn ghost small" onClick={exportSrt}><i className="ri-download-line" />.srt</button>
        <span className="ve-sep" />
        <button type="button" className="tk-btn ghost small" onClick={split} aria-label={t("veSplit")}><i className="ri-scissors-cut-line" /><span className="ve-lbl">{t("veSplit")}</span></button>
        <button type="button" className="tk-btn ghost small" onClick={dup} disabled={!selected} aria-label={t("veDuplicate")}><i className="ri-file-copy-line" /></button>
        <button type="button" className="tk-btn ghost small" onClick={del} disabled={!selected} aria-label={t("delete")}><i className="ri-delete-bin-line" /></button>
        <button type="button" className="tk-btn ghost small" onClick={undo} disabled={!past.current.length} aria-label={t("veUndo")}><i className="ri-arrow-go-back-line" /></button>
        <button type="button" className="tk-btn ghost small" onClick={redo} disabled={!future.current.length} aria-label={t("veRedo")}><i className="ri-arrow-go-forward-line" /></button>
        <span className="ve-sep" />
        <i className="ri-zoom-out-line" aria-hidden="true" />
        <input type="range" min="15" max="240" step="5" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label={t("veZoom")} className="ve-zoom" />
        <i className="ri-zoom-in-line" aria-hidden="true" />
      </div>

      <Timeline project={project} time={time} zoom={zoom} selected={selected} t={t}
        onSelect={setSelected} onSeek={(s) => engine.current?.seek(s)} onPreview={onPreview} onCommit={onCommit} />

      {task && (
        <div className="ve-task" role="status" aria-live="polite">
          <div className="ve-task-card">
            <b>{task.label}</b>
            <div className="tk-progress"><span style={{ width: `${task.percent}%` }} /></div>
            <span className="tk-hint">{task.percent}%{task.label === t("veExporting") ? ` · ${t("veKeepOpen")}` : ""}</span>
            <button type="button" className="tk-btn ghost small" onClick={cancelTask}><i className="ri-stop-circle-line" />{t("cancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
