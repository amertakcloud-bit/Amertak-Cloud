import { useEffect, useRef, useState } from "react";
import ToolShell from "../../components/tools/ToolShell";
import { useLanguage } from "../../context/LanguageContext";
import { useFeedback } from "../../components/ui/Feedback";
import { toolsApi } from "../../services/toolsApi";
import { friendlyError } from "../../lib/errors";
import { formatClock } from "../../lib/download";

const ICON = { video: "ri-movie-2-line", audio: "ri-music-2-line", image: "ri-image-line" };

export default function VideoDownloader() {
  const { t } = useLanguage();
  const { toast } = useFeedback();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const abort = useRef(null);
  useEffect(() => () => abort.current?.abort(), []);

  async function paste() {
    try { setUrl((await navigator.clipboard.readText()).trim()); } catch { toast.info(t("pasteBlocked")); }
  }

  async function submit(e) {
    e.preventDefault();
    const link = url.trim();
    if (!link || busy) return;
    setBusy(true); setError(""); setInfo(null);
    abort.current = new AbortController();
    try {
      const res = await toolsApi.videoResolve(link, abort.current.signal);
      setInfo(res.data);
    } catch (err) {
      if (err.code !== "ABORTED") setError(friendlyError(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolShell icon="ri-video-download-line" titleKey="VideoDownloader" subKey="dVideoDownloader">
      <form className="tk-card" onSubmit={submit}>
        <div className="tk-label"><i className="ri-link" />{t("vdLink")}</div>
        <div className="tk-row" style={{ flexWrap: "nowrap" }}>
          <input className="tk-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.tiktok.com/@user/video/…" inputMode="url" autoComplete="off" />
          <button type="button" className="tk-btn ghost icon-only" onClick={paste} aria-label={t("paste")} style={{ flexShrink: 0 }}><i className="ri-clipboard-line" /></button>
        </div>
        <div className="tk-row">
          <button type="submit" className="tk-btn" disabled={!url.trim() || busy}><i className={busy ? "ri-loader-4-line spin" : "ri-search-line"} />{busy ? t("vdFetching") : t("vdFetch")}</button>
          <span className="tk-chip">TikTok</span><span className="tk-chip">Pinterest</span><span className="tk-chip">{t("vdDirect")}</span>
        </div>
        <div className="tk-hint">{t("vdNote")}</div>
      </form>

      {error && <div className="tk-alert err" role="alert"><i className="ri-error-warning-line" />{error}</div>}

      {info && (
        <div className="tk-card" data-aos="fade-up">
          <div className="tk-media">
            {info.thumbnail ? <img src={info.thumbnail} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <div className="thumb-ph"><i className="ri-movie-2-line" /></div>}
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: "1.05rem", wordBreak: "break-word" }}>{info.title}</h2>
              <p style={{ marginTop: 4 }}>{[info.author, info.duration ? formatClock(info.duration) : "", info.provider].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="tk-formats">
            {info.formats.map((f) => (
              <div className="tk-format" key={f.id}>
                <i className={ICON[f.kind] || "ri-file-line"} aria-hidden="true" />
                <div className="grow">{f.label} <span className="tk-chip">{f.ext.toUpperCase()}</span></div>
                <a className="tk-btn small" href={toolsApi.videoDownloadUrl(f.token)} download onClick={() => toast.success(t("vdStarted"))}><i className="ri-download-2-line" />{t("download")}</a>
              </div>
            ))}
          </div>
          <div className="tk-hint">{t("vdExpires")}</div>
        </div>
      )}
    </ToolShell>
  );
}
