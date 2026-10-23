import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import adminService from "../../services/adminService";
import { useFeedback } from "../../components/ui/Feedback";

export default function PromoCodes() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { confirm } = useFeedback();

  async function loadCodes() {
    try {
      setLoading(true);
      setError("");
      const data = await adminService.getPromoCodes();
      setCodes(data.data?.codes || []);
    } catch (err) {
      setError(err.message || "Failed to load promo codes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCodes();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      code: formData.get("code"),
      type: formData.get("type"),
      value: Number(formData.get("value")),
      maxUsers: Number(formData.get("maxUsers")),
      expiresAt: formData.get("expiresAt"),
    };

    try {
      await adminService.createPromoCode(data);
      e.target.reset();
      loadCodes();
    } catch (err) {
      setError(err.message || "Failed to create promo code.");
    }
  }

  async function handleDelete(id) {
    const ok = await confirm({
      title: "Delete promo code?",
      message: "This cannot be undone.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminService.deletePromoCode(id);
      loadCodes();
    } catch (err) {
      setError(err.message || "Failed to delete promo code.");
    }
  }

  async function handleToggleActive(id, isActive) {
    try {
      if (isActive) {
        await adminService.deactivatePromoCode(id);
      } else {
        await adminService.activatePromoCode(id);
      }
      loadCodes();
    } catch (err) {
      setError(err.message || "Failed to update promo code status.");
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h2>Manage discount codes</h2>
        <span className="admin-panel-action">
          <button
            className="admin-btn admin-btn-primary"
            onClick={() => navigate("/admin/promo-codes/new", { replace: true })}
          >
            <i className="ri-add-line" aria-hidden="true"></i>
            Create Promo Code
          </button>
        </span>
      </div>

      {error && <div className="auth-alert error">{error}</div>}
      {loading && (
        <div className="admin-table-empty">Loading promo codes…</div>
      )}

      <div className="admin-promo-codes-table">
          <div className="admin-table-header">
            <span>Code</span>
            <span>Type</span>
            <span>Value</span>
            <span>Status</span>
            <span>Used / Max</span>
            <span>Expires</span>
            <span>Actions</span>
          </div>
          {codes.map((p) => (
            <div key={p._id} className="admin-table-row">
              <strong className="adm-name">{p.code}</strong>
              <span data-label="Type">{p.type}</span>
              <span data-label="Value">
                {p.type === "fixed" ? `$${p.value}` : `${p.value}%`}
              </span>
              <span data-label="Status">
                <button
                  className={`admin-toggle-btn ${p.isActive ? "active" : "inactive"}`}
                  onClick={() => handleToggleActive(p._id, p.isActive)}
                >
                  {p.isActive ? "Active" : "Inactive"}
                </button>
              </span>
              <span data-label="Used / Max">
                {p.usedCount} / {p.maxUsers}
              </span>
              <span data-label="Expires">
                {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : ""}
              </span>
              <span>
                <button
                  className="admin-btn admin-btn-small admin-btn-danger"
                  onClick={() => handleDelete(p._id)}
                >
                  <i className="ri-delete-bin-line" aria-hidden="true"></i>
                </button>
              </span>
            </div>
          ))}
          {codes.length === 0 && !loading && (
            <div className="admin-table-empty">No promo codes found.</div>
          )}
        </div>

        <div className="admin-table-actions">
          <button
            className="admin-btn admin-btn-primary"
            onClick={() => navigate("/admin/promo-codes/new", { replace: true })}
          >
            <i className="ri-add-line" aria-hidden="true"></i>
            Create New Promo Code
          </button>
        </div>
    </div>
  );
}
