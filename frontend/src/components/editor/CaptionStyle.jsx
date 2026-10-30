import { CAPTION_PRESETS, HL_TEMPLATES } from "../../lib/editor/model";
import { ColorStrips } from "./Strips";

// A tiny CSS preview of how a highlight template looks on its "active" word.
function Preview({ look }) {
  const mode = look.hlMode || "color";
  const base = { color: look.color || "#fff" };
  const hot = mode === "box" ? { background: look.hlBg || look.hl, color: look.hlText || "#111" }
    : mode === "underline" ? { color: base.color, boxShadow: `inset 0 -3px 0 ${look.hl}` }
    : mode === "pop" ? { color: look.hl, transform: "scale(1.22)", display: "inline-block" }
    : mode === "glow" ? { color: look.hl, textShadow: `0 0 8px ${look.hl}, 0 0 14px ${look.hl}` }
    : { color: look.hl };
  const first = mode === "fill" ? { color: look.hl } : base;
  return <span className="ve-tpl-prev"><span style={first}>Aa</span><span className="w" style={hot}>Hi</span><span style={base}>ខ្ញុំ</span></span>;
}

// Caption looks + spoken-word highlight templates (lives in the "Text" tab). Templates apply to EVERY caption.
export default function CaptionStyle({ t, busy, highlight, onHighlight, onTemplate, activeTemplate, onCaptionPreset }) {
  return (
    <>
    <section className="ve-sec">
      <h4>{t("veHighlightTitle")}</h4>
      <label className="ve-checks"><input type="checkbox" checked={highlight.on} onChange={(e) => onHighlight(e.target.checked, highlight.color)} /> {t("veHighlight")}</label>
      <div className="ve-tpl-grid" role="listbox" aria-label={t("veHlTemplates")}>
        {HL_TEMPLATES.map((tp) => (
          <button key={tp.id} type="button" role="option" aria-selected={activeTemplate === tp.id} className={"ve-tpl" + (activeTemplate === tp.id ? " on" : "")} onClick={() => onTemplate(tp)} disabled={busy}>
            <Preview look={tp.look} /><em>{t(tp.key)}</em>
          </button>
        ))}
      </div>
      <p className="tk-hint">{t("veHlAllHint")}</p>
      <ColorStrips value={highlight.color} onChange={(c) => onHighlight(true, c)} />
    </section>

    <section className="ve-sec">
      <h4>{t("veCaptionLooks")}</h4>
      <div className="ve-looks">
        {CAPTION_PRESETS.map((p) => (
          <button key={p.id} type="button" className="ve-look" onClick={() => onCaptionPreset(p)} disabled={busy}>
            <span style={{ color: p.style.color, background: p.style.bg, fontWeight: p.style.bold ? 700 : 400, textShadow: p.style.outline ? "0 0 2px #000, 0 0 2px #000" : "none" }}>Aa</span>
            <em>{t(p.key)}</em>
          </button>
        ))}
      </div>
    </section>
    </>
  );
}
