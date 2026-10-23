import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useFeedback } from "../ui/Feedback";
import { clearGeminiKey, isKeyFormatOk, maskKey, setGeminiKey, useGeminiKey } from "../../services/geminiKey";
import { loadAccountKey, removeAccountKey, resetAccountKey, saveAccountKey, useAccountKey } from "../../services/accountKey";
import { toolsApi } from "../../services/toolsApi";
import { friendlyError } from "../../lib/errors";

// Decides which Gemini key a request will use and renders the status row + key dialog.
//   user key (typed here, memory only)  >  server key (logged-in users only)  >  key required
export function useGeminiAccess(status) {
  const key = useGeminiKey();
  const { user } = useAuth();
  const account = useAccountKey();
  const uid = user?.id || user?._id || "";
  useEffect(() => { if (uid) loadAccountKey(); else resetAccountKey(); }, [uid]);
  const serverKey = Boolean(status?.tools?.srt?.serverKey);
  const source = key ? "user" : user && account.hasKey ? "account" : user && serverKey ? "server" : "none";
  return { key, source, ready: source !== "none", serverKey, loggedIn: Boolean(user), account };
}

export default function GeminiKeyPanel({ status, access, onOpenChange }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const toggle = (v) => { setOpen(v); onOpenChange?.(v); };
  const removeKey = async () => {
    clearGeminiKey();
    if (access.account.hasKey) { try { await removeAccountKey(); } catch { /* shown on next load */ } }
  };

  const tone = access.source === "none" ? "warn" : "ok";
  const title =
    access.source === "user" ? `${t("keyUsingYours")} (${maskKey(access.key)})`
    : access.source === "account" ? `${t("keyUsingAccount")} (${access.account.masked})`
    : access.source === "server" ? t("keyUsingServer")
    : t("keyRequired");
  const sub =
    access.source === "none"
      ? access.serverKey ? t("keyLoginOrPaste") : t("keyPasteHint")
      : access.source === "account" ? t("keyAccountNote") : t("keyMemoryOnly");

  return (
    <>
      <div className="tk-key">
        <i className={`ri-key-2-line tk-chip ${tone}`} style={{ padding: 8, fontSize: "1.1rem" }} aria-hidden="true" />
        <div className="grow"><b>{title}</b><span>{sub}</span></div>
        {(access.key || access.account.hasKey) && (
          <button type="button" className="tk-btn ghost small" onClick={removeKey}><i className="ri-delete-bin-line" />{t("keyRemove")}</button>
        )}
        <button type="button" className="tk-btn small" onClick={() => toggle(true)}>
          <i className="ri-key-line" />{access.key || access.account.hasKey ? t("keyChange") : t("keyAdd")}
        </button>
      </div>
      <GeminiKeyDialog open={open} onClose={() => toggle(false)} loggedIn={access.loggedIn} />
    </>
  );
}

function GeminiKeyDialog({ open, onClose, loggedIn }) {
  const { t } = useLanguage();
  const { toast } = useFeedback();
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setValue(""); setError(""); setShow(false);
    const raf = requestAnimationFrame(() => input.current?.focus());
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  async function save(e) {
    e.preventDefault();
    const v = value.trim();
    if (!isKeyFormatOk(v)) { setError(t("keyBadFormat")); return; }
    setBusy(true); setError("");
    try {
      if (loggedIn) {
        await saveAccountKey(v); // validated by Google on the server, then stored encrypted in your account
        clearGeminiKey();
      } else {
        await toolsApi.validateKey(v);
        setGeminiKey(v, { remember });
      }
      toast.success(t("keySaved"));
      onClose();
    } catch (err) {
      setError(friendlyError(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="confirm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.form className="confirm-card" style={{ width: "min(460px,100%)" }} onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="key-title"
            initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}>
            <h2 id="key-title"><i className="ri-key-2-line" /> {t("keyDialogTitle")}</h2>
            <p>{t("keyDialogText")}</p>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <div style={{ position: "relative" }}>
                <input ref={input} className="tk-input" type={show ? "text" : "password"} value={value} onChange={(e) => setValue(e.target.value)}
                  placeholder="AIza… / AQ.…" autoComplete="off" spellCheck={false} aria-invalid={Boolean(error)} style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t("hide") : t("show")}
                  style={{ position: "absolute", right: 6, top: 6, width: 32, height: 32, color: "var(--text-muted)" }}>
                  <i className={show ? "ri-eye-off-line" : "ri-eye-line"} />
                </button>
              </div>
              {error && <div className="tk-alert err" role="alert"><i className="ri-error-warning-line" />{error}</div>}
              {loggedIn ? (
                <p className="tk-hint"><i className="ri-shield-check-line" /> {t("keyAccountNote")}</p>
              ) : (
                <label className="tk-hint" style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t("keyRemember")}
                </label>
              )}
              <a className="tk-hint" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>
                <i className="ri-external-link-line" /> {t("keyGet")}
              </a>
            </div>
            <div className="confirm-actions">
              <button type="button" className="confirm-btn ghost" onClick={onClose}>{t("cancel")}</button>
              <button type="submit" className="confirm-btn" disabled={busy || !value.trim()}>{busy ? t("keyChecking") : t("keySave")}</button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
