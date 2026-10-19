import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import adminService from "../../services/adminService";

export default function UsersListView({ onUserSelect, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h2>Users</h2>
        <span className="admin-panel-count">
          {loading && users.length === 0 ? "…" : users.length}
        </span>
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
          <div className="admin-table-empty">
            <i className="ri-loader-4-line is-spinning" aria-hidden="true"></i>{" "}
            Loading users…
          </div>
        )}
        {users.map((u) => (
          <div
            key={u._id}
            className={`admin-table-row ${currentUserId === u._id ? "selected" : ""}`}
            onClick={() => {
              if (onUserSelect) onUserSelect(u._id);
              navigate(`/admin/users/${u._id}`, { replace: true });
            }}
          >
            <span>{u.name}</span>
            <span>{u.email}</span>
            <span>{u.tokens ?? 0}</span>
            <span>
              <span className="role-badge">{u.role}</span>
            </span>
            <span>{new Date(u.createdAt).toLocaleDateString()}</span>
          </div>
        ))}
        {users.length === 0 && (
          <div className="admin-table-empty">No users found.</div>
        )}
      </div>
    </div>
  );
}
