import { useState } from "react";
import { VOICE_LIST, legacyVoice } from "../../lib/editor/ai";
import { DEFAULT_HIGHLIGHT, LANES } from "../../lib/editor/model";
import Select from "../ui/Select";

const BGS = [
  ["rgba(0,0,0,0)", "veBgNone"],
  ["rgba(0,0,0,0.55)", "veBgDark"],
  ["rgba(255,255,255,0.85)", "veBgLight"],
  ["rgba(220,36,100,0.85)", "veBgBrand"],
  ["rgba(250,204,21,0.9)", "veBgYellow"],
];
const FONT_KEYS = ["sans", "serif", "mono", "round", "display"];
export const SWATCHES = ["#ffffff", "#000000", "#facc15", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#3b82f6", "#22d3ee", "#22c55e"];

function Field({ label, children }) {
  return (
    <label className="ve-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Section({ title, children }) {
  return (
    <section className="ve-sec">
      <h4>{title}</h4>
      <div className="ve-sec-body">{children}</div>
    </section>
  );
}
function Range({ label, value, min, max, step, onChange, fmt = (v) => v }) {
  return (
    <Field label={<>{label} <b>{fmt(value)}</b></>}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  );
}
function ColorPick({ value, onChange }) {
  return (
    <div className="ve-colors">
      {SWATCHES.map((c) => (
        <button key={c} type="button" className={"ve-sw" + (value?.toLowerCase() === c ? " on" : "")} style={{ background: c }} onClick={() => onChange(c)} aria-label={c} />
      ))}
      <input type="color" className="ve-color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} aria-label="custom color" />
    </div>
  );
}

// A generated Khmer voice: change the sentence / speaker and make it again.
function VoiceSection({ clip, onRegenerate, busy, t }) {
  const [text, setText] = useState(clip.text || "");
  const [voice, setVoice] = useState(legacyVoice(clip.voice));
  return (
    <Section title={t("veVoiceTitle")}>
      <textarea className="tk-input" rows={3} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder={t("veVoiceText")} aria-label={t("veVoiceText")} />
      <Select value={voice} onChange={(e) => setVoice(e.target.value)} aria-label={t("veVoice")}>
        {VOICE_LIST.map((v) => <option key={v.value} value={v.value}>{v.value} · {t(v.gender === "f" ? "veFemale" : "veMale")}</option>)}
      </Select>
      <button type="button" className="tk-btn full" disabled={busy || !text.trim()} onClick={() => onRegenerate(clip, text, voice)}>
        <i className="ri-mic-line" />{t("veRegenerate")}
      </button>
      <p className="tk-hint">{t("veRegenerateHint")}</p>
    </Section>
  );
}

// Properties of the selected clip (transform, look, text, audio).
export default function Inspector({ clip, project, onChange, onApplyCaptionStyle, onRegenerate, busy, t }) {
  if (!clip) return <div className="ve-empty"><i className="ri-cursor-line" /><p>{t("veSelectClip")}</p></div>;
  const media = project.media[clip.mediaId];
  const isText = clip.type === "text" || clip.type === "caption";
  const isVisual = clip.type === "video" || clip.type === "image";
  const hasAudio = clip.type === "video" || clip.type === "audio";
  const st = clip.style || {};
  const num = (k, v) => onChange({ [k]: Number.isFinite(Number(v)) ? Number(v) : 0 });
  const style = (patch) => onChange({ style: { ...st, ...patch } });
  const laneOptions = LANES.filter((l) => l.types.includes(clip.type) && l.kind !== "text");
  const pct = (v) => `${Math.round(v * 100)}%`;

  return (
    <div className="ve-insp">
      <div className="ve-insp-title"><i className={isText ? "ri-text" : isVisual ? "ri-image-line" : "ri-music-2-line"} /> {isText ? t(`veType_${clip.type}`) : media?.name || clip.type}</div>

      {clip.lane === "voice" && clip.text != null && <VoiceSection key={clip.id + clip.mediaId} clip={clip} onRegenerate={onRegenerate} busy={busy} t={t} />}

      {isText && (
        <Section title={t("veText")}>
          <textarea className="tk-input" rows={3} value={clip.text || ""} onChange={(e) => onChange({ text: e.target.value })} />
        </Section>
      )}

      {isText && (
        <Section title={t("veTypography")}>
          <Field label={t("veFont")}>
            <Select value={st.font || "sans"} onChange={(e) => style({ font: e.target.value })}>
              {FONT_KEYS.map((k) => <option key={k} value={k}>{t(`veFont_${k}`)}</option>)}
            </Select>
          </Field>
          <Range label={t("veFontSize")} value={st.size ?? 6} min={2} max={20} step={0.2} onChange={(v) => style({ size: v })} />
          <Field label={t("veColor")}><ColorPick value={st.color} onChange={(c) => style({ color: c })} /></Field>
          <div className="tk-seg ve-seg" role="group" aria-label={t("veAlign")}>
            {[["left", "ri-align-left"], ["center", "ri-align-center"], ["right", "ri-align-right"]].map(([k, ic]) => (
              <button key={k} type="button" className={(st.align || "center") === k ? "active" : ""} onClick={() => style({ align: k })} aria-label={k}><i className={ic} /></button>
            ))}
            <button type="button" className={st.bold ? "active" : ""} onClick={() => style({ bold: !st.bold })} aria-label={t("veBold")}><i className="ri-bold" /></button>
            <button type="button" className={st.italic ? "active" : ""} onClick={() => style({ italic: !st.italic })} aria-label={t("veItalic")}><i className="ri-italic" /></button>
          </div>
          <Field label={t("veBackground")}>
            <Select value={st.bg ?? "rgba(0,0,0,0)"} onChange={(e) => style({ bg: e.target.value })}>
              {BGS.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
            </Select>
          </Field>
          <div className="ve-checks">
            <label><input type="checkbox" checked={Boolean(st.outline)} onChange={(e) => style({ outline: e.target.checked })} /> {t("veOutline")}</label>
            <label><input type="checkbox" checked={Boolean(st.shadow)} onChange={(e) => style({ shadow: e.target.checked })} /> {t("veShadow")}</label>
          </div>
          <div className="ve-checks">
            <label><input type="checkbox" checked={Boolean(st.karaoke)} onChange={(e) => style({ karaoke: e.target.checked, hl: st.hl || DEFAULT_HIGHLIGHT })} /> {t("veHighlight")}</label>
          </div>
          {st.karaoke && <Field label={t("veHighlightColor")}><ColorPick value={st.hl || DEFAULT_HIGHLIGHT} onChange={(c) => style({ hl: c })} /></Field>}
          {st.outline && <Field label={t("veOutlineColor")}><ColorPick value={st.outlineColor || "#000000"} onChange={(c) => style({ outlineColor: c })} /></Field>}
          {clip.type === "caption" && (
            <button type="button" className="tk-btn ghost small" onClick={() => onApplyCaptionStyle(clip)}>
              <i className="ri-brush-line" />{t("veApplyAll")}
            </button>
          )}
        </Section>
      )}

      {(isVisual || isText) && (
        <Section title={t("veTransform")}>
          <div className="ve-row2">
            <Range label={t("veX")} value={clip.x ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => num("x", v)} fmt={pct} />
            <Range label={t("veY")} value={clip.y ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => num("y", v)} fmt={pct} />
          </div>
          {isVisual && <Range label={t("veScale")} value={clip.scale ?? 1} min={0.1} max={3} step={0.05} onChange={(v) => num("scale", v)} fmt={pct} />}
          <Range label={t("veRotation")} value={clip.rotation ?? 0} min={-180} max={180} step={1} onChange={(v) => num("rotation", v)} fmt={(v) => `${v}°`} />
          <Range label={t("veOpacity")} value={clip.opacity ?? 1} min={0} max={1} step={0.05} onChange={(v) => num("opacity", v)} fmt={pct} />
          <div className="ve-row2">
            <button type="button" className={"tk-btn ghost small" + (clip.flipX ? " on" : "")} onClick={() => onChange({ flipX: !clip.flipX })}><i className="ri-flip-horizontal-line" />{t("veFlip")}</button>
            <button type="button" className="tk-btn ghost small" onClick={() => onChange({ x: 0.5, y: clip.type === "caption" ? 0.88 : 0.5, scale: 1, rotation: 0, opacity: 1, flipX: false })}><i className="ri-refresh-line" />{t("veReset")}</button>
          </div>
        </Section>
      )}

      {isVisual && (
        <Section title={t("veColorGrade")}>
          <Range label={t("veBrightness")} value={clip.brightness ?? 1} min={0.2} max={2} step={0.05} onChange={(v) => num("brightness", v)} fmt={pct} />
          <Range label={t("veContrast")} value={clip.contrast ?? 1} min={0.2} max={2} step={0.05} onChange={(v) => num("contrast", v)} fmt={pct} />
          <Range label={t("veSaturation")} value={clip.saturate ?? 1} min={0} max={3} step={0.05} onChange={(v) => num("saturate", v)} fmt={pct} />
        </Section>
      )}

      <Section title={t("veTiming")}>
        <div className="ve-row2">
          <Field label={t("veStart")}><input className="tk-input" type="number" min="0" step="0.1" value={Number(clip.start.toFixed(2))} onChange={(e) => num("start", Math.max(0, e.target.value))} /></Field>
          <Field label={t("veDuration")}><input className="tk-input" type="number" min="0.1" step="0.1" value={Number(clip.dur.toFixed(2))} onChange={(e) => num("dur", Math.max(0.1, e.target.value))} /></Field>
        </div>
        <div className="ve-row2">
          <Range label={t("veFadeIn")} value={clip.fadeIn ?? 0} min={0} max={Math.min(5, clip.dur / 2)} step={0.1} onChange={(v) => num("fadeIn", v)} fmt={(v) => `${v}s`} />
          <Range label={t("veFadeOut")} value={clip.fadeOut ?? 0} min={0} max={Math.min(5, clip.dur / 2)} step={0.1} onChange={(v) => num("fadeOut", v)} fmt={(v) => `${v}s`} />
        </div>
        {laneOptions.length > 1 && (
          <Field label={t("veLayer")}>
            <Select value={clip.lane} onChange={(e) => onChange({ lane: e.target.value })}>
              {laneOptions.map((l) => <option key={l.id} value={l.id}>{t(`veLane_${l.id}`)}</option>)}
            </Select>
          </Field>
        )}
      </Section>

      {hasAudio && (
        <Section title={t("veAudio")}>
          <Range label={t("veVolume")} value={clip.volume ?? 1} min={0} max={2} step={0.05} onChange={(v) => num("volume", v)} fmt={pct} />
        </Section>
      )}
    </div>
  );
}
