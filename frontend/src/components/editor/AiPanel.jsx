import { useRef, useState } from "react";
import Select from "../ui/Select";
import { VOICE_LIST } from "../../lib/editor/ai";
import GeminiKeyPanel from "../tools/GeminiKey";

const SUGGESTIONS = ["veAiEx1", "veAiEx2", "veAiEx3", "veAiEx4"];

// "AI editor": describe an edit in plain words → the AI returns safe edit operations → applied to the timeline.
// Only AI lives here: the chat, AI captions and translate-to-Khmer voice. Media tools are in "Media", caption looks in "Text".
export default function AiPanel({
  t, user, status, access, busy, aiBusy, history, onPrompt, cost, source, sourceClips, setAiSource, aiCost,
  onGenerateCaptions, onGenerateKhmerCaptions, onExtractAudio, highlight, onHighlight, onTranslate, onRemoveSilence, onCaptionPreset, lang, setLang, voice, setVoice, orig, setOrig, project, balance,
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
        <button type="button" className="tk-btn full" disabled={busy || !source} onClick={onGenerateKhmerCaptions}><i className="ri-translate-2" />{t("veGenCaptionsKm")}</button>
        <p className="tk-hint">{t("veGenCaptionsKmHint")}</p>
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
          {voice === "auto" && <small className="tk-hint">{t("veVoiceAutoHint")}</small>}
          <Select value={voice} onChange={(e) => setVoice(e.target.value)}>
            <option value="auto">{t("veVoiceAuto")}</option>
            {VOICE_LIST.map((v) => <option key={v.value} value={v.value}>{v.value} · {t(v.gender === "f" ? "veFemale" : "veMale")}</option>)}
          </Select>
        </div>
        <label className="ve-field"><span>{t("veOriginalAudio")}</span>
          <Select value={orig} onChange={(e) => setOrig(e.target.value)}>
            <option value="duck">{t("veOrigDuck")}</option><option value="mute">{t("veOrigMute")}</option><option value="keep">{t("veOrigKeep")}</option>
          </Select>
        </label>
        <p className="tk-hint"><i className="ri-coin-line" /> {t("veVoiceCost")}</p>
        <button type="button" className="tk-btn full" disabled={busy || !source} onClick={onTranslate}><i className="ri-translate-2" />{t("veTranslateBtn")}</button>
      </section>
      {!user && <p className="tk-hint">{t("tokLogin")}</p>}
    </div>
  );
}
