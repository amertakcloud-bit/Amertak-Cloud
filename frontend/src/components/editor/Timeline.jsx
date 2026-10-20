import { useEffect, useRef } from "react";
import { LANES, clipEnd, moveClip, projectDuration, snap, trimEnd, trimStart } from "../../lib/editor/model";

const LANE_H = 42;
const LABEL_W = 74;

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Timeline: ruler + lanes + draggable/trimmable clips + playhead. Pointer events → works with touch.
export default function Timeline({ project, time, zoom, selected, onSelect, onSeek, onPreview, onCommit, t }) {
  const scroller = useRef(null);
  const drag = useRef(null);
  const dur = Math.max(projectDuration(project) + 10, 30);
  const width = Math.ceil(dur * zoom);

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
      <div className="ve-tl-inner" style={{ width: width + LABEL_W, height: 26 + LANES.length * LANE_H }}>
        <div className="ve-ruler" onPointerDown={startScrub} style={{ paddingLeft: LABEL_W }}>
          {ticks.map((s) => (
            <span key={s} className="ve-tick" style={{ left: LABEL_W + s * zoom }}>{fmt(s)}</span>
          ))}
        </div>

        {LANES.map((lane, i) => (
          <div key={lane.id} className="ve-lane" style={{ top: 26 + i * LANE_H, height: LANE_H }} onPointerDown={startScrub}>
            <div className="ve-lane-label">{t(`veLane_${lane.id}`)}</div>
            {project.clips.filter((c) => c.lane === lane.id).map((c) => (
              <div
                key={c.id}
                className={`ve-clip ve-${c.type}${selected === c.id ? " is-sel" : ""}`}
                style={{ left: LABEL_W + c.start * zoom, width: Math.max(6, c.dur * zoom) }}
                onPointerDown={(e) => startClip(e, c, "move")}
                title={c.text || project.media[c.mediaId]?.name || ""}
              >
                <span className="ve-grip l" onPointerDown={(e) => startClip(e, c, "l")} />
                <span className="ve-clip-label">{c.text || project.media[c.mediaId]?.name || c.type}</span>
                <span className="ve-grip r" onPointerDown={(e) => startClip(e, c, "r")} />
              </div>
            ))}
          </div>
        ))}

        <div className="ve-playhead" style={{ left: LABEL_W + time * zoom }} aria-hidden="true"><i /></div>
      </div>
    </div>
  );
}
