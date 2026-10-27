import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Select from "../../components/ui/Select";
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
import StageOverlay from "../../components/editor/StageOverlay";
import CaptionStyle from "../../components/editor/CaptionStyle";
import AiPanel from "../../components/editor/AiPanel";
import { friendlyError } from "../../lib/errors";
import { formatBytes, saveBlob as download } from "../../lib/download";
import { RATES, tokensForBytes } from "../../lib/tokens";
import { Engine } from "../../lib/editor/engine";
import { deleteMedia, deleteProjectMedia, getMedia, probeMedia, putMedia } from "../../lib/editor/mediaStore";
import { estimateWavBytes, extractAudio } from "../../lib/editor/extract";
import { captionsFromFile, legacyVoice, pool, translateLines, voiceChars, voiceClip, voiceForCue, voiceForGender, voiceMedia } from "../../lib/editor/ai";
import {
  addClip, addMedia, applyCaptionPreset, buildSrt, cuesToCaptionClips, cuesToTimelineCaptions, duplicateClip, makeMediaClip, makeTextClip,
  DEFAULT_HIGHLIGHT, newProject, parseSrt, projectDuration, removeClip, removeSilentRanges, rippleDelete, round3, setCaptionHighlight, splitClip, TEXT_PRESETS, trimEnd, trimStart, uid, updateClip,
} from "../../lib/editor/model";
import { applyOps } from "../../lib/editor/aiOps";
import { decodeMono, findSilences } from "../../lib/editor/silence";
import useSmoothProgress from "../../hooks/useSmoothProgress";
import "../../styles/tools/editor.css";

const PRESETS = [
  { id: "16:9", w: 1280, h: 720, key: "vePreset169" },
  { id: "9:16", w: 720, h: 1280, key: "vePreset916" },
  { id: "1:1", w: 1080, h: 1080, key: "vePreset11" },
];

const AI_EDIT_COST = 1; // tokens per AI instruction (server refunds on failure)

function useNarrow(px = 900) {
  const q = `(max-width:${px}px)`;
  const [n, setN] = useState(() => typeof window !== "undefined" && window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return undefined;
    const f = () => setN(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, [q]);
  return Boolean(n);
}

// Largest box with the project's aspect ratio that fits inside the container (px).
function useFit(ref, ratio) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const calc = () => {
      const cw = el.clientWidth, ch = el.clientHeight;
      if (!cw || !ch) return;
      const w = Math.min(cw, ch * ratio);
      setSize({ w: Math.floor(w), h: Math.floor(w / ratio) });
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, ratio]);
  return size;
}

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
  const [tab, setTab] = useState("media");
  const [aiHistory, setAiHistory] = useState([]);
  const [aiBusy, setAiBusy] = useState(false);
  const narrow = useNarrow();
  const stage = useRef(null);
  const fit = useFit(stage, project.width / project.height);
  const [missing, setMissing] = useState([]);
  const [save, setSave] = useState("saved"); // saved | dirty | saving | error
  const [task, setTask] = useState(null); // { label, percent }
  const taskPct = useSmoothProgress(task?.percent ?? 0, Boolean(task));
  const taskPctRef = useRef(0);
  taskPctRef.current = taskPct;
  const [loadError, setLoadError] = useState("");
  const [aiSource, setAiSource] = useState("");
  const [lang, setLang] = useState("auto");
  const [voice, setVoice] = useState("auto"); // auto = male/female chosen per speaker
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

  function trimLeft() { if (sel && timeRef.current > sel.start && timeRef.current < sel.start + sel.dur) edit((p) => trimStart(p, sel.id, timeRef.current)); }
  function trimRight() { if (sel && timeRef.current > sel.start && timeRef.current < sel.start + sel.dur) edit((p) => trimEnd(p, sel.id, timeRef.current)); }
  function rippleDel() { if (selected) { edit((p) => rippleDelete(p, selected)); setSelected(null); } }
  function addTextPreset(preset) {
    const c = makeTextClip({ text: preset.key === "vePresetHeading" ? t("veSampleTitle") : t("veSampleText"), start: timeRef.current, style: preset.style });
    edit((p) => addClip(p, c));
    setSelected(c.id);
    if (narrow) setTab("inspector");
  }
  const onTextEdit = useCallback((clipId, value) => edit((p) => updateClip(p, clipId, { text: value })), [edit]);
  const applyPreset = (preset) => edit((p) => applyCaptionPreset(p, preset));

  /* keyboard */
  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.code === "Space") { e.preventDefault(); engine.current?.toggle(); }
      else if (k === "s" && !mod) split();
      else if (k === "q" && !mod) trimLeft();
      else if (k === "w" && !mod) trimRight();
      else if (k === "d" && mod) { e.preventDefault(); dup(); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); e.shiftKey ? rippleDel() : del(); }
      else if (e.key === "Escape") setSelected(null);
      else if (mod && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && k === "y") { e.preventDefault(); redo(); }
      else if (e.altKey && selected && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 0.05 : 0.01, c = projRef.current.clips.find((x) => x.id === selected);
        if (c && c.x != null) edit((p) => updateClip(p, selected, { x: c.x + (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0), y: c.y + (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0) }));
      }
      else if (e.key === "ArrowLeft") engine.current?.seek(timeRef.current - (e.shiftKey ? 1 : 0.1));
      else if (e.key === "ArrowRight") engine.current?.seek(timeRef.current + (e.shiftKey ? 1 : 0.1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ───────── AI: captions ───────── */
  const sourceClips = project.clips.filter((c) => (c.type === "video" || c.type === "audio") && c.lane !== "voice");
  const source = sourceClips.find((c) => c.id === aiSource) || (sel && sourceClips.find((c) => c.id === sel.id)) || sourceClips[0] || null;
  const srcMedia = source ? project.media[source.mediaId] : null;
  const extractedOf = (mediaId) => Object.values(projRef.current.media).find((x) => x.audioOf === mediaId);
  const extracted = srcMedia ? Object.values(project.media).find((x) => x.audioOf === srcMedia.id) : null;
  // Videos are reduced to their sound first (16 kHz mono WAV), so the upload — and the token cost — is much smaller.
  const sourceBlobSize = !srcMedia ? 0 : extracted ? extracted.size || 0 : srcMedia.kind === "video" ? estimateWavBytes(srcMedia.duration || 0) : srcMedia.size || 0;
  const cost = tokensForBytes(sourceBlobSize, RATES.captionPerMB);

  // Pulls the sound out of a video and keeps it in the media library (reused next time).
  async function extractToLibrary(mediaId, blob) {
    const m = projRef.current.media[mediaId];
    const r = await extractAudio(blob, m.name);
    const media = { id: uid("m"), name: r.file.name, kind: "audio", source: "extracted", audioOf: mediaId, duration: r.duration, width: 0, height: 0, size: r.size };
    await putMedia(id, media.id, r.file);
    engine.current?.setMedia(media.id, r.file);
    edit((p) => addMedia(p, media));
    return { media, file: r.file, from: m.size };
  }

  // The file that is sent for transcription: the extracted audio (made on the fly if needed) or the audio file itself.
  async function sourceFile(clip, progress) {
    const m = projRef.current.media[clip.mediaId];
    const ex = extractedOf(clip.mediaId);
    if (ex) {
      const b = await getMedia(id, ex.id).catch(() => null);
      if (b) return new File([b], ex.name, { type: "audio/wav" });
    }
    const blob = await getMedia(id, clip.mediaId).catch(() => null);
    if (!blob) throw new Error(t("veMissingMedia"));
    if (m.kind === "video") {
      progress?.(3, t("veTaskExtract"));
      return (await extractToLibrary(clip.mediaId, blob)).file;
    }
    return new File([blob], m.name, { type: blob.type });
  }

  /* ───────── extract audio (video → small WAV) ───────── */
  async function extractAudioTool() {
    const src = source;
    if (!src || project.media[src.mediaId]?.kind !== "video") { toast.info(t("veNeedVideo")); return; }
    const have = extractedOf(src.mediaId);
    if (have) { toast.info(t("veExtractedAlready").replace("{a}", formatBytes(have.size || 0))); return; }
    await runTask(t("veTaskExtract"), async (_signal, progress) => {
      progress(8);
      const blob = await getMedia(id, src.mediaId).catch(() => null);
      if (!blob) throw new Error(t("veMissingMedia"));
      progress(20);
      const r = await extractToLibrary(src.mediaId, blob);
      toast.success(t("veExtracted").replace("{a}", formatBytes(r.media.size)).replace("{b}", formatBytes(r.from || 0)));
    });
  }

  async function runTask(label, fn) {
    abort.current = new AbortController();
    setTask({ label, percent: 1 });
    try {
      await fn(abort.current.signal, (percent, l) => setTask({ label: l || label, percent: Math.round(percent) }));
      setTask((x) => x && { ...x, percent: 100 });
      for (let i = 0; i < 50 && taskPctRef.current < 100; i++) await new Promise((r) => setTimeout(r, 50)); // let the counter reach 100%
      await new Promise((r) => setTimeout(r, 250));
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

  // translate = false → captions in the spoken language; true → translated to Khmer (from Chinese / English).
  async function generateCaptions({ translate = false } = {}) {
    if (!(await checkReady(project.media[source?.mediaId]?.name || ""))) return;
    const src = source;
    await runTask(translate ? t("veTaskCaptionsKm") : t("veTaskCaptions"), async (signal, progress) => {
      const file = await sourceFile(src, (p, l) => progress(p, l));
      const top = translate ? 70 : 99;
      const { cues, cost: spent } = await captionsFromFile(file, {
        settings: defaults || undefined, signal, onCharged: () => refreshUser(),
        onProgress: (p) => progress(5 + (p.percent || 1) * ((top - 5) / 100)),
      });
      let texts = cues.map((c) => c.text);
      if (translate && texts.length) {
        progress(72, t("veTaskTranslate"));
        texts = await translateLines(texts, lang, signal, { onProgress: (d, n) => progress(72 + (d / n) * 26) });
      }
      const translated = cues.map((c, i) => ({ ...c, text: texts[i] || c.text }));
      edit((p) => ({
        ...p,
        clips: [...p.clips.filter((c) => !(c.type === "caption" && c.source === src.id)), ...cuesToCaptionClips(translated, src, p.captionStyle)],
      }));
      toast.success(`${t("srtDone").replace("{n}", String(cues.length))} ${t("tokCharged").replace("{n}", String(spent))}`);
    });
  }

  /* ───────── AI: translate to Khmer voice ───────── */
  // voice === "auto": the AI decides male / female for every line from the dialogue (Piseth = male, Sreymom = female).
  async function translateToVoice() {
    if (!(await checkReady(project.media[source?.mediaId]?.name || ""))) return;
    const src = source;
    await runTask(t("veTaskTranscribe"), async (signal, progress) => {
      const file = await sourceFile(src, (p, l) => progress(p, l));
      const { cues } = await captionsFromFile(file, { settings: defaults || undefined, signal, onCharged: () => refreshUser(), onProgress: (p) => progress(5 + (p.percent || 1) * 0.4) });
      const mapped = cuesToCaptionClips(cues, src);
      if (!mapped.length) throw new Error(t("veNoSpeech"));

      progress(46, t("veTaskTranslate"));
      const auto = voice === "auto";
      const tr = await translateLines(mapped.map((c) => c.text), lang, signal, { speakers: auto, onProgress: (d, n) => progress(46 + (d / n) * 8) });
      const km = auto ? tr.lines : tr;
      const names = mapped.map((_, i) => (auto ? voiceForGender(tr.genders[i]) : voice));

      // Captions become the Khmer text (the voice reads exactly what is shown) and highlight the word being spoken.
      const hlStyle = (p) => ({ ...p.captionStyle, karaoke: true, hl: p.captionStyle.hl || DEFAULT_HIGHLIGHT });
      const caps = mapped.map((c, i) => ({ ...c, text: km[i] || c.text, id: uid("c") }));

      // Voices cost 1 token / 200 characters: paid once, before anything is generated (refunded if it fails).
      const chars = caps.reduce((n, c) => n + voiceChars(c.text), 0);
      progress(55, t("veTaskVoice"));
      const started = (await toolsApi.voiceStart(chars)).data;
      refreshUser();
      let voiced = false;
      const results = new Array(caps.length);
      try {
        edit((p) => ({ ...p, captionStyle: hlStyle(p), clips: [...p.clips.filter((c) => !(c.type === "caption" && c.source === src.id)), ...caps.map((c) => ({ ...c, style: hlStyle(p) }))] }));
        let done = 0;
        await pool(caps, 2, async (c, i) => {
          results[i] = await voiceForCue({ text: c.text, voice: names[i], slot: c.dur, signal, job: started.job });
          done += 1;
          progress(56 + (done / caps.length) * 42);
        }, signal);
        voiced = true;
      } finally {
        if (!voiced && !signal?.aborted) toolsApi.voiceRefund(started.job).then(() => refreshUser()).catch(() => {});
      }
      toast.info(t("veVoiceCharged").replace("{n}", String(started.cost)).replace("{c}", String(chars)));

      let next = projRef.current;
      const oldVoices = next.clips.filter((c) => c.lane === "voice" && c.source === src.id).map((c) => c.id);
      next = { ...next, clips: next.clips.filter((c) => !oldVoices.includes(c.id)) };
      for (let i = 0; i < caps.length; i++) {
        const v = results[i];
        const m = voiceMedia(`voice-${i + 1}.${/wav/i.test(v.blob.type) ? "wav" : "mp3"}`, v.duration, v.blob.size);
        await putMedia(id, m.id, v.blob);
        engine.current?.setMedia(m.id, v.blob);
        next = addClip(addMedia(next, m), { ...voiceClip(m, caps[i].start), source: src.id, text: caps[i].text, voice: names[i], cap: caps[i].id });
        next = updateClip(next, caps[i].id, { speechDur: round3(v.duration) });
      }
      if (orig !== "keep") next = updateClip(next, src.id, { volume: orig === "mute" ? 0 : 0.12 });
      commit(next, { baseline: projRef.current });
      engine.current?.seek(src.start);
      toast.success(t("veVoiceDone").replace("{n}", String(caps.length)));
    });
  }

  /* ───────── regenerate one generated voice with your own text ───────── */
  async function regenerateVoice(vc, text, voiceName) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) { toast.info(t("veVoiceEmpty")); return; }
    const cap = projRef.current.clips.find((c) => c.id === vc.cap);
    if (!user) { toast.info(t("tokLogin")); return; }
    await runTask(t("veTaskVoice"), async (signal, progress) => {
      progress(10);
      const started = (await toolsApi.voiceStart(voiceChars(clean))).data; // 1 token / 200 characters
      refreshUser();
      let v;
      try {
        v = await voiceForCue({ text: clean, voice: voiceName, slot: Math.max(0.5, cap?.dur ?? vc.dur), signal, job: started.job });
      } catch (e) {
        if (!signal?.aborted) toolsApi.voiceRefund(started.job).then(() => refreshUser()).catch(() => {});
        throw e;
      }
      progress(75);
      const m = voiceMedia(`voice-${Date.now().toString(36)}.${/wav/i.test(v.blob.type) ? "wav" : "mp3"}`, v.duration, v.blob.size);
      await putMedia(id, m.id, v.blob);
      engine.current?.setMedia(m.id, v.blob);
      let next = updateClip(addMedia(projRef.current, m), vc.id, { mediaId: m.id, dur: round3(v.duration), offset: 0, text: clean, voice: voiceName });
      if (cap) next = updateClip(next, cap.id, { text: clean, speechDur: round3(v.duration) });
      if (!next.clips.some((c) => c.mediaId === vc.mediaId)) { // old audio no longer used → free it
        const { [vc.mediaId]: _gone, ...rest } = next.media;
        next = { ...next, media: rest };
        deleteMedia(id, vc.mediaId).catch(() => {});
      }
      commit(next, { baseline: projRef.current });
      engine.current?.seek(vc.start);
      toast.success(t("veVoiceRegenerated"));
    });
  }
  const applyHighlight = (on, color) => edit((p) => setCaptionHighlight(p, on, color));

  /* ───────── AI: remove silence (free, runs in the browser) ───────── */
  async function removeSilence() {
    const src = source;
    if (!src) { toast.info(t("veNeedSource")); return; }
    await runTask(t("veTaskSilence"), async (_signal, progress) => {
      const file = await sourceFile(src);
      if (file.size > 150 * 1024 * 1024) throw new Error(t("veSilenceTooBig"));
      progress(15);
      const { samples, sampleRate } = await decodeMono(file);
      progress(70);
      const r = removeSilentRanges(projRef.current, src.id, findSilences(samples, sampleRate));
      if (!r.removed) { toast.info(t("veNoSilence")); return; }
      commit(r.project, { baseline: projRef.current });
      engine.current?.seek(Math.min(timeRef.current, projectDuration(r.project)));
      toast.success(t("veSilenceRemoved").replace("{n}", r.removed.toFixed(1)));
    });
  }

  /* ───────── AI editor: plain-words instruction → validated operations ───────── */
  async function runAi(instruction) {
    if (!user) { toast.info(t("tokLogin")); return; }
    if (!access.ready) { toast.info(t("keyRequired")); return; }
    if (AI_EDIT_COST > Number(user.tokens ?? 0)) { toast.error(t("err_INSUFFICIENT_TOKENS")); return; }
    setAiHistory((h) => [...h, { role: "user", text: instruction }]);
    setAiBusy(true);
    abort.current = new AbortController();
    try {
      const p = projRef.current;
      const summary = {
        width: p.width, height: p.height, duration: projectDuration(p), playhead: timeRef.current, selected,
        clips: p.clips.map((c) => ({ id: c.id, lane: c.lane, type: c.type, start: c.start, dur: c.dur, text: c.text, name: p.media[c.mediaId]?.name })),
      };
      const r = await toolsApi.editorAi(instruction, summary, abort.current.signal);
      refreshUser();
      const res = applyOps(projRef.current, r.data.ops, { selected });
      if (res.project !== projRef.current) commit(res.project, { baseline: projRef.current });
      setAiHistory((h) => [...h, { role: "ai", text: r.data.message || (res.applied ? t("veAiDone").replace("{n}", String(res.applied)) : t("veAiNothing")) }]);
      for (const a of res.actions) {
        if (a === "generate_captions") await generateCaptions();
        else if (a === "translate_voice") await translateToVoice();
        else if (a === "remove_silence") await removeSilence();
      }
    } catch (e) {
      if (e.code !== "ABORTED") { const m = friendlyError(e, t); setAiHistory((h) => [...h, { role: "ai", text: m, error: true }]); toast.error(m); }
    } finally {
      setAiBusy(false);
    }
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
  const getBlob = useCallback((mid) => getMedia(id, mid).catch(() => null), [id]);

  if (loadError) {
    return (
      <ToolShell icon="ri-movie-2-line" titleKey="VideoEditor" subKey="veSub">
        <div className="tk-alert err" role="alert"><i className="ri-error-warning-line" />{loadError}</div>
        <Link className="tk-btn ghost" to="/tools/video-editor"><i className="ri-arrow-left-line" />{t("veBack")}</Link>
      </ToolShell>
    );
  }

  const busy = Boolean(task);
  const canTrim = Boolean(sel && time > sel.start && time < sel.start + sel.dur);
  const inspector = <Inspector clip={sel} project={project} onChange={changeSel} onApplyCaptionStyle={applyCaptionStyle} onRegenerate={regenerateVoice} busy={Boolean(task)} t={t} />;
  const TABS = [
    ["media", "ri-folder-video-line", "veTab_media"],
    ["text", "ri-text", "veTab_text"],
    ["ai", "ri-sparkling-2-line", "veTab_ai"],
    ...(narrow ? [["inspector", "ri-equalizer-line", "veTab_inspector"]] : []),
  ];
  const activeTab = !narrow && tab === "inspector" ? "media" : tab;
  const fileInput = (props, cls, children) => (
    <label className={cls}>{children}<input type="file" hidden {...props} /></label>
  );

  return (
    <div className="ve">
      <header className="ve-topbar">
        <button type="button" className="ve-ibtn" onClick={async () => { if (save === "dirty") await saveNow(); nav("/tools/video-editor"); }} aria-label={t("veBack")} title={t("veBack")}><i className="ri-arrow-left-s-line" /></button>
        <input className="ve-name" value={name} maxLength={120} onChange={(e) => { setName(e.target.value); setSave("dirty"); }} aria-label={t("veProjectName")} />
        <span className={`ve-save ${save}`} role="status">{t(`veSave_${save}`)}</span>
        <span className="ve-spacer" />
        <button type="button" className="ve-ibtn" onClick={undo} disabled={!past.current.length} aria-label={t("veUndo")} title={`${t("veUndo")} (Ctrl+Z)`}><i className="ri-arrow-go-back-line" /></button>
        <button type="button" className="ve-ibtn" onClick={redo} disabled={!future.current.length} aria-label={t("veRedo")} title={`${t("veRedo")} (Ctrl+Y)`}><i className="ri-arrow-go-forward-line" /></button>
        <button type="button" className="ve-ibtn" onClick={saveNow} disabled={busy} aria-label={t("veSave")} title={t("veSave")}><i className="ri-save-3-line" /></button>
        <button type="button" className="tk-btn small" onClick={exportVideo} disabled={busy}><i className="ri-download-2-line" /><span className="ve-lbl">{t("veExport")}</span></button>
      </header>

      <div className="ve-main">
        <aside className="ve-left">
          <nav className="ve-rail" role="tablist" aria-label="Editor tools">
            {TABS.map(([k, ic, lb]) => (
              <button key={k} role="tab" aria-selected={activeTab === k} type="button" className={activeTab === k ? "on" : ""} onClick={() => setTab(k)}>
                <i className={ic} /><span>{t(lb)}</span>
              </button>
            ))}
          </nav>
          <div className="ve-panel">
            {activeTab === "media" && (
              <div className="ve-media">
                {fileInput({ multiple: true, accept: "video/*,audio/*,image/*", onChange: (e) => { importFiles(e.target.files); e.target.value = ""; } }, "tk-btn full ve-file", <><i className="ri-add-line" />{t("veAddMedia")}</>)}
                {mediaList.length === 0 && <p className="tk-hint">{t("veNoMedia")}</p>}
                {mediaList.map((m) => (
                  <div key={m.id} className="ve-mitem">
                    <i className={m.kind === "video" ? "ri-film-line" : m.source === "extracted" ? "ri-voiceprint-line" : m.kind === "audio" ? "ri-music-2-line" : "ri-image-line"} />
                    <span className="ve-mname" title={m.name}>{m.name}</span>
                    {missing.includes(m.id) ? (
                      fileInput({ accept: "video/*,audio/*,image/*", onChange: (e) => relink(m.id, e.target.files?.[0]) }, "tk-btn ghost small ve-file", t("veRelink"))
                    ) : (
                      <button type="button" className="tk-btn ghost small" onClick={() => addMediaAtPlayhead(m)} aria-label={t("veAddToTimeline")} title={t("veAddToTimeline")}><i className="ri-add-line" /></button>
                    )}
                  </div>
                ))}
                {missing.length > 0 && <p className="tk-hint">{t("veMissingHint")}</p>}
                {mediaList.length > 0 && (
                  <section className="ve-sec">
                    <h4><i className="ri-tools-line" /> {t("veMediaTools")}</h4>
                    <button type="button" className="tk-btn ghost full" disabled={busy || !source} onClick={extractAudioTool}><i className="ri-voiceprint-line" />{t("veExtractAudio")} <small>({t("free")})</small></button>
                    <p className="tk-hint">{t("veExtractHint")}</p>
                    <button type="button" className="tk-btn ghost full" disabled={busy || !source} onClick={removeSilence}><i className="ri-scissors-cut-line" />{t("veRemoveSilence")} <small>({t("free")})</small></button>
                  </section>
                )}
              </div>
            )}

            {activeTab === "text" && (
              <div className="ve-text">
                <button type="button" className="tk-btn full" onClick={addText}><i className="ri-text" />{t("veAddText")}</button>
                <div className="ve-presets">
                  {TEXT_PRESETS.map((pr) => (
                    <button key={pr.id} type="button" className="ve-preset" onClick={() => addTextPreset(pr)}>
                      <span style={{ color: pr.style.color || "#fff", background: pr.style.bg || "transparent", fontWeight: pr.style.bold ? 700 : 400, fontStyle: pr.style.italic ? "italic" : "normal", fontFamily: pr.style.font === "serif" ? "serif" : undefined, textShadow: pr.style.outline ? "0 0 2px #000, 0 0 3px #000" : "none" }}>Aa</span>
                      <em>{t(pr.key)}</em>
                    </button>
                  ))}
                </div>
                <hr className="ve-hr" />
                {fileInput({ accept: ".srt,text/plain,application/x-subrip", onChange: (e) => { importSrt(e.target.files?.[0]); e.target.value = ""; } }, "tk-btn ghost full ve-file", <><i className="ri-file-text-line" />{t("veAddSrt")}</>)}
                <button type="button" className="tk-btn ghost full" onClick={exportSrt}><i className="ri-download-line" />{t("veExportSrt")}</button>
                <hr className="ve-hr" />
                <CaptionStyle t={t} busy={busy} highlight={{ on: Boolean(project.captionStyle?.karaoke), color: project.captionStyle?.hl || DEFAULT_HIGHLIGHT }} onHighlight={applyHighlight} onCaptionPreset={applyPreset} />
              </div>
            )}

            {activeTab === "ai" && (
              <AiPanel t={t} user={user} status={status} access={access} busy={busy} aiBusy={aiBusy} history={aiHistory} onPrompt={runAi}
                cost={cost} aiCost={AI_EDIT_COST} balance={Number(user?.tokens ?? 0)} source={source} sourceClips={sourceClips} setAiSource={setAiSource}
                onGenerateCaptions={() => generateCaptions()} onGenerateKhmerCaptions={() => generateCaptions({ translate: true })} onTranslate={translateToVoice}
                lang={lang} setLang={setLang} voice={voice} setVoice={setVoice} orig={orig} setOrig={setOrig} project={project} />
            )}

            {activeTab === "inspector" && inspector}
          </div>
        </aside>

        <section className="ve-center">
          <div className="ve-stage" ref={stage}>
            <div className="ve-canvas-wrap" style={{ width: fit.w || undefined, height: fit.h || undefined, aspectRatio: `${project.width} / ${project.height}` }}>
              <canvas ref={canvas} width={project.width} height={project.height} className="ve-canvas" aria-label={t("vePreview")} />
              {loaded && (
                <StageOverlay engine={engine} project={project} selected={selected} time={time} t={t}
                  onSelect={setSelected} onPreview={onPreview} onCommit={onCommit} onTextEdit={onTextEdit} />
              )}
              {!loaded && <div className="ve-skel sk" role="status" aria-busy="true" aria-label={t("veLoading") || "Loading"} />}
            </div>
          </div>
          <div className="ve-transport">
            <button type="button" className="ve-ibtn" onClick={() => engine.current?.seek(0)} aria-label={t("veToStart")} title={t("veToStart")}><i className="ri-skip-back-fill" /></button>
            <button type="button" className="ve-ibtn" onClick={() => engine.current?.seek(Math.max(0, timeRef.current - 5))} aria-label={t("veSkipBack")} title={t("veSkipBack")}><i className="ri-replay-5-line" /></button>
            <button type="button" className="ve-play" onClick={() => engine.current?.toggle()} disabled={busy || !duration} aria-label={playing ? t("vePause") : t("vePlay")}>
              <i className={playing ? "ri-pause-fill" : "ri-play-fill"} />
            </button>
            <button type="button" className="ve-ibtn" onClick={() => engine.current?.seek(Math.min(duration, timeRef.current + 5))} aria-label={t("veSkipFwd")} title={t("veSkipFwd")}><i className="ri-forward-5-line" /></button>
            <span className="ve-time">{fmtT(time)} / {fmtT(duration)}</span>
            <button type="button" className="ve-splitbtn" onClick={split} disabled={busy || !duration} title={`${t("veSplit")} (S)`}><i className="ri-scissors-cut-line" /><span>{t("veSplitHere")}</span></button>
          </div>
          <input type="range" className="ve-scrub" min="0" max={Math.max(0.1, duration)} step="0.05" value={Math.min(time, Math.max(0.1, duration))}
            onChange={(e) => engine.current?.seek(Number(e.target.value))} disabled={!duration} aria-label={t("veScrub")} />
        </section>

        {!narrow && <aside className="ve-right"><div className="ve-right-h">{t("veTab_inspector")}</div>{inspector}</aside>}
      </div>

      <div className="ve-bottom">
        <div className="ve-tools">
          <button type="button" className="ve-tool" onClick={split} title={`${t("veSplit")} (S)`}><i className="ri-scissors-cut-line" /><span>{t("veSplit")}</span></button>
          <button type="button" className="ve-tool" onClick={trimLeft} disabled={!canTrim} title={`${t("veTrimLeft")} (Q)`}><i className="ri-skip-left-line" /><span>{t("veTrimLeft")}</span></button>
          <button type="button" className="ve-tool" onClick={trimRight} disabled={!canTrim} title={`${t("veTrimRight")} (W)`}><i className="ri-skip-right-line" /><span>{t("veTrimRight")}</span></button>
          <span className="ve-sep" />
          <button type="button" className="ve-tool" onClick={dup} disabled={!selected} title={`${t("veDuplicate")} (Ctrl+D)`}><i className="ri-file-copy-line" /><span>{t("veDuplicate")}</span></button>
          <button type="button" className="ve-tool" onClick={del} disabled={!selected} title={`${t("delete")} (Del)`}><i className="ri-delete-bin-line" /><span>{t("delete")}</span></button>
          <button type="button" className="ve-tool" onClick={rippleDel} disabled={!selected} title={`${t("veRippleDelete")} (Shift+Del)`}><i className="ri-eraser-line" /><span>{t("veRippleDelete")}</span></button>
          <span className="ve-spacer" />
          <i className="ri-zoom-out-line" aria-hidden="true" />
          <input type="range" min="15" max="240" step="5" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label={t("veZoom")} className="ve-zoom" />
          <i className="ri-zoom-in-line" aria-hidden="true" />
        </div>
        <Timeline project={project} time={time} zoom={zoom} selected={selected} t={t}
          onSelect={setSelected} onSeek={(s) => engine.current?.seek(s)} onPreview={onPreview} onCommit={onCommit} getBlob={getBlob} />
      </div>

      {task && (
        <div className="ve-task" role="status" aria-live="polite">
          <div className="ve-task-card">
            <b>{task.label}</b>
            <div className="tk-progress" role="progressbar" aria-valuenow={taskPct} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${taskPct}%` }} /></div>
            <span className="tk-hint">{taskPct}%{task.label === t("veExporting") ? ` · ${t("veKeepOpen")}` : ""}</span>
            <button type="button" className="tk-btn ghost small" onClick={cancelTask}><i className="ri-stop-circle-line" />{t("cancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
