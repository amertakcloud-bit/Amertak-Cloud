import { useEffect, useRef, useState } from "react";
import { LANES, assignTracks, moveClip, projectDuration, snap, trimEnd, trimStart } from "../../lib/editor/model";
import { PPS, getPeaks } from "../../lib/editor/waveform";

const ROW_H = 40;
const COLLAPSED_H = 20;
const RULER_H = 26;
const LABEL_W = 84;

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Waveform of an audio clip (the visible part: offset … offset + dur), drawn on a canvas.
function Wave({ clip, zoom, getBlob }) {
  const ref = useRef(null);
  const [peaks, setPeaks] = useState(null);
  useEffect(() => {
    let live = true;
    getPeaks(clip.mediaId, getBlob).then((p) => live && setPeaks(p)).catch(() => {});
    return () => { live = false; };
  }, [clip.mediaId, getBlob]);
  const w = Math.min(4000, Math.max(6, Math.round(clip.dur * zoom)));
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !peaks) return;
    const h = cv.height;
    const g = cv.getContext("2d");
    g.clearRect(0, 0, cv.width, h);
    g.fillStyle = "rgba(255,255,255,.85)";
    for (let x = 0; x < cv.width; x += 2) {
      const t0 = (clip.offset || 0) + (x / cv.width) * clip.dur;
      const t1 = (clip.offset || 0) + ((x + 2) / cv.width) * clip.dur;
      let m = 0;
      for (let i = Math.floor(t0 * PPS); i <= Math.min(peaks.length - 1, Math.ceil(t1 * PPS)); i++) if (peaks[i] > m) m = peaks[i];
      const bh = Math.max(1, m * (h - 4));
      g.fillRect(x, (h - bh) / 2, 1.4, bh);
    }
  }, [peaks, w, clip.offset, clip.dur]);
  return <canvas ref={ref} className="ve-wave" width={w} height={ROW_H - 12} style={{ width: "100%", height: ROW_H - 12 }} aria-hidden="true" />;
}

// Timeline: ruler + collapsible lanes (each lane grows a new row when clips overlap) + draggable/trimmable
// clips + playhead. Pointer events → works with touch.
export default function Timeline({ project, time, zoom, selected, onSelect, onSeek, onPreview, onCommit, getBlob, t }) {
  const scroller = useRef(null);
  const drag = useRef(null);
  const [collapsed, setCollapsed] = useState({});
  const dur = Math.max(projectDuration(project) + 10, 30);
  const width = Math.ceil(dur * zoom);
  const { track, rows } = assignTracks(project.clips);
  const laneH = (id) => (collapsed[id] ? COLLAPSED_H : rows[id] * ROW_H);
  let acc = RULER_H;
  const tops = LANES.map((l) => { const y = acc; acc += laneH(l.id); return y; });
  const totalH = acc;

  // keep the playhead visible while playing
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const x = LABEL_W + time * zoom;
    if (x < el.scrollLeft + LABEL_W || x > el.scrollLeft + el.clientWidth - 30) el.scrollLeft = Math.max(0, x - el.clientWidth / 2);
  }, [time, zoom]);

  const timeFromEvent = (e) => {
    const r = scroller.current.getBoundingClientRect();
    return Math.max(0, (e.clientX - r.left + scroller.current.scrollLeft - LABEL_W) / zoom);
  };

  function startScrub(e) {
    if (e.button > 0) return;
    onSelect(null);
    onSeek(timeFromEvent(e));
    drag.current = { mode: "scrub" };
    attach();
  }

  function startClip(e, clip, mode) {
    if (e.button > 0) return;
    e.stopPropagation();
    onSelect(clip.id);
    drag.current = { mode, id: clip.id, x0: e.clientX, orig: { ...clip }, base: project, moved: false };
    attach();
  }

  function attach() {
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      if (d.mode === "scrub") return onSeek(timeFromEvent(e));
      const dx = (e.clientX - d.x0) / zoom;
      if (Math.abs(e.clientX - d.x0) > 2) d.moved = true;
      const pts = [time];
      let next = d.base;
      if (d.mode === "move") next = moveClip(d.base, d.id, snap(d.base, d.orig.start + dx, { points: pts, ignoreId: d.id }));
      if (d.mode === "l") next = trimStart(d.base, d.id, snap(d.base, d.orig.start + dx, { points: pts, ignoreId: d.id }));
      if (d.mode === "r") next = trimEnd(d.base, d.id, snap(d.base, d.orig.start + d.orig.dur + dx, { points: pts, ignoreId: d.id }));
      onPreview(next);
    };
    const up = () => {
      const d = drag.current;
      drag.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (d && d.mode !== "scrub" && d.moved) onCommit();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  const ticks = [];
  const step = zoom >= 120 ? 1 : zoom >= 50 ? 5 : zoom >= 25 ? 10 : 30;
  for (let s = 0; s <= dur; s += step) ticks.push(s);

  return (
    <div className="ve-timeline" ref={scroller} role="application" aria-label={t("veTimeline")}>
      <div className="ve-tl-inner" style={{ width: width + LABEL_W, height: totalH }}>
        <div className="ve-ruler" onPointerDown={startScrub} style={{ paddingLeft: LABEL_W }}>
          {ticks.map((s) => (
            <span key={s} className="ve-tick" style={{ left: LABEL_W + s * zoom }}>{fmt(s)}</span>
          ))}
        </div>

        {LANES.map((lane, i) => {
          const isCollapsed = Boolean(collapsed[lane.id]);
          const count = project.clips.filter((c) => c.lane === lane.id).length;
          return (
            <div key={lane.id} className={`ve-lane ve-lane-${lane.id}${isCollapsed ? " is-collapsed" : ""}`} style={{ top: tops[i], height: laneH(lane.id) }} onPointerDown={startScrub}>
              <button type="button" className="ve-lane-label" aria-expanded={!isCollapsed}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setCollapsed((c) => ({ ...c, [lane.id]: !c[lane.id] }))}
                title={isCollapsed ? t("veLaneExpand") : t("veLaneCollapse")}>
                <i className={isCollapsed ? "ri-arrow-right-s-line" : "ri-arrow-down-s-line"} />
                <span>{t(`veLane_${lane.id}`)}</span>
                {count > 0 && <em>{count}</em>}
              </button>
              {project.clips.filter((c) => c.lane === lane.id).map((c) => {
                const label = c.text || project.media[c.mediaId]?.name || c.type;
                const showWave = !isCollapsed && c.type === "audio" && getBlob;
                return (
                  <div
                    key={c.id}
                    className={`ve-clip ve-${c.type}${selected === c.id ? " is-sel" : ""}${showWave ? " has-wave" : ""}`}
                    style={{ left: LABEL_W + c.start * zoom, width: Math.max(6, c.dur * zoom), top: isCollapsed ? 3 : (track.get(c.id) || 0) * ROW_H + 4, height: isCollapsed ? COLLAPSED_H - 6 : ROW_H - 8 }}
                    onPointerDown={(e) => startClip(e, c, "move")}
                    title={label}
                  >
                    {showWave && <Wave clip={c} zoom={zoom} getBlob={getBlob} />}
                    <span className="ve-grip l" onPointerDown={(e) => startClip(e, c, "l")} />
                    {!isCollapsed && <span className="ve-clip-label">{label}</span>}
                    <span className="ve-grip r" onPointerDown={(e) => startClip(e, c, "r")} />
                  </div>
                );
              })}
            </div>
          );
        })}

        <div className="ve-playhead" style={{ left: LABEL_W + time * zoom }} aria-hidden="true"><i /></div>
      </div>
    </div>
  );
}
