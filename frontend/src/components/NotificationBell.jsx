import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import "../styles/notifications.css";

const ICONS = { tokens_added: "ri-add-circle-line", tokens_removed: "ri-subtract-line", payment: "ri-bank-card-line", low_balance: "ri-error-warning-line", refund: "ri-refund-2-line", promo: "ri-coupon-3-line" };
const POLL_MS = 60000; // Vercel has no websockets, so the bell polls (and again when the tab becomes visible).

function ago(iso) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`;
}

export default function NotificationBell() {
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const lastUnread = useRef(0);
  const box = useRef(null);
  const uid = user?._id || user?.id;

  const load = useCallback(async () => {
    try {
      const r = await api.get("/users/notifications");
      const d = r.data || {};
      setItems(d.items || []); setUnread(d.unread || 0); setLoaded(true);
      if ((d.unread || 0) > lastUnread.current) refreshUser?.(); // a new note usually means the balance changed
      lastUnread.current = d.unread || 0;
    } catch { /* offline or logged out — keep the old list */ }
  }, [refreshUser]);

  useEffect(() => {
    if (!uid) return undefined;
    load();
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, POLL_MS);
    const vis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [uid, load]);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (!uid) return null;

  const readAll = async () => {
    setItems((l) => l.map((n) => ({ ...n, read: true }))); setUnread(0); lastUnread.current = 0;
    try { await api.post("/users/notifications/read-all"); } catch { /* retried on next poll */ }
  };
  const readOne = async (n) => {
    if (n.read) return;
    setItems((l) => l.map((x) => (x._id === n._id ? { ...x, read: true } : x))); setUnread((u) => Math.max(0, u - 1)); lastUnread.current = Math.max(0, lastUnread.current - 1);
    try { await api.post(`/users/notifications/${n._id}/read`); } catch { /* ignore */ }
  };

  return (
    <div className="nb" ref={box}>
      <button type="button" className="icon-btn nb-btn" onClick={() => setOpen((o) => !o)} aria-label={t("notifications")} aria-expanded={open} title={t("notifications")}>
        <i className="ri-notification-3-line" aria-hidden="true" />
        {unread > 0 && <span className="nb-badge" aria-label={`${unread}`}>{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="nb-pop" role="dialog" aria-label={t("notifications")}>
          <div className="nb-head">
            <strong>{t("notifications")}</strong>
            <button type="button" className="nb-link" onClick={readAll} disabled={!unread}>{t("markAllRead")}</button>
          </div>
          <ul className="nb-list">
            {!loaded && [0, 1, 2].map((i) => <li key={i} className="nb-item"><span className="sk" style={{ width: 28, height: 28, borderRadius: 14 }} /><span className="sk" style={{ height: 12, flex: 1 }} /></li>)}
            {loaded && items.length === 0 && <li className="nb-empty">{t("noNotifications")}</li>}
            {items.map((n) => (
              <li key={n._id} className={`nb-item ${n.read ? "" : "unread"} ${n.type}`} onClick={() => readOne(n)}>
                <i className={ICONS[n.type] || "ri-information-line"} aria-hidden="true" />
                <div><b>{n.title}</b>{n.body && <p>{n.body}</p>}<small>{ago(n.createdAt)}</small></div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
