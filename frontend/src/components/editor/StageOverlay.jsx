import { useRef, useState } from "react";
import { clamp, hitTest, updateClip } from "../../lib/editor/model";

// Transparent layer above the preview canvas: click an element to select it, drag to move,
// corner handles to resize, top handle to rotate, double-click text to edit it in place.
export default function StageOverlay({ engine, project, time, selected, onSelect, onPreview, onCommit, t }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [editing, setEditing] = useState(null);
  const W = project.width, H = project.height;

  const toProject = (e) => {
    const r = ref.current.getBoundingClientRect();
    return { px: ((e.clientX - r.left) / r.width) * W, py: ((e.clientY - r.top) / r.height) * H };
  };
  const sel = project.clips.find((c) => c.id === selected);
  const active = sel && time >= sel.start - 1e-6 && time < sel.start + sel.dur - 1e-6;
  const box = active ? engine.current?.boxOf(sel) : null;
  const isText = sel && (sel.type === "text" || sel.type === "caption");

  function begin(e, mode) {
    if (!sel || !box) return;
    e.stopPropagation(); e.preventDefault();
    ref.current.setPointerCapture?.(e.pointerId);
    const { px, py } = toProject(e);
    drag.current = { mode, id: sel.id, base: project, p0: { px, py }, c0: { ...sel }, box, d0: Math.max(8, Math.hypot(px - box.cx, py - box.cy)), moved: false };
  }

  function down(e) {
    if (editing) return;
    const { px, py } = toProject(e);
    const hit = hitTest(engine.current?.boxesAt() || [], px, py);
    onSelect(hit ? hit.id : null);
    if (!hit) return;
    ref.current.setPointerCapture?.(e.pointerId);
    drag.current = { mode: "move", id: hit.id, base: project, p0: { px, py }, c0: { ...hit }, box: null, moved: false };
  }

  function move(e) {
    const d = drag.current;
    if (!d) return;
    const { px, py } = toProject(e);
    let patch = null;
    if (d.mode === "move") {
      if (!d.moved && Math.hypot(px - d.p0.px, py - d.p0.py) < 3) return;
      let x = (d.c0.x ?? 0.5) + (px - d.p0.px) / W, y = (d.c0.y ?? 0.5) + (py - d.p0.py) / H;
      if (Math.abs(x - 0.5) < 0.012) x = 0.5; // snap to the frame centre
      if (Math.abs(y - 0.5) < 0.012) y = 0.5;
      patch = { x: clamp(x, -0.2, 1.2), y: clamp(y, -0.2, 1.2) };
    } else if (d.mode === "scale") {
      const k = Math.hypot(px - d.box.cx, py - d.box.cy) / d.d0;
      if (d.c0.type === "text" || d.c0.type === "caption") patch = { style: { ...d.c0.style, size: clamp((d.c0.style?.size ?? 6) * k, 1.5, 25) } };
      else patch = { scale: clamp((d.c0.scale ?? 1) * k, 0.05, 5) };
    } else if (d.mode === "rotate") {
      let a = (Math.atan2(py - d.box.cy, px - d.box.cx) * 180) / Math.PI + 90;
      if (a > 180) a -= 360;
      if (e.shiftKey || Math.abs(a % 90) < 3) a = Math.round(a / 15) * 15;
      patch = { rotation: Math.round(a * 10) / 10 };
    }
    if (patch) { d.moved = true; onPreview(updateClip(d.base, d.id, patch)); }
  }

  function up(e) {
    const d = drag.current;
    drag.current = null;
    ref.current?.releasePointerCapture?.(e.pointerId);
    if (d?.moved) onCommit();
  }

  function dbl(e) {
    const { px, py } = toProject(e);
    const hit = hitTest(engine.current?.boxesAt() || [], px, py);
    if (hit && (hit.type === "text" || hit.type === "caption")) { onSelect(hit.id); setEditing(hit.id); }
  }

  const pct = (v, total) => `${(v / total) * 100}%`;
  const boxStyle = box && {
    left: pct(box.cx - box.w / 2, W), top: pct(box.cy - box.h / 2, H), width: pct(box.w, W), height: pct(box.h, H),
    transform: `rotate(${box.rot || 0}deg)`,
  };
  const editClip = editing ? project.clips.find((c) => c.id === editing) : null;
  const editBox = editClip ? engine.current?.boxOf(editClip) : null;

  return (
    <div ref={ref} className="ve-ov" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={dbl}>
      {box && !editing && (
        <div className="ve-box" style={boxStyle}>
          {["nw", "ne", "se", "sw"].map((h) => (
            <span key={h} className={`ve-h ${h}`} onPointerDown={(e) => begin(e, "scale")} aria-label={t("veResize")} />
          ))}
          <span className="ve-rotate" onPointerDown={(e) => begin(e, "rotate")} aria-label={t("veRotate")}><i className="ri-refresh-line" /></span>
          {isText && <span className="ve-box-hint">{t("veDblEdit")}</span>}
        </div>
      )}
      {editClip && editBox && (
        <textarea
          className="ve-inline" autoFocus value={editClip.text || ""}
          style={{
            left: pct(editBox.cx, W), top: pct(editBox.cy, H), minWidth: pct(editBox.w, W), transform: `translate(-50%,-50%) rotate(${editBox.rot || 0}deg)`,
            fontSize: `calc(${((editClip.style?.size || 6) / 100) * 100}cqh)`, color: editClip.style?.color || "#fff", textAlign: editClip.style?.align || "center",
            fontWeight: editClip.style?.bold ? 700 : 400, fontStyle: editClip.style?.italic ? "italic" : "normal",
          }}
          onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
          onChange={(e) => onPreview(updateClip(project, editClip.id, { text: e.target.value }))}
          onBlur={() => { onCommit(); setEditing(null); }}
          onKeyDown={(e) => { if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) e.currentTarget.blur(); e.stopPropagation(); }}
        />
      )}
    </div>
  );
}
