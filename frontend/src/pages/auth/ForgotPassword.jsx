import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import authService from "../../services/authService";

// Page: Forgot Password
// Asks for the account email. The API always answers with the same generic
// message (no account enumeration). Email delivery itself is not wired yet.
function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const data = await authService.forgotPassword(email.trim());
      setSuccess(data?.message || "If an account exists, reset instructions have been sent.");
      setEmail("");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="card glass">
        <div className="login-heading">
          <i className="ri-lock-password-line"></i>
          <h1 className="reflect">{t("forgotPasswordTitle")}</h1>
        </div>

        <p className="auth-subtitle">{t("forgotPasswordSubtitle")}</p>

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
          </div>

          <div className="button">
            <button type="submit" disabled={loading} className={loading ? "is-loading" : ""}>
              <i
                className={loading ? "ri-loader-4-line is-spinning" : "ri-send-ins-line"}
                aria-hidden="true"
              ></i>
              {loading ? t("sending") : t("sendReset")}
            </button>
          </div>

          <p className="auth-switch">
            <NavLink to="/login">
              <i className="ri-arrow-left-line" aria-hidden="true"></i> {t("backToLogin")}
            </NavLink>
          </p>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;
