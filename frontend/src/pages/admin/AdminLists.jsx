import { useEffect, useState } from "react";
import adminService from "../../services/adminService";
import { SkeletonRows, SkeletonStats } from "../../components/ui/Skeleton";

function usePaged(fetcher) {
  const [page, setPage] = useState(1);
  const [state, setState] = useState({
    items: [],
    pages: 1,
    total: 0,
    loading: true,
    error: "",
  });
  useEffect(() => {
    let off = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    fetcher(page)
      .then((r) => {
        if (!off)
          setState({
            items: r.data?.items || [],
            pages: r.data?.pages || 1,
            total: r.data?.total || 0,
            loading: false,
            error: "",
          });
      })
      .catch((e) => {
        if (!off)
          setState((s) => ({
            ...s,
            loading: false,
            error: e.message || "Failed to load.",
          }));
      });
    return () => {
      off = true;
    };
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, page, setPage };
}

function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <div className="adm-pager">
      <button
        className="admin-btn admin-btn-small"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Prev
      </button>
      <span>
        {page} / {pages}
      </span>
      <button
        className="admin-btn admin-btn-small"
        disabled={page >= pages}
        onClick={() => setPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

export function AdminPayments() {
  const d = usePaged((p) => adminService.getPayments({ page: p, limit: 20 }));
  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h2>Payments</h2>
        <span className="admin-panel-count">{d.loading ? "…" : d.total}</span>
      </div>
      {d.error && <div className="auth-alert error">{d.error}</div>}
      <div className="admin-users-table">
        <div className="admin-table-header">
          <span>Plan</span>
          <span>Price</span>
          <span>Tokens</span>
          <span>Status</span>
          <span>Date</span>
        </div>
        {d.loading && <SkeletonRows rows={6} cols={5} />}
        {d.items.map((p) => (
          <div key={p._id} className="admin-table-row">
            <span data-label="Plan">{p.planName || `Plan ${p.planId}`}</span>
            <span data-label="Price">${Number(p.price || 0).toFixed(2)}</span>
            <span data-label="Tokens">{p.tokens}</span>
            <span data-label="Status">
              <span
                className={`status-badge ${p.status === "paid" ? "active" : "inactive"}`}
              >
                {p.status}
              </span>
            </span>
            <span data-label="Date">
              {new Date(p.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
        {!d.loading && d.items.length === 0 && (
          <div className="admin-table-empty">No payments yet.</div>
        )}
      </div>
      <Pager {...d} />
    </div>
  );
}

export function AdminAudit() {
  const d = usePaged((p) => adminService.getAudit({ page: p, limit: 30 }));
  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h2>Audit log</h2>
        <span className="admin-panel-count">{d.loading ? "…" : d.total}</span>
      </div>
      {d.error && <div className="auth-alert error">{d.error}</div>}
      <div className="admin-users-table">
        <div className="admin-table-header">
          <span>Action</span>
          <span>Target</span>
          <span>Details</span>
          <span>IP</span>
          <span>Date</span>
        </div>
        {d.loading && <SkeletonRows rows={6} cols={5} />}
        {d.items.map((a) => (
          <div key={a._id} className="admin-table-row">
            <span data-label="Action">
              <span className="role-badge">{a.action}</span>
            </span>
            <span data-label="Target" className="adm-email">
              {a.target}
            </span>
            <span data-label="Details" className="adm-email">
              {Object.entries(a.meta || {})
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")}
            </span>
            <span data-label="IP">{a.ip || "—"}</span>
            <span data-label="Date">
              {new Date(a.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
        {!d.loading && d.items.length === 0 && (
          <div className="admin-table-empty">Nothing logged yet.</div>
        )}
      </div>
      <Pager {...d} />
    </div>
  );
}

export function AdminStats() {
  const [s, setS] = useState(null);
  useEffect(() => {
    let off = false;
    adminService
      .getStats()
      .then((r) => !off && setS(r.data))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);
  if (!s) return <SkeletonStats n={4} />;
  const items = [
    ["ri-group-line", s.users, "Users"],
    ["ri-forbid-line", s.banned, "Suspended"],
    ["ri-money-dollar-circle-line", `$${s.revenue}`, "Revenue"],
    ["ri-coin-line", s.tokensSold, "Tokens sold"],
  ];
  return (
    <div className="adm-stats">
      {items.map(([i, v, l]) => (
        <div key={l} className="adm-stat">
          <i className={i} />
          <div>
            <b>{v}</b>
            <span>{l}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminSettings() {
  const [st, setSt] = useState(null);
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [ttsModel, setTtsModel] = useState("");
  const [textModel, setTextModel] = useState("");
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);
  const load = () =>
    adminService
      .getGeminiSetting()
      .then((r) => {
        setSt(r.data);
        setTtsModel(r.data.ttsModel || "");
        setTextModel(r.data.textModel || "");
      })
      .catch((e) => setMsg({ type: "error", text: e.message }));
  useEffect(() => {
    load();
  }, []);
  const run = async (fn, ok) => {
    setBusy(true);
    setMsg({ type: "", text: "" });
    try {
      const r = await fn();
      if (r?.data && r.data.hasKey !== undefined) {
        setSt(r.data);
      }
      setMsg({ type: "success", text: ok(r) });
      setKey("");
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Failed." });
    } finally {
      setBusy(false);
    }
  };
  if (!st && !msg.text) return <SkeletonStats n={2} />;
  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h2>AI settings</h2>
      </div>
      {msg.text && (
        <div className={`auth-alert ${msg.type}`} role="status">
          {msg.text}
        </div>
      )}
      <div className="admin-detail-card">
        <label>
          Gemini API key (used by every user — users are never asked for a key)
        </label>
        <p>
          {st?.hasKey ? (
            <>
              Active: <b>{st.masked}</b>{" "}
              <span className="role-badge">
                {st.source === "admin" ? "set here" : "server env"}
              </span>
            </>
          ) : (
            <b>No key set — AI tools are disabled until you add one.</b>
          )}
        </p>
        <form
          className="admin-add-tokens-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!key.trim()) return;
            run(
              () => adminService.saveGeminiSetting({ key: key.trim() }),
              () => "Key checked with Google and saved (encrypted).",
            );
          }}
        >
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <input
              type={show ? "text" : "password"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="AIza… / AQ.…"
              autoComplete="off"
              spellCheck={false}
              aria-label="Gemini API key"
              style={{ width: "100%", paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label="Show / hide"
              style={{ position: "absolute", right: 6, top: 6 }}
            >
              <i className={show ? "ri-eye-off-line" : "ri-eye-line"} />
            </button>
          </div>
          <button
            type="submit"
            className="admin-btn admin-btn-primary"
            disabled={busy || !key.trim()}
          >
            <i className="ri-save-3-line" />{" "}
            {st?.hasKey ? "Replace key" : "Save key"}
          </button>
          {st?.hasKey && (
            <button
              type="button"
              className="admin-btn"
              disabled={busy}
              onClick={() =>
                run(
                  () => adminService.testGeminiSetting(),
                  () => "Key works.",
                )
              }
            >
              <i className="ri-pulse-line" /> Test
            </button>
          )}
          {st?.source === "admin" && (
            <button
              type="button"
              className="admin-btn admin-btn-danger"
              disabled={busy}
              onClick={() =>
                run(
                  () => adminService.deleteGeminiSetting(),
                  () => "Key removed.",
                )
              }
            >
              <i className="ri-delete-bin-line" /> Remove
            </button>
          )}
        </form>
      </div>
      <form
        className="admin-detail-card"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => adminService.saveGeminiSetting({ ttsModel, textModel }),
            () => "Models saved.",
          );
        }}
      >
        <label>Models (leave empty for the defaults)</label>
        <div className="adm-two">
          <input
            value={ttsModel}
            onChange={(e) => setTtsModel(e.target.value)}
            placeholder="Voice model (TTS)"
            aria-label="TTS model"
          />
          <input
            value={textModel}
            onChange={(e) => setTextModel(e.target.value)}
            placeholder="Text model (translate / AI)"
            aria-label="Text model"
          />
        </div>
        <button
          type="submit"
          className="admin-btn admin-btn-primary"
          disabled={busy}
        >
          <i className="ri-save-3-line" /> Save models
        </button>
      </form>
    </div>
  );
}

export function AdminBroadcast() {
  const [target, setTarget] = useState("all");
  const [user, setUser] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);
  async function send(e) {
    e.preventDefault();
    if (
      target === "all" &&
      !window.confirm("Send this notification to ALL users?")
    )
      return;
    setBusy(true);
    setMsg({ type: "", text: "" });
    try {
      const r = await adminService.broadcast({
        target,
        user: user.trim(),
        title: title.trim(),
        body: body.trim(),
      });
      setMsg({ type: "success", text: r.message || "Sent." });
      setTitle("");
      setBody("");
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Failed." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h2>Send notification</h2>
      </div>
      {msg.text && (
        <div className={`auth-alert ${msg.type}`} role="status">
          {msg.text}
        </div>
      )}
      <form className="admin-detail-card adm-form" onSubmit={send}>
        <div
          className="ve-seg tk-seg"
          role="radiogroup"
          aria-label="Audience"
          style={{ display: "flex", gap: 6 }}
        >
          <button
            type="button"
            role="radio"
            aria-checked={target === "all"}
            className={`admin-btn ${target === "all" ? "admin-btn-primary" : ""}`}
            onClick={() => setTarget("all")}
          >
            <i className="ri-group-line" /> All users
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={target === "user"}
            className={`admin-btn ${target === "user" ? "admin-btn-primary" : ""}`}
            onClick={() => setTarget("user")}
          >
            <i className="ri-user-line" /> One user
          </button>
        </div>
        {target === "user" && (
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="User email or id"
            aria-label="User"
            required
          />
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Title"
          aria-label="Title"
          required
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={400}
          rows={4}
          placeholder="Message (optional)"
          aria-label="Message"
        />
        <button
          type="submit"
          className="primary-btn center"
          disabled={busy || !title.trim()}
        >
          <i className="ri-send-plane-line" /> Send
        </button>
      </form>
    </div>
  );
}
