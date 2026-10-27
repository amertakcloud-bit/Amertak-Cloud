import { useEffect, useState } from "react";
import adminService from "../../services/adminService";
import { SkeletonRows, SkeletonStats } from "../../components/ui/Skeleton";

function usePaged(fetcher) {
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ items: [], pages: 1, total: 0, loading: true, error: "" });
  useEffect(() => {
    let off = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    fetcher(page).then((r) => { if (!off) setState({ items: r.data?.items || [], pages: r.data?.pages || 1, total: r.data?.total || 0, loading: false, error: "" }); })
      .catch((e) => { if (!off) setState((s) => ({ ...s, loading: false, error: e.message || "Failed to load." })); });
    return () => { off = true; };
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, page, setPage };
}

function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <div className="adm-pager">
      <button className="admin-btn admin-btn-small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
      <span>{page} / {pages}</span>
      <button className="admin-btn admin-btn-small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
    </div>
  );
}

export function AdminPayments() {
  const d = usePaged((p) => adminService.getPayments({ page: p, limit: 20 }));
  return (
    <div className="admin-panel">
      <div className="admin-panel-header"><h2>Payments</h2><span className="admin-panel-count">{d.loading ? "…" : d.total}</span></div>
      {d.error && <div className="auth-alert error">{d.error}</div>}
      <div className="admin-users-table">
        <div className="admin-table-header"><span>Plan</span><span>Price</span><span>Tokens</span><span>Status</span><span>Date</span></div>
        {d.loading && <SkeletonRows rows={6} cols={5} />}
        {d.items.map((p) => (
          <div key={p._id} className="admin-table-row">
            <span data-label="Plan">{p.planName || `Plan ${p.planId}`}</span>
            <span data-label="Price">${Number(p.price || 0).toFixed(2)}</span>
            <span data-label="Tokens">{p.tokens}</span>
            <span data-label="Status"><span className={`status-badge ${p.status === "paid" ? "active" : "inactive"}`}>{p.status}</span></span>
            <span data-label="Date">{new Date(p.createdAt).toLocaleString()}</span>
          </div>
        ))}
        {!d.loading && d.items.length === 0 && <div className="admin-table-empty">No payments yet.</div>}
      </div>
      <Pager {...d} />
    </div>
  );
}

export function AdminAudit() {
  const d = usePaged((p) => adminService.getAudit({ page: p, limit: 30 }));
  return (
    <div className="admin-panel">
      <div className="admin-panel-header"><h2>Audit log</h2><span className="admin-panel-count">{d.loading ? "…" : d.total}</span></div>
      {d.error && <div className="auth-alert error">{d.error}</div>}
      <div className="admin-users-table">
        <div className="admin-table-header"><span>Action</span><span>Target</span><span>Details</span><span>IP</span><span>Date</span></div>
        {d.loading && <SkeletonRows rows={6} cols={5} />}
        {d.items.map((a) => (
          <div key={a._id} className="admin-table-row">
            <span data-label="Action"><span className="role-badge">{a.action}</span></span>
            <span data-label="Target" className="adm-email">{a.target}</span>
            <span data-label="Details" className="adm-email">{Object.entries(a.meta || {}).map(([k, v]) => `${k}: ${v}`).join(", ")}</span>
            <span data-label="IP">{a.ip || "—"}</span>
            <span data-label="Date">{new Date(a.createdAt).toLocaleString()}</span>
          </div>
        ))}
        {!d.loading && d.items.length === 0 && <div className="admin-table-empty">Nothing logged yet.</div>}
      </div>
      <Pager {...d} />
    </div>
  );
}

export function AdminStats() {
  const [s, setS] = useState(null);
  useEffect(() => { let off = false; adminService.getStats().then((r) => !off && setS(r.data)).catch(() => {}); return () => { off = true; }; }, []);
  if (!s) return <SkeletonStats n={4} />;
  const items = [["ri-group-line", s.users, "Users"], ["ri-forbid-line", s.banned, "Suspended"], ["ri-money-dollar-circle-line", `$${s.revenue}`, "Revenue"], ["ri-coin-line", s.tokensSold, "Tokens sold"]];
  return <div className="adm-stats">{items.map(([i, v, l]) => <div key={l} className="adm-stat"><i className={i} /><div><b>{v}</b><span>{l}</span></div></div>)}</div>;
}
