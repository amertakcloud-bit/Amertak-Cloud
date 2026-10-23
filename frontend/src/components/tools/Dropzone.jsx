import { useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { formatBytes } from "../../lib/download";

// Drag & drop / click-to-choose file picker.
export default function Dropzone({ accept, onFile, file, onClear, icon = "ri-upload-cloud-2-line", hintKey = "dropHint", disabled, maxBytes, onReject }) {
  const { t } = useLanguage();
  const input = useRef(null);
  const [over, setOver] = useState(false);

  const take = (f) => {
    if (!f) return;
    if (maxBytes && f.size > maxBytes) return onReject?.("TOO_LARGE", f);
    onFile(f);
  };

  if (file) {
    return (
      <div className="tk-file">
        <i className={icon.includes("image") ? "ri-image-line" : "ri-file-music-line"} aria-hidden="true" />
        <div className="meta">
          <div className="name" title={file.name}>{file.name}</div>
          <div className="sub">{formatBytes(file.size)}</div>
        </div>
        <button type="button" className="tk-btn ghost icon-only" onClick={onClear} disabled={disabled} aria-label={t("remove")}>
          <i className="ri-close-line" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`tk-drop${over ? " over" : ""}`}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), !disabled && input.current?.click())}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) take(e.dataTransfer.files?.[0]); }}
    >
      <i className={icon} aria-hidden="true" />
      <strong>{t("dropTitle")}</strong>
      <span className="tk-hint">{t(hintKey)}</span>
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
