import { useEffect, useRef, useState } from "react";
import ToolShell from "../../components/tools/ToolShell";
import Dropzone from "../../components/tools/Dropzone";
import GeminiKeyPanel, { useGeminiAccess } from "../../components/tools/GeminiKey";
import { useLanguage } from "../../context/LanguageContext";
import { useFeedback } from "../../components/ui/Feedback";
import useToolsStatus from "../../hooks/useToolsStatus";
import { toolsApi } from "../../services/toolsApi";
import { friendlyError } from "../../lib/errors";
import { shrinkImage } from "../../lib/image";

const STYLES = [
  { id: "detailed", key: "ipDetailed" },
  { id: "midjourney", key: "ipMidjourney" },
  { id: "stable_diffusion", key: "ipSd" },
  { id: "short", key: "ipShort" },
];

export default function ImageToPrompt() {
  const { t, language } = useLanguage();
  const { toast } = useFeedback();
  const { data: status } = useToolsStatus();
  const access = useGeminiAccess(status);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [style, setStyle] = useState("detailed");
  const [lang, setLang] = useState(language === "km" ? "km" : "en");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const abort = useRef(null);

  useEffect(() => {
    if (!file) { setPreview(""); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => () => abort.current?.abort(), []);

  function pick(f) {
    if (!/^image\/(png|jpeg|webp|heic|heif)$/.test(f.type)) { toast.error(t("ipBadType")); return; }
    setFile(f); setResult(null); setError("");
  }

  async function run() {
    if (!file || busy) return;
    if (!access.ready) { toast.info(t("keyRequired")); return; }
    setBusy(true); setError(""); setResult(null);
    abort.current = new AbortController();
    try {
      const small = await shrinkImage(file);
      const res = await toolsApi.imagePrompt(small, { style, language: lang }, abort.current.signal);
      setResult(res.data);
      toast.success(t("ipDone"));
    } catch (e) {
      if (e.code !== "ABORTED") { const m = friendlyError(e, t); setError(m); toast.error(m); }
    } finally {
      setBusy(false);
    }
  }

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast.success(t("copied")); } catch { toast.error(t("copyFailed")); }
  };

  return (
    <ToolShell icon="ri-image-ai-line" titleKey="ImageToPrompt" subKey="ipSub">
      <GeminiKeyPanel status={status} access={access} />
      <div className="tk-grid-2">
        <div className="tk-card">
          <Dropzone accept="image/png,image/jpeg,image/webp,image/heic,image/heif" icon="ri-image-add-line" hintKey="ipDropHint" file={file} onFile={pick} onClear={() => { setFile(null); setResult(null); }} disabled={busy} />
          {preview && <div className="tk-preview" style={{ minHeight: 0 }}><img src={preview} alt={t("ipPreviewAlt")} /></div>}
          <div>
            <div className="tk-label"><i className="ri-magic-line" />{t("ipStyle")}</div>
            <div className="tk-seg" role="radiogroup">
              {STYLES.map((s) => <button key={s.id} type="button" role="radio" aria-checked={style === s.id} className={style === s.id ? "active" : ""} onClick={() => setStyle(s.id)}>{t(s.key)}</button>)}
            </div>
          </div>
          <div>
            <div className="tk-label"><i className="ri-translate-2" />{t("language")}</div>
            <div className="tk-seg">
              <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>English</button>
              <button type="button" className={lang === "km" ? "active" : ""} onClick={() => setLang("km")}>ខ្មែរ</button>
            </div>
          </div>
          <button type="button" className="tk-btn full" disabled={!file || busy || !access.ready} onClick={run}>
            <i className={busy ? "ri-loader-4-line spin" : "ri-sparkling-2-line"} />{busy ? t("ipWorking") : t("ipGenerate")}
          </button>
        </div>

        <div className="tk-card" aria-live="polite">
          {result ? (
            <>
              {result.title && <h2 style={{ fontSize: "1.1rem" }} className="reflect">{result.title}</h2>}
              <div>
                <div className="tk-row spread"><div className="tk-label">{t("ipPrompt")}</div>
                  <button type="button" className="tk-btn ghost small" onClick={() => copy(result.prompt)}><i className="ri-file-copy-line" />{t("copy")}</button></div>
                <div className="tk-result-text">{result.prompt}</div>
              </div>
              {result.negativePrompt && (
                <div>
                  <div className="tk-row spread"><div className="tk-label">{t("ipNegative")}</div>
                    <button type="button" className="tk-btn ghost small" onClick={() => copy(result.negativePrompt)}><i className="ri-file-copy-line" />{t("copy")}</button></div>
                  <div className="tk-result-text">{result.negativePrompt}</div>
                </div>
              )}
              {result.tags?.length > 0 && <div className="tk-tags">{result.tags.map((x) => <span key={x} className="tk-chip">{x}</span>)}</div>}
              <div className="tk-hint">{t("ipModel")}: {result.model}</div>
            </>
          ) : error ? (
            <div className="tk-alert err" role="alert"><i className="ri-error-warning-line" />{error}</div>
          ) : (
            <div className="tk-empty" style={{ minHeight: 220 }}><i className="ri-image-ai-line" />{busy ? t("ipWorking") : t("ipEmpty")}</div>
          )}
        </div>
      </div>
    </ToolShell>
  );
}
