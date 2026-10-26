import { CAPTION_PRESETS } from "../../lib/editor/model";
import { SWATCHES } from "./Inspector";

// Caption looks + spoken-word highlight colour (lives in the "Text" tab).
export default function CaptionStyle({ t, busy, highlight, onHighlight, onCaptionPreset }) {
  return (
    <>
    <section className="ve-sec">
      <h4>{t("veHighlightTitle")}</h4>
      <label className="ve-checks"><input type="checkbox" checked={highlight.on} onChange={(e) => onHighlight(e.target.checked, highlight.color)} /> {t("veHighlight")}</label>
      <div className="ve-colors" role="group" aria-label={t("veHighlightColor")}>
        {SWATCHES.map((c) => (
          <button key={c} type="button" className={"ve-sw" + (highlight.color.toLowerCase() === c ? " on" : "")} style={{ background: c }} aria-label={c} onClick={() => onHighlight(true, c)} />
        ))}
        <input type="color" className="ve-color" value={/^#[0-9a-f]{6}$/i.test(highlight.color) ? highlight.color : "#facc15"} onChange={(e) => onHighlight(true, e.target.value)} aria-label={t("veHighlightColor")} />
      </div>
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
