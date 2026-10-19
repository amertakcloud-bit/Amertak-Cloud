import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLanguage } from "../../context/LanguageContext";

// Feedback: toasts + confirm dialog.
//   const { toast, confirm } = useFeedback();
//   toast.success("Saved"); toast.error("…"); toast.info("…");
//   const t = toast.loading("Working…"); toast.update(t, { type: "success", message: "Done" });
//   if (await confirm({ title, message, confirmText, danger: true })) { … }

const FeedbackContext = createContext(null);
const ICONS = { success: "ri-checkbox-circle-fill", error: "ri-error-warning-fill", info: "ri-information-fill", loading: "ri-loader-4-line" };
const DURATION = { success: 3500, info: 4000, error: 6000 };
const EASE = [0.22, 1, 0.36, 1];
const MAX_TOASTS = 4;

let seq = 0;

export function FeedbackProvider({ children }) {
  const { t } = useLanguage();
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);

  const arm = useCallback((id, type) => {
    clearTimeout(timers.current.get(id));
    if (type === "loading") return;
    timers.current.set(id, setTimeout(() => dismiss(id), DURATION[type] ?? 4000));
  }, [dismiss]);

  const push = useCallback((type, message, opts = {}) => {
    const id = opts.id ?? ++seq;
    setToasts((list) => {
      const rest = list.filter((x) => x.id !== id);
      return [...rest, { id, type, message }].slice(-MAX_TOASTS);
    });
    arm(id, type);
    return id;
  }, [arm]);

  const api = useMemo(() => ({
    toast: {
      success: (m, o) => push("success", m, o),
      error: (m, o) => push("error", m, o),
      info: (m, o) => push("info", m, o),
      loading: (m, o) => push("loading", m, o),
      update: (id, { type = "info", message }) => {
        setToasts((list) => list.map((x) => (x.id === id ? { ...x, type, message } : x)));
        arm(id, type);
      },
      dismiss,
    },
    confirm: (opts) => new Promise((resolve) => setDialog({ ...opts, resolve })),
  }), [push, arm, dismiss]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const closeDialog = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      <div className="toast-stack" role="region" aria-label="Notifications" aria-live="polite">
        <AnimatePresence initial={false} mode="popLayout">
          {toasts.map((x) => (
            <motion.div
              key={x.id}
              layout
              className={`toast toast-${x.type}`}
              role={x.type === "error" ? "alert" : "status"}
              initial={{ opacity: 0, y: -14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96, transition: { duration: 0.18, ease: "easeIn" } }}
              transition={{ duration: 0.28, ease: EASE, layout: { duration: 0.22, ease: EASE } }}
            >
              <i className={`${ICONS[x.type]} toast-icon`} aria-hidden="true" />
              <p className="toast-msg">{x.message}</p>
              <button type="button" className="toast-x" onClick={() => dismiss(x.id)} aria-label={t("close")}>
                <i className="ri-close-line" />
              </button>
              {x.type !== "loading" && (
                <span className="toast-bar" style={{ animationDuration: `${DURATION[x.type] ?? 4000}ms` }} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <ConfirmDialog dialog={dialog} onClose={closeDialog} />
    </FeedbackContext.Provider>
  );
}

function ConfirmDialog({ dialog, onClose }) {
  const { t } = useLanguage();
  const okRef = useRef(null);
  const lastFocus = useRef(null);

  useEffect(() => {
    if (!dialog) return undefined;
    lastFocus.current = document.activeElement;
    const raf = requestAnimationFrame(() => okRef.current?.focus());
    const onKey = (e) => {
      if (e.key === "Escape") onClose(false);
      if (e.key === "Tab") {
        const els = document.querySelectorAll(".confirm-card button");
        if (!els.length) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      lastFocus.current?.focus?.();
    };
  }, [dialog, onClose]);

  return (
    <AnimatePresence>
      {dialog && (
        <motion.div
          className="confirm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}
        >
          <motion.div
            className="confirm-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.24, ease: EASE }}
          >
            <h2 id="confirm-title">{dialog.title || t("confirmTitle")}</h2>
            {dialog.message && <p>{dialog.message}</p>}
            <div className="confirm-actions">
              <button type="button" className="confirm-btn ghost" onClick={() => onClose(false)}>
                {dialog.cancelText || t("cancel")}
              </button>
              <button ref={okRef} type="button" className={`confirm-btn ${dialog.danger ? "danger" : ""}`} onClick={() => onClose(true)}>
                {dialog.confirmText || t("confirm")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside a FeedbackProvider");
  return ctx;
}
