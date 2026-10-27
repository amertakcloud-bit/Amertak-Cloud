import { useState, useEffect } from "react";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { useNavigate } from "react-router-dom";
import adminService from "../../services/adminService";

export default function UsersListView({ onUserSelect, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");
      const data = await adminService.getUsers();
      setUsers(data.data?.users || []);
    } catch (err) {
      setError(err.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  // Load the list on mount (this was missing — the table stayed empty).
  useEffect(() => {
    loadUsers();
  }, []);

  const needle = q.trim().toLowerCase();
  const shown = needle ? users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(needle)) : users;
  const totalTokens = users.reduce((s, u) => s + (Number(u.tokens) || 0), 0);
  const admins = users.filter((u) => u.role === "admin").length;
  const newWeek = users.filter((u) => Date.now() - new Date(u.createdAt).getTime() < 7 * 864e5).length;

  return (
    <div className="admin-panel">
      <div className="adm-stats">
        <div className="adm-stat"><i className="ri-group-line" /><div><b>{users.length}</b><span>Users</span></div></div>
        <div className="adm-stat"><i className="ri-user-add-line" /><div><b>{newWeek}</b><span>New (7 days)</span></div></div>
        <div className="adm-stat"><i className="ri-coin-line" /><div><b>{totalTokens}</b><span>Tokens held</span></div></div>
        <div className="adm-stat"><i className="ri-shield-user-line" /><div><b>{admins}</b><span>Admins</span></div></div>
      </div>

      <div className="admin-panel-header">
        <h2>Users</h2>
        <span className="admin-panel-count">
          {loading && users.length === 0 ? "…" : shown.length}
        </span>
        <div className="adm-search">
          <i className="ri-search-line" aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" aria-label="Search users" />
        </div>
      </div>

      {error && <div className="auth-alert error">{error}</div>}

      <div className="admin-users-table">
        <div className="admin-table-header">
          <span>Name</span>
          <span>Email</span>
          <span>Tokens</span>
          <span>Role</span>
          <span>Joined</span>
        </div>
        {loading && users.length === 0 && (
          <div role="status" aria-busy="true" aria-label="Loading users"><SkeletonRows rows={7} cols={5} /></div>
        )}
        {shown.map((u) => (
          <div
            key={u._id}
            className={`admin-table-row ${currentUserId === u._id ? "selected" : ""}`}
            onClick={() => {
              if (onUserSelect) onUserSelect(u._id);
              navigate(`/admin/users/${u._id}`, { replace: true });
            }}
          >
            <span data-label="Name" className="adm-name">{u.name}</span>
            <span data-label="Email" className="adm-email">{u.email}</span>
            <span data-label="Tokens">{u.tokens ?? 0}</span>
            <span data-label="Role">
              <span className="role-badge">{u.role}</span>
            </span>
            <span data-label="Joined">{new Date(u.createdAt).toLocaleDateString()}</span>
          </div>
        ))}
        {!loading && shown.length === 0 && (
          <div className="admin-table-empty">No users found.</div>
        )}
      </div>
    </div>
  );
}
