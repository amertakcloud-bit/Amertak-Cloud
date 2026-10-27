import { useState, useEffect } from "react";
import adminService from "../../services/adminService";
import { useAuth } from "../../context/AuthContext";
import { can } from "../../lib/permissions";

const ROLES = ["user", "support", "finance", "admin"];

export default function UserDetailPanel({ userId, onBack, onTokenAdded }) {
  const [user, setUser] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addedTokens, setAddedTokens] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [busy, setBusy] = useState(false);
  const { user: me } = useAuth();
  const myId = me?._id || me?.id;
  const isSelf = String(myId) === String(userId);

  async function loadUser() {
    try {
      setLoading(true);
      setError("");
      const data = await adminService.getUserDetail(userId);
      setUser(data.data.user);
      setPayments(data.data.recentPayments || []);
      if (can(me, "ledger.read")) adminService.getLedger(userId).then((r) => setLedger(r.data?.items || [])).catch(() => setLedger([]));
    } catch (err) {
      setError(err.message || "Failed to load user details.");
    } finally {
      setLoading(false);
    }
  }

  // Load on mount and whenever a different user is selected.
  useEffect(() => {
    loadUser();
  }, [userId]);

  async function act(fn, okMsg) {
    setBusy(true); setError(""); setAddedTokens(null);
    try { const r = await fn(); if (r?.data?.user) setUser(r.data.user); if (okMsg) setAddedTokens({ msg: okMsg(r) }); await loadUser(); return true; }
    catch (err) { setError(err.message || "Action failed."); return false; }
    finally { setBusy(false); }
  }

  async function handleTokens(e, sign) {
    e.preventDefault();
    const f = e.target; const tokens = Number(f.tokens.value); const reason = f.reason.value.trim();
    if (!Number.isInteger(tokens) || tokens <= 0) return setError("Please enter a valid number of tokens.");
    if (sign < 0 && !reason) return setError("A reason is required when removing tokens.");
    const ok = await act(() => (sign > 0 ? adminService.addTokens(userId, tokens, reason) : adminService.deductTokens(userId, tokens, reason)), (r) => `${sign > 0 ? "Added" : "Removed"} ${tokens} tokens. New balance: ${r.data?.user?.tokens}`);
    if (ok) f.reset();
  }

  async function handleBan(e) {
    e.preventDefault();
    const reason = e.target.reason.value.trim();
    const ok = await act(() => adminService.setBan(userId, !user.banned, reason), () => (user.banned ? "Account restored." : "Account suspended."));
    if (ok) e.target.reset();
  }

  if (loading && !user) return null;

  return (
    <div className="admin-panel admin-detail-panel">
      <div className="admin-panel-header">
        <h2>
          {user?.name}
          <span className="admin-panel-action">
            <button
              className="admin-btn admin-btn-small"
              onClick={() => {
                onBack();
                loadUser();
              }}
            >
              <i className="ri-arrow-left-line" aria-hidden="true"></i>
              Back
            </button>
          </span>
        </h2>
      </div>

      {error && <div className="auth-alert error">{error}</div>}

      {addedTokens && (
        <div className="auth-alert success">
          <i className="ri-checkbox-circle-line" aria-hidden="true"></i>
          {addedTokens.msg}
        </div>
      )}

      <div className="admin-detail-grid">
        <div className="admin-detail-card">
          <label>Name</label>
          <p>{user?.name || "—"}</p>
        </div>
        <div className="admin-detail-card">
          <label>Email</label>
          <p>{user?.email || "—"}</p>
        </div>
        <div className="admin-detail-card">
          <label>Role</label>
          <p>
            <span className="role-badge">{user?.role || "—"}</span>
          </p>
        </div>
        <div className="admin-detail-card">
          <label>Tokens</label>
          <p>
            <i className="ri-price-tag-3-line" aria-hidden="true"></i>{" "}
            {user?.tokens ?? 0}
          </p>
        </div>
        <div className="admin-detail-card">
          <label>Provider</label>
          <p>{user?.provider || "local"}</p>
        </div>
        <div className="admin-detail-card">
          <label>Joined</label>
          <p>{new Date(user?.createdAt || "").toLocaleString()}</p>
        </div>
      </div>

      {user?.banned && <div className="auth-alert error" role="status">Suspended{user.bannedReason ? `: ${user.bannedReason}` : ""}</div>}

      {can(me, "tokens.adjust") && (
        <div className="adm-two">
          <form className="admin-add-tokens-form" onSubmit={(e) => handleTokens(e, 1)}>
            <label htmlFor="tk-add">Add tokens</label>
            <input id="tk-add" name="tokens" type="number" min="1" placeholder="e.g. 500" />
            <input name="reason" maxLength={300} placeholder="Reason (optional)" aria-label="Reason" />
            <button type="submit" disabled={busy} className="admin-btn admin-btn-primary"><i className="ri-add-line" aria-hidden="true"></i> Add</button>
          </form>
          <form className="admin-add-tokens-form" onSubmit={(e) => handleTokens(e, -1)}>
            <label htmlFor="tk-sub">Remove tokens</label>
            <input id="tk-sub" name="tokens" type="number" min="1" placeholder="e.g. 50" />
            <input name="reason" maxLength={300} placeholder="Reason (required)" aria-label="Reason" required />
            <button type="submit" disabled={busy} className="admin-btn"><i className="ri-subtract-line" aria-hidden="true"></i> Remove</button>
          </form>
        </div>
      )}

      {can(me, "*") && !isSelf && (
        <div className="admin-add-tokens-form">
          <label htmlFor="role-sel">Role</label>
          <select id="role-sel" value={user?.role || "user"} disabled={busy} onChange={(e) => act(() => adminService.setRole(userId, e.target.value), () => "Role updated.")}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      )}

      {can(me, "users.ban") && !isSelf && (
        <form className="admin-add-tokens-form" onSubmit={handleBan}>
          <label htmlFor="ban-reason">{user?.banned ? "Restore account" : "Suspend account"}</label>
          {!user?.banned && <input id="ban-reason" name="reason" maxLength={300} placeholder="Reason (required)" required />}
          <button type="submit" disabled={busy} className={`admin-btn ${user?.banned ? "admin-btn-primary" : "admin-btn-danger"}`}>
            <i className={user?.banned ? "ri-lock-unlock-line" : "ri-forbid-line"} aria-hidden="true"></i> {user?.banned ? "Restore" : "Suspend"}
          </button>
        </form>
      )}

      {ledger.length > 0 && (
        <div className="admin-detail-card admin-detail-card-bordered">
          <label>Token history</label>
          <div className="admin-detail-list">
            {ledger.map((l) => (
              <div key={l._id} className="admin-detail-list-item">
                <span className="admin-detail-item-name">{l.reason}{l.note ? ` — ${l.note}` : ""}</span>
                <span className="admin-detail-item-value" style={{ color: l.delta < 0 ? "#f59e0b" : "#22c55e" }}>{l.delta > 0 ? "+" : ""}{l.delta}</span>
                <span className="admin-detail-item-value">{l.balance ?? "—"}</span>
                <span className="admin-detail-item-date">{new Date(l.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment summary */}
      {payments.length > 0 && (
        <div className="admin-detail-card admin-detail-card-bordered">
          <label>Payment History</label>
          <div className="admin-detail-list">
            {payments.map((p) => (
              <div key={p._id} className="admin-detail-list-item">
                <span className="admin-detail-item-name">
                  {p.planName || `Plan ${p.planId}`}
                </span>
                <span className="admin-detail-item-value">
                  ${p.price?.toFixed(2)}
                </span>
                <span className="admin-detail-item-value">{p.tokens} tokens</span>
                <span className="admin-detail-item-date">
                  {new Date(p.createdAt).toLocaleString()}
                </span>
                <span
                  className={`status-badge ${p.status === "paid" ? "active" : "inactive"}`}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
