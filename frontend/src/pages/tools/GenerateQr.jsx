import { useEffect, useMemo, useRef, useState } from "react";
import ToolShell from "../../components/tools/ToolShell";
import { useLanguage } from "../../context/LanguageContext";
import { useFeedback } from "../../components/ui/Feedback";
import { toolsApi } from "../../services/toolsApi";
import { friendlyError } from "../../lib/errors";
import { saveBlob } from "../../lib/download";

const TYPES = [
  { id: "url", icon: "ri-link", key: "qrUrl" },
  { id: "text", icon: "ri-text", key: "qrText" },
  { id: "wifi", icon: "ri-wifi-line", key: "qrWifi" },
  { id: "email", icon: "ri-mail-line", key: "qrEmail" },
  { id: "phone", icon: "ri-phone-line", key: "qrPhone" },
  { id: "sms", icon: "ri-message-2-line", key: "qrSms" },
  { id: "vcard", icon: "ri-contacts-book-line", key: "qrVcard" },
];

const EMPTY = {
  url: { url: "" },
  text: { text: "" },
  wifi: { ssid: "", password: "", encryption: "WPA", hidden: false },
  email: { to: "", subject: "", body: "" },
  phone: { phone: "" },
  sms: { phone: "", message: "" },
  vcard: { name: "", org: "", title: "", phone: "", email: "", website: "" },
};

// Is there enough data to ask the server for a code? (the server does the real validation)
const hasData = (type, d) =>
  ({ url: d.url, text: d.text, wifi: d.ssid, email: d.to, phone: d.phone, sms: d.phone, vcard: d.name }[type] || "").trim().length > 0;

export default function GenerateQr() {
  const { t } = useLanguage();
  const { toast } = useFeedback();
  const [type, setType] = useState("url");
  const [data, setData] = useState(EMPTY);
  const [opts, setOpts] = useState({ size: 512, margin: 2, ecc: "M", dark: "#000000", light: "#ffffff", transparent: false });
  const [preview, setPreview] = useState({ url: "", loading: false, error: "" });
  const seq = useRef(0);

  const set = (patch) => setData((d) => ({ ...d, [type]: { ...d[type], ...patch } }));
  const cur = data[type];
  const ready = hasData(type, cur);

  // Live preview (debounced) — always rendered by the backend, so what you see is what you download.
  useEffect(() => {
    if (!ready) { setPreview((p) => { if (p.url) URL.revokeObjectURL(p.url); return { url: "", loading: false, error: "" }; }); return undefined; }
    const id = ++seq.current;
    setPreview((p) => ({ ...p, loading: true }));
    const timer = setTimeout(async () => {
      try {
        const { blob } = await toolsApi.qr({ type, data: cur, options: { ...opts, format: "png" } });
        if (id !== seq.current) return;
        const url = URL.createObjectURL(blob);
        setPreview((p) => { if (p.url) URL.revokeObjectURL(p.url); return { url, loading: false, error: "" }; });
      } catch (e) {
        if (id !== seq.current) return;
        setPreview((p) => { if (p.url) URL.revokeObjectURL(p.url); return { url: "", loading: false, error: friendlyError(e, t) }; });
      }
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, JSON.stringify(cur), JSON.stringify(opts), ready]);

  useEffect(() => () => preview.url && URL.revokeObjectURL(preview.url), []); // eslint-disable-line

  async function download(format) {
    try {
      const { blob } = await toolsApi.qr({ type, data: cur, options: { ...opts, format } });
      saveBlob(blob, `qrcode.${format}`);
      toast.success(t("downloaded"));
    } catch (e) {
      toast.error(friendlyError(e, t));
    }
  }

  async function copy() {
    try {
      const { blob } = await toolsApi.qr({ type, data: cur, options: { ...opts, format: "png" } });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  const field = (key, props = {}) => (
    <input className="tk-input" value={cur[key]} onChange={(e) => set({ [key]: e.target.value })} {...props} />
  );
  const lbl = (k) => <div className="tk-label">{t(k)}</div>;

  const form = useMemo(() => {
    switch (type) {
      case "url": return <div>{lbl("qrUrl")}{field("url", { placeholder: "https://example.com", inputMode: "url" })}</div>;
      case "text": return <div>{lbl("qrText")}<textarea className="tk-textarea" value={cur.text} onChange={(e) => set({ text: e.target.value })} placeholder={t("qrTextPh")} maxLength={1500} /><div className="tk-hint" style={{ textAlign: "right" }}>{cur.text.length} / 1500</div></div>;
      case "wifi": return (
        <div style={{ display: "grid", gap: 12 }}>
          <div>{lbl("qrSsid")}{field("ssid", { maxLength: 64 })}</div>
          <div className="tk-fields">
            <div>{lbl("password")}{field("password", { type: "text", disabled: cur.encryption === "nopass", maxLength: 63 })}</div>
            <div>{lbl("qrSecurity")}
              <select className="tk-select" value={cur.encryption} onChange={(e) => set({ encryption: e.target.value })}>
                <option value="WPA">WPA / WPA2 / WPA3</option><option value="WEP">WEP</option><option value="nopass">{t("qrNoPass")}</option>
              </select>
            </div>
          </div>
          <label className="tk-hint" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={cur.hidden} onChange={(e) => set({ hidden: e.target.checked })} />{t("qrHidden")}</label>
        </div>);
      case "email": return (
        <div style={{ display: "grid", gap: 12 }}>
          <div>{lbl("email")}{field("to", { type: "email", placeholder: "name@example.com" })}</div>
          <div>{lbl("qrSubject")}{field("subject")}</div>
          <div>{lbl("qrBody")}<textarea className="tk-textarea" value={cur.body} onChange={(e) => set({ body: e.target.value })} /></div>
        </div>);
      case "phone": return <div>{lbl("qrPhone")}{field("phone", { type: "tel", placeholder: "+855 12 345 678" })}</div>;
      case "sms": return (
        <div style={{ display: "grid", gap: 12 }}>
          <div>{lbl("qrPhone")}{field("phone", { type: "tel", placeholder: "+855 12 345 678" })}</div>
          <div>{lbl("qrMessage")}<textarea className="tk-textarea" value={cur.message} onChange={(e) => set({ message: e.target.value })} maxLength={500} /></div>
        </div>);
      case "vcard": return (
        <div className="tk-fields">
          <div>{lbl("name")}{field("name")}</div><div>{lbl("qrOrg")}{field("org")}</div>
          <div>{lbl("qrJob")}{field("title")}</div><div>{lbl("qrPhone")}{field("phone", { type: "tel" })}</div>
          <div>{lbl("email")}{field("email", { type: "email" })}</div><div>{lbl("qrWebsite")}{field("website")}</div>
        </div>);
      default: return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, cur, t]);

  return (
    <ToolShell icon="ri-qr-code-line" titleKey="GenerateQr" subKey="qrSub">
      <div className="tk-grid-2">
        <div className="tk-card">
          <div className="tk-seg" role="tablist" aria-label={t("qrType")}>
            {TYPES.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={type === x.id} className={type === x.id ? "active" : ""} onClick={() => setType(x.id)}>
                <i className={x.icon} aria-hidden="true" />{t(x.key)}
              </button>
            ))}
          </div>

          {form}

          <details>
            <summary className="tk-label" style={{ cursor: "pointer" }}><i className="ri-palette-line" />{t("qrStyle")}</summary>
            <div className="tk-fields" style={{ marginTop: 10 }}>
              <div>{lbl("qrForeground")}<input className="tk-color" type="color" value={opts.dark} onChange={(e) => setOpts({ ...opts, dark: e.target.value })} /></div>
              <div>{lbl("qrBackground")}<input className="tk-color" type="color" value={opts.light} disabled={opts.transparent} onChange={(e) => setOpts({ ...opts, light: e.target.value })} /></div>
              <div>{lbl("qrSize")} <span className="tk-hint">{opts.size}px</span><input className="tk-range" type="range" min="128" max="2048" step="64" value={opts.size} onChange={(e) => setOpts({ ...opts, size: +e.target.value })} /></div>
              <div>{lbl("qrMargin")} <span className="tk-hint">{opts.margin}</span><input className="tk-range" type="range" min="0" max="10" value={opts.margin} onChange={(e) => setOpts({ ...opts, margin: +e.target.value })} /></div>
              <div>{lbl("qrEcc")}
                <select className="tk-select" value={opts.ecc} onChange={(e) => setOpts({ ...opts, ecc: e.target.value })}>
                  <option value="L">L · 7%</option><option value="M">M · 15%</option><option value="Q">Q · 25%</option><option value="H">H · 30%</option>
                </select>
              </div>
              <label className="tk-hint" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={opts.transparent} onChange={(e) => setOpts({ ...opts, transparent: e.target.checked })} />{t("qrTransparent")}</label>
            </div>
          </details>
        </div>

        <div className="tk-card">
          <div className="tk-preview" aria-live="polite">
            {preview.url ? (
              <img className={opts.transparent ? "checker" : ""} src={preview.url} alt={t("qrPreviewAlt")} style={{ opacity: preview.loading ? 0.5 : 1, transition: "opacity .2s", width: "min(100%, 320px)" }} />
            ) : preview.error ? (
              <div className="tk-alert err" role="alert"><i className="ri-error-warning-line" />{preview.error}</div>
            ) : (
              <div className="tk-empty"><i className="ri-qr-scan-2-line" />{t("qrEmpty")}</div>
            )}
          </div>
          <div className="tk-row">
            <button type="button" className="tk-btn" disabled={!preview.url} onClick={() => download("png")}><i className="ri-image-line" />PNG</button>
            <button type="button" className="tk-btn" disabled={!preview.url} onClick={() => download("svg")}><i className="ri-file-code-line" />SVG</button>
            <button type="button" className="tk-btn ghost" disabled={!preview.url} onClick={copy}><i className="ri-file-copy-line" />{t("copy")}</button>
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
