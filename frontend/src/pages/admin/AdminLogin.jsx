import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import adminService from "../../services/adminService";

function AdminLogin() {
  const { adminLogin } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await adminService.login({ email: email.trim(), password });
      // Store the admin user in AuthContext so ProtectedRoute can check role
      await adminLogin(data.data.user);
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Admin login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="card glass">
        <div className="login-heading">
          <i className="ri-shield-user-line"></i>
          <h1 className="reflect">{t("adminLogin")}</h1>
        </div>

        {error && (
          <div className="auth-alert error" role="alert">
            <i className="ri-error-warning-line" aria-hidden="true"></i>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="input">
            <p>{t("email")}</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
            />
          </div>

          <div className="input">
            <p>{t("password")}</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          <div className="button">
            <button
              type="submit"
              disabled={loading}
              className={loading ? "is-loading" : ""}
            >
              <i className={loading ? "ri-loader-4-line is-spinning" : "ri-login-circle-line"} aria-hidden="true"></i>
              {loading ? t("loggingIn") : t("login")}
            </button>
          </div>

          <p className="auth-switch">
            <Link to="/login">{t("backToLogin")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
