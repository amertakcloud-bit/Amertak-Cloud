import { useEffect, useRef, useState } from "react";
import { API_URL } from "../../services/api";
import { useFeedback } from "../../components/ui/Feedback";
import { useLanguage } from "../../context/LanguageContext";

const EXPIRY = [
  ["never", "csNever"],
  ["1h", "cs1h"],
  ["1d", "cs1d"],
  ["7d", "cs7d"],
];

const fmtSize = (b) =>
  b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

export default function CloudShare() {
  const { toast } = useFeedback();
  const { t } = useLanguage();
  const [cfg, setCfg] = useState({ available: true, maxFileSizeMB: 4 });
  const [file, setFile] = useState(null);
  const [expiresIn, setExpiresIn] = useState("never");
  const [view, setView] = useState("select"); // select | uploading | success | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef(null);
  const xhrRef = useRef(null);

  useEffect(() => {
    fetch(`${API_URL}/cloudshare/config`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => d?.config && setCfg((c) => ({ ...c, ...d.config })))
      .catch(() => {});
  }, []);

  const maxBytes = (cfg.maxFileSizeMB || 4) * 1024 * 1024;

  const pick = (f) => {
    if (!f) return;
    if (f.size > maxBytes) {
      toast.error(`${t("csTooLarge")} (${cfg.maxFileSizeMB} MB)`);
      return;
    }
    setFile(f);
    setError("");
  };

  const fail = (m) => {
    setError(m);
    setView("error");
    toast.error(m);
  };

  const upload = () => {
    if (!file) return toast.info(t("csChooseFile"));
    if (!cfg.available) return toast.error(t("csUnavailable"));
    const fd = new FormData();
    fd.append("file", file);
    fd.append("expiresIn", expiresIn);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", `${API_URL}/cloudshare/upload`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let p = {};
      try { p = JSON.parse(xhr.responseText || "{}"); } catch { /* handled below */ }
      if (xhr.status >= 200 && xhr.status < 300 && (p?.file?.downloadUrl || p?.file?.url)) {
        setLink(p.file.downloadUrl || p.file.url);
        setProgress(100);
        setView("success");
        return;
      }
      fail(xhr.status === 413 ? t("csTooLarge") : p?.error?.message || p?.message || t("csBadResponse"));
    };
    xhr.onerror = () => fail(t("err_NETWORK"));
    xhr.onabort = () => {};
    setProgress(0);
    setView("uploading");
    xhr.send(fd);
  };

  const reset = () => {
    xhrRef.current?.abort();
    setFile(null);
    setLink("");
    setProgress(0);
    setError("");
    setView("select");
    if (input.current) input.current.value = "";
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const el = document.getElementById("cs-link");
      el?.select();
      document.execCommand("copy");
    }
    toast.success(t("copied"));
  };

  return (
    <div className="page cs-page">
      <h1 className="page-heading" style={{ marginBottom: 8 }}>{t("csTitle")}</h1>
      <p className="page-subtitle" style={{ maxWidth: 620, marginBottom: 20 }}>{t("csSub")}</p>

      {!cfg.available && (
        <div className="tk-alert err" role="alert" style={{ marginBottom: 16 }}>
          <i className="ri-error-warning-line" /> {t("csUnavailable")}
        </div>
      )}

      <section className="cs-card" aria-live="polite">
        {view === "select" && (
          <div className="cs-step">
            <div
              className={`cs-drop${drag ? " is-drag" : ""}${file ? " has-file" : ""}`}
              onClick={() => input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer?.files?.[0]); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
            >
              <i className={file ? "ri-file-3-line" : "ri-upload-cloud-2-line"} aria-hidden="true" />
              {file ? (
                <>
                  <p className="cs-fname">{file.name}</p>
                  <p className="cs-muted">{fmtSize(file.size)}</p>
                  <button type="button" className="cs-link-btn" onClick={(e) => { e.stopPropagation(); setFile(null); if (input.current) input.current.value = ""; }}>
                    {t("csRemove")}
                  </button>
                </>
              ) : (
                <>
                  <p className="cs-title">{t("csDrop")}</p>
                  <p className="cs-muted">{t("csOr")}</p>
                  <span className="cs-btn cs-btn-ghost">{t("csBrowse")}</span>
                </>
              )}
            </div>
            <input ref={input} type="file" hidden aria-label={t("csBrowse")} onChange={(e) => pick(e.target.files?.[0])} />

            <div className="cs-row">
              <label htmlFor="cs-exp">{t("csExpires")}</label>
              <select id="cs-exp" value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)}>
                {EXPIRY.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
              </select>
            </div>
            <p className="cs-muted cs-note">{t("csMax")}: {cfg.maxFileSizeMB} MB</p>
            <button type="button" className="cs-btn cs-btn-primary cs-block" onClick={upload} disabled={!file || !cfg.available}>
              <i className="ri-upload-2-line" /> {t("csUpload")}
            </button>
          </div>
        )}

        {view === "uploading" && (
          <div className="cs-step">
            <p className="cs-title">{t("csUploading")}</p>
            <div className="cs-file"><i className="ri-file-3-line" /><div><p className="cs-fname">{file?.name}</p><p className="cs-muted">{file && fmtSize(file.size)}</p></div></div>
            <div className="cs-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}><div style={{ width: `${progress}%` }} /></div>
            <p className="cs-muted cs-center">{progress}%</p>
            <button type="button" className="cs-btn cs-btn-ghost cs-block" onClick={reset}>{t("csCancel")}</button>
          </div>
        )}

        {view === "success" && (
          <div className="cs-step">
            <p className="cs-title cs-ok"><i className="ri-checkbox-circle-fill" /> {t("csDone")}</p>
            <div className="cs-file"><i className="ri-file-3-line" /><div><p className="cs-fname">{file?.name}</p><p className="cs-muted">{file && fmtSize(file.size)}</p></div></div>
            <label className="cs-muted" htmlFor="cs-link">{t("csYourLink")}</label>
            <input id="cs-link" className="cs-input" readOnly value={link} onFocus={(e) => e.target.select()} />
            <div className="cs-actions">
              <button type="button" className="cs-btn cs-btn-primary" onClick={copy}><i className="ri-file-copy-line" /> {t("csCopy")}</button>
              <a className="cs-btn cs-btn-ghost" href={link} target="_blank" rel="noopener noreferrer"><i className="ri-external-link-line" /> {t("csOpen")}</a>
            </div>
            <button type="button" className="cs-link-btn" onClick={reset}>{t("csAnother")}</button>
          </div>
        )}

        {view === "error" && (
          <div className="cs-step" role="alert">
            <p className="cs-title cs-bad"><i className="ri-error-warning-fill" /> {t("csFailed")}</p>
            <p className="cs-muted">{error}</p>
            <button type="button" className="cs-btn cs-btn-primary cs-block" onClick={() => setView("select")}>{t("csRetry")}</button>
          </div>
        )}
      </section>
    </div>
  );
}
