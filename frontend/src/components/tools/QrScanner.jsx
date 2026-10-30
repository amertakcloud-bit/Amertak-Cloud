import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";

// Decodes a QR from an ImageBitmap/canvas: native BarcodeDetector when present, otherwise the jsQR library (loaded on demand).
async function decode(source, w, h) {
  if ("BarcodeDetector" in window) {
    try {
      const r = await new window.BarcodeDetector({ formats: ["qr_code"] }).detect(source);
      if (r[0]?.rawValue) return r[0].rawValue;
    } catch { /* fall through to jsQR */ }
  }
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  const { default: jsQR } = await import("jsqr");
  const d = ctx.getImageData(0, 0, w, h);
  return jsQR(d.data, w, h, { inversionAttempts: "attemptBoth" })?.data || "";
}

export default function QrScanner() {
  const { t } = useLanguage();
  const video = useRef(null), stream = useRef(null), timer = useRef(0);
  const [on, setOn] = useState(false);
  const [result, setResult] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    stream.current?.getTracks().forEach((x) => x.stop());
    stream.current = null;
    setOn(false);
  }, []);
  useEffect(() => stop, [stop]);

  async function start() {
    setErr(""); setResult("");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setOn(true);
      await new Promise((r) => setTimeout(r, 0));
      const v = video.current;
      v.srcObject = stream.current;
      await v.play();
      const tick = async () => {
        if (!stream.current) return;
        if (v.videoWidth) {
          const text = await decode(v, v.videoWidth, v.videoHeight).catch(() => "");
          if (text) { setResult(text); stop(); return; }
        }
        timer.current = setTimeout(tick, 250);
      };
      tick();
    } catch { stop(); setErr(t("qrScanCamErr")); }
  }

  async function fromFile(file) {
    if (!file) return;
    setErr(""); setResult("");
    try {
      const bmp = await createImageBitmap(file);
      const text = await decode(bmp, bmp.width, bmp.height);
      if (text) setResult(text); else setErr(t("qrScanNone"));
    } catch { setErr(t("qrScanNone")); }
  }

  const isUrl = /^https?:\/\//i.test(result);
  return (
    <div className="tk-card qr-scan">
      <h3 className="tk-label"><i className="ri-qr-scan-2-line" />{t("qrScanTitle")}</h3>
      {on && <video ref={video} className="qr-video" muted playsInline />}
      <div className="tk-row">
        {on
          ? <button type="button" className="tk-btn" onClick={stop}><i className="ri-stop-circle-line" />{t("qrScanStop")}</button>
          : <button type="button" className="tk-btn" onClick={start}><i className="ri-camera-line" />{t("qrScanCam")}</button>}
        <label className="tk-btn ghost" style={{ cursor: "pointer" }}>
          <i className="ri-image-line" />{t("qrScanImg")}
          <input type="file" accept="image/*" hidden onChange={(e) => { fromFile(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      {err && <div className="tk-alert err" role="alert"><i className="ri-error-warning-line" />{err}</div>}
      {result && (
        <div className="qr-result" aria-live="polite">
          <textarea className="tk-textarea" readOnly value={result} />
          <div className="tk-row">
            <button type="button" className="tk-btn ghost" onClick={() => navigator.clipboard?.writeText(result).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}><i className={copied ? "ri-check-line" : "ri-file-copy-line"} />{t("copy")}</button>
            {isUrl && <a className="tk-btn ghost" href={result} target="_blank" rel="noopener noreferrer"><i className="ri-external-link-line" />{t("qrImgOpen")}</a>}
          </div>
        </div>
      )}
    </div>
  );
}
