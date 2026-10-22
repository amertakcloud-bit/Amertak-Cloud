import { useRef, useState } from "react";
import Select from "../ui/Select";
import GeminiKeyPanel from "../tools/GeminiKey";
import { CAPTION_PRESETS } from "../../lib/editor/model";

const SUGGESTIONS = ["veAiEx1", "veAiEx2", "veAiEx3", "veAiEx4"];

// "AI editor": describe an edit in plain words → the AI returns safe edit operations → applied to the timeline.
// Also holds the one-click AI tools (captions, translate-to-Khmer voice, remove silence, caption looks).
export default function AiPanel({
  t, user, status, access, busy, aiBusy, history, onPrompt, cost, source, sourceClips, setAiSource, aiCost,
  onGenerateCaptions, onTranslate, onRemoveSilence, onCaptionPreset, lang, setLang, voice, setVoice, orig, setOrig, project, balance,
}) {
  const [text, setText] = useState("");
  const box = useRef(null);
  const send = () => {
    const v = text.trim();
    if (!v || aiBusy) return;
    setText("");
    onPrompt(v);
  };
  return (
    <div className="ve-ai">
      <GeminiKeyPanel status={status} access={access} />

      <section className="ve-sec ve-ai-chat">
        <h4><i className="ri-sparkling-2-fill" /> {t("veAiEditor")}</h4>
        <p className="tk-hint">{t("veAiEditorHint")}</p>
        <div className="ve-ai-log" aria-live="polite">
          {history.length === 0 && (
            <div className="ve-chips">
              {SUGGESTIONS.map((k) => <button key={k} type="button" className="ve-chip" onClick={() => { setText(t(k)); box.current?.focus(); }}>{t(k)}</button>)}
            </div>
          )}
          {history.map((m, i) => <div key={i} className={`ve-msg ${m.role}`}>{m.text}</div>)}
          {aiBusy && <div className="ve-msg ai"><i className="ri-loader-4-line spin" /> {t("veAiThinking")}</div>}
        </div>
        <div className="ve-ai-input">
          <textarea ref={box} className="tk-input" rows={2} maxLength={600} value={text} placeholder={t("veAiPlaceholder")}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button type="button" className="tk-btn" disabled={!text.trim() || aiBusy || busy || project.clips.length === 0} onClick={send}>
            <i className="ri-send-plane-2-fill" />{t("veAiSend")}
          </button>
        </div>
        <div className="tk-hint"><i className="ri-coin-line" /> {t("tokCost")}: <b>{aiCost}</b> {t("tokUnit")} · {t("tokBalance")}: <b>{balance}</b></div>
      </section>

      <section className="ve-sec">
        <h4>{t("veQuickTools")}</h4>
        <label className="ve-field"><span>{t("veAiSource")}</span>
          <Select value={source?.id || ""} onChange={(e) => setAiSource(e.target.value)} disabled={!sourceClips.length}>
            {sourceClips.length === 0 && <option value="">{t("veNeedSource")}</option>}
            {sourceClips.map((c) => <option key={c.id} value={c.id}>{project.media[c.mediaId]?.name || c.type}</option>)}
          </Select>
        </label>
        <div className="tk-hint"><i className="ri-coin-line" /> {t("veCaptionCost")}: <b>{source ? cost : "—"}</b> {t("tokUnit")}</div>
        <button type="button" className="tk-btn full" disabled={busy || !source} onClick={onGenerateCaptions}><i className="ri-closed-captioning-line" />{t("veGenCaptions")}</button>
        <button type="button" className="tk-btn ghost full" disabled={busy || !source} onClick={onRemoveSilence}><i className="ri-scissors-cut-line" />{t("veRemoveSilence")} <small>({t("free")})</small></button>
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

      <section className="ve-sec">
        <h4>{t("veTranslateTitle")}</h4>
        <p className="tk-hint">{t("veTranslateHint")}</p>
        <label className="ve-field"><span>{t("veFrom")}</span>
          <Select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="auto">{t("veLangAuto")}</option><option value="zh">中文 (Chinese)</option><option value="en">English</option>
          </Select>
        </label>
        <div className="ve-field"><span>{t("veVoice")}</span>
          <div className="tk-seg">
            <button type="button" className={voice === "km-KH-PisethNeural" ? "active" : ""} onClick={() => setVoice("km-KH-PisethNeural")}>Piseth</button>
            <button type="button" className={voice === "km-KH-SreymomNeural" ? "active" : ""} onClick={() => setVoice("km-KH-SreymomNeural")}>Sreymom</button>
          </div>
        </div>
        <label className="ve-field"><span>{t("veOriginalAudio")}</span>
          <Select value={orig} onChange={(e) => setOrig(e.target.value)}>
            <option value="duck">{t("veOrigDuck")}</option><option value="mute">{t("veOrigMute")}</option><option value="keep">{t("veOrigKeep")}</option>
          </Select>
        </label>
        <button type="button" className="tk-btn full" disabled={busy || !source} onClick={onTranslate}><i className="ri-translate-2" />{t("veTranslateBtn")}</button>
      </section>
      {!user && <p className="tk-hint">{t("tokLogin")}</p>}
    </div>
  );
}
