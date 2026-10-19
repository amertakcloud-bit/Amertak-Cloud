import { useState } from "react";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import authService from "../services/authService";

// Page: Login
// Keeps the original glass/purple card design, wired to POST /api/auth/login.
export default function LoginComponent() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Page
  const [page, setPage] = useState("login")

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => {
    const errorCode = searchParams.get("error");

    if (errorCode === "google_failed") {
      return "Google sign-in failed or was cancelled. Please try again.";
    }
    if (errorCode === "telegram_failed") {
      return "Telegram sign-in failed or was cancelled. Please try again.";
    }
    if (errorCode === "telegram_not_configured") {
      return "Telegram login is not configured yet. Please use email/password or Google login.";
    }

    return "";
  });
  const [success, setSuccess] = useState(location.state?.message || "");

  // Send the user back to the page they originally tried to open.
  const redirectTo = location.state?.from || "/dashboard";

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await login({ email: email.trim(), password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function googleLogin() {
    // Full browser navigation → server sets the HTTP-only cookie → redirects back.
    window.location.href = authService.googleUrl();
  }
  function telegramLogin() {
    // Full browser navigation → server sets the HTTP-only cookie → redirects back.
    window.location.href = authService.telegramUrl();
  }

  return (
    <>
        {/*<div className="login-heading">
          <i className="ri-shield-user-line"></i>
          <h1 className="reflect">{t("login")}</h1>
        </div>*/}

        {error && (
          <div className="auth-alert error" role="alert">
            <i className="ri-error-warning-line" aria-hidden="true"></i>
            {error}
          </div>
        )}
        {success && (
          <div className="auth-alert success" role="status">
            <i className="ri-checkbox-circle-line" aria-hidden="true"></i>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Inputs */}
          <div className="input">
            <p>{t("email")}</p>
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <p>{t("password")}</p>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter Password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="auth-links-row">
              <NavLink to="/forgot-password" className="auth-link">
                {t("forgotPassword")}
              </NavLink>
            </div>
          </div>

          {/* Submit buttons */}
          <div className="button">
            <button type="submit" disabled={loading} className={loading ? "is-loading" : ""}>
              <i
                className={loading ? "ri-loader-4-line is-spinning" : "ri-flashlight-fill"}
                aria-hidden="true"
              ></i>
              {loading ? t("loggingIn") : t("login")}
            </button>
            <button type="button" onClick={googleLogin} disabled={loading}>
              <i className="ri-google-fill" aria-hidden="true"></i>
              {t("googleLogin")}
            </button>
            <button type="button" onClick={telegramLogin} disabled={loading}>
              <i className="ri-telegram-fill" aria-hidden="true"></i>
              {t("telegramLogin")}
            </button>
          </div>

          {/*<p className="auth-switch">
            {t("noAccount")}{" "}
            <NavLink to="/register">{t("registerNow")}</NavLink>
          </p>*/}
        </form>
    </>
  );
}
