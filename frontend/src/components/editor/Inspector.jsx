import { LANES } from "../../lib/editor/model";

const BGS = [
  ["rgba(0,0,0,0)", "veBgNone"],
  ["rgba(0,0,0,0.55)", "veBgDark"],
  ["rgba(255,255,255,0.85)", "veBgLight"],
  ["rgba(220,36,100,0.85)", "veBgBrand"],
];

function Field({ label, children }) {
  return (
    <label className="ve-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

// Properties of the selected clip.
export default function Inspector({ clip, project, onChange, onApplyCaptionStyle, t }) {
  if (!clip) return <p className="tk-hint">{t("veSelectClip")}</p>;
  const media = project.media[clip.mediaId];
  const isText = clip.type === "text" || clip.type === "caption";
  const isVisual = clip.type === "video" || clip.type === "image";
  const hasAudio = clip.type === "video" || clip.type === "audio";
  const st = clip.style || {};
  const num = (k, v) => onChange({ [k]: Number.isFinite(Number(v)) ? Number(v) : 0 });
  const style = (patch) => onChange({ style: { ...st, ...patch } });
  const laneOptions = LANES.filter((l) => l.types.includes(clip.type) && l.kind !== "text");

  return (
    <div className="ve-insp">
      <div className="ve-insp-title">{isText ? t(`veType_${clip.type}`) : media?.name || clip.type}</div>

      {isText && (
        <Field label={t("veText")}>
          <textarea className="tk-input" rows={3} value={clip.text || ""} onChange={(e) => onChange({ text: e.target.value })} />
        </Field>
      )}

      <div className="ve-row2">
        <Field label={t("veStart")}>
          <input className="tk-input" type="number" min="0" step="0.1" value={Number(clip.start.toFixed(2))} onChange={(e) => num("start", Math.max(0, e.target.value))} />
        </Field>
        <Field label={t("veDuration")}>
          <input className="tk-input" type="number" min="0.1" step="0.1" value={Number(clip.dur.toFixed(2))} onChange={(e) => num("dur", Math.max(0.1, e.target.value))} />
        </Field>
      </div>

      {laneOptions.length > 1 && (
        <Field label={t("veLayer")}>
          <select className="tk-input" value={clip.lane} onChange={(e) => onChange({ lane: e.target.value })}>
            {laneOptions.map((l) => <option key={l.id} value={l.id}>{t(`veLane_${l.id}`)}</option>)}
          </select>
        </Field>
      )}

      {hasAudio && (
        <Field label={`${t("veVolume")} ${Math.round((clip.volume ?? 1) * 100)}%`}>
          <input type="range" min="0" max="2" step="0.05" value={clip.volume ?? 1} onChange={(e) => num("volume", e.target.value)} />
        </Field>
      )}

      {(isVisual || isText) && (
        <>
          <Field label={`${t("veX")} ${Math.round((clip.x ?? 0.5) * 100)}%`}>
            <input type="range" min="0" max="1" step="0.01" value={clip.x ?? 0.5} onChange={(e) => num("x", e.target.value)} />
          </Field>
          <Field label={`${t("veY")} ${Math.round((clip.y ?? 0.5) * 100)}%`}>
            <input type="range" min="0" max="1" step="0.01" value={clip.y ?? 0.5} onChange={(e) => num("y", e.target.value)} />
          </Field>
        </>
      )}

      {isVisual && (
        <>
          <Field label={`${t("veScale")} ${Math.round((clip.scale ?? 1) * 100)}%`}>
            <input type="range" min="0.1" max="3" step="0.05" value={clip.scale ?? 1} onChange={(e) => num("scale", e.target.value)} />
          </Field>
          <Field label={`${t("veOpacity")} ${Math.round((clip.opacity ?? 1) * 100)}%`}>
            <input type="range" min="0" max="1" step="0.05" value={clip.opacity ?? 1} onChange={(e) => num("opacity", e.target.value)} />
          </Field>
        </>
      )}

      {isText && (
        <>
          <Field label={`${t("veFontSize")} ${st.size ?? 6}`}>
            <input type="range" min="2" max="20" step="0.2" value={st.size ?? 6} onChange={(e) => style({ size: Number(e.target.value) })} />
          </Field>
          <div className="ve-row2">
            <Field label={t("veColor")}>
              <input type="color" className="ve-color" value={/^#[0-9a-f]{6}$/i.test(st.color) ? st.color : "#ffffff"} onChange={(e) => style({ color: e.target.value })} />
            </Field>
            <Field label={t("veBackground")}>
              <select className="tk-input" value={st.bg ?? "rgba(0,0,0,0)"} onChange={(e) => style({ bg: e.target.value })}>
                {BGS.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
              </select>
            </Field>
          </div>
          <div className="ve-checks">
            <label><input type="checkbox" checked={Boolean(st.bold)} onChange={(e) => style({ bold: e.target.checked })} /> {t("veBold")}</label>
            <label><input type="checkbox" checked={Boolean(st.outline)} onChange={(e) => style({ outline: e.target.checked })} /> {t("veOutline")}</label>
          </div>
          {clip.type === "caption" && (
            <button type="button" className="tk-btn ghost small" onClick={() => onApplyCaptionStyle(clip)}>
              <i className="ri-brush-line" />{t("veApplyAll")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
