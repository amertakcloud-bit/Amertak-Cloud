import { useState, useEffect } from "react";
import adminService from "../../services/adminService";

export default function UserDetailPanel({ userId, onBack, onTokenAdded }) {
  const [user, setUser] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addedTokens, setAddedTokens] = useState(null);

  async function loadUser() {
    try {
      setLoading(true);
      setError("");
      const data = await adminService.getUserDetail(userId);
      setUser(data.data.user);
      setPayments(data.data.recentPayments || []);
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

  async function handleAddTokens(e) {
    e.preventDefault();
    const tokens = Number(e.target.tokens.value);
    if (!tokens || tokens <= 0 || !Number.isInteger(tokens)) {
      setError("Please enter a valid number of tokens.");
      return;
    }

    try {
      const data = await adminService.addTokens(userId, tokens);
      setAddedTokens(data.data);
      setUser(data.data.user);
      loadUser(); // Refresh payments too
      e.target.tokens.value = "";
    } catch (err) {
      setError(err.message || "Failed to add tokens.");
    }
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
          Added <strong>{addedTokens.added} tokens</strong> to {user?.email}. New balance:{" "}
          <strong>{addedTokens.user?.tokens}</strong>
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

      {/* Add tokens form */}
      <form className="admin-add-tokens-form" onSubmit={handleAddTokens}>
        <label htmlFor="tokens">Add Tokens to User</label>
        <input
          id="tokens"
          name="tokens"
          type="number"
          min="1"
          placeholder="Enter tokens (e.g. 500)"
        />
        <button type="submit" className="admin-btn admin-btn-primary">
          <i className="ri-add-line" aria-hidden="true"></i>
          Add Tokens
        </button>
      </form>

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
