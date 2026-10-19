import { useState } from "react";
import { useNavigate } from "react-router-dom";
import adminService from "../../services/adminService";

export default function PromoCodeForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const formData = new FormData(e.target);
    const data = {
      code: formData.get("code"),
      type: formData.get("type"),
      value: Number(formData.get("value")),
      maxUsers: Number(formData.get("maxUsers")),
      expiresAt: formData.get("expiresAt"),
    };

    // Basic validation
    if (!data.code.trim()) {
      setError("Code is required.");
      return;
    }
    if (data.type !== "fixed" && data.type !== "percent") {
      setError('Type must be "fixed" or "percent".');
      return;
    }
    if (data.value <= 0) {
      setError("Value must be greater than 0.");
      return;
    }
    if (data.maxUsers <= 0) {
      setError("Max users must be at least 1.");
      return;
    }
    if (!data.expiresAt) {
      setError("Expires date is required.");
      return;
    }

    try {
      setLoading(true);
      await adminService.createPromoCode(data);
      setSuccess("Promo code created successfully!");
      e.target.reset();
      setTimeout(() => {
        navigate("/admin/promo-codes", { replace: true });
      }, 1500);
    } catch (err) {
      setError(err.message || "Failed to create promo code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-left">
          <h1 className="admin-title">Create Promo Code</h1>
          <p className="admin-subtitle">
            Add a new discount code for your users
          </p>
        </div>
        <div className="admin-header-right">
          <button
            className="admin-btn admin-btn-secondary"
            onClick={() => navigate("/admin/promo-codes", { replace: true })}
          >
            <i className="ri-arrow-left-line" aria-hidden="true"></i>
            Back to Promo Codes
          </button>
        </div>
      </header>

      <main className="admin-content">
        <div className="admin-panel">
          {error && <div className="auth-alert error" role="alert">{error}</div>}
          {success && <div className="auth-alert success" role="alert">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="admin-form-row">
              <div className="input">
                <label htmlFor="code">Promo Code</label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  placeholder="e.g. WELCOME10"
                  required
                />
              </div>
              <div className="input">
                <label htmlFor="type">Type</label>
                <select
                  id="type"
                  name="type"
                  defaultValue="fixed"
                  required
                >
                  <option value="fixed">Fixed Amount (e.g. $5 off)</option>
                  <option value="percent">Percentage (e.g. 10% off)</option>
                </select>
              </div>
            </div>

            <div className="admin-form-row">
              <div className="input">
                <label htmlFor="value">Value</label>
                <input
                  id="value"
                  name="value"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 10 or 10.00"
                  required
                />
              </div>
              <div className="input">
                <label htmlFor="maxUsers">Max Users</label>
                <input
                  id="maxUsers"
                  name="maxUsers"
                  type="number"
                  min="1"
                  placeholder="e.g. 100"
                  required
                />
              </div>
            </div>

            <div className="admin-form-row">
              <div className="input">
                <label htmlFor="expiresAt">Expires At</label>
                <input
                  id="expiresAt"
                  name="expiresAt"
                  type="datetime-local"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={loading}
            >
              <i className={loading ? "ri-loader-4-line is-spinning" : "ri-check-line"} aria-hidden="true"></i>
              {loading ? "Creating..." : "Create Promo Code"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
