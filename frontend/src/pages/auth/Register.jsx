import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import authService from "../../services/authService";

// Page: Register
// Same glass card design as Login, wired to POST /api/auth/register.
function Register() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Show the free plan bonus in the success message.
  const [success, setSuccess] = useState(
    location.state?.message ||
      "Welcome! Your Free Plan (150 tokens) is available in your account."
  );

  function updateField(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (form.password !== form.confirmPassword) {
      setError(t("passwordsDoNotMatch"));
      return;
    }
    if (!acceptedTerms) {
      setError(t("acceptTermsFirst"));
      return;
    }

    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="card glass">
        <div className="login-heading">
          <i className="ri-shield-user-line"></i>
          <h1 className="reflect">{t("register")}</h1>
        </div>

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
            <p>{t("name")}</p>
            <input
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Jonshon"
              value={form.name}
              onChange={updateField("name")}
              required
            />

            <p>{t("email")}</p>
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="example@gmail.com"
              value={form.email}
              onChange={updateField("email")}
              required
            />

            <p>{t("password")}</p>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="Enter Password..."
              value={form.password}
              onChange={updateField("password")}
              required
            />

            <p>{t("confirmPassword")}</p>
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Enter Confirm Password..."
              value={form.confirmPassword}
              onChange={updateField("confirmPassword")}
              required
            />

            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <span>
                {t("iReadAndAgree")} <NavLink to="/#TermOfServices" rel="noreferrer">{t("termsOfService")}</NavLink>
              </span>
            </label>
          </div>

          {/* Submit buttons */}
          <div className="button">
            <button type="submit" disabled={loading} className={loading ? "is-loading" : ""}>
              <i
                className={loading ? "ri-loader-4-line is-spinning" : "ri-flashlight-fill"}
                aria-hidden="true"
              ></i>
              {loading ? t("registering") : t("register")}
            </button>
          </div>

          <p className="auth-switch">
            {t("haveAccount")}{" "}
            <NavLink to="/login">{t("loginNow")}</NavLink>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Register;
