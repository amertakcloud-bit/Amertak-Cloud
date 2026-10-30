import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";

// Page: Profile
// Shows the signed-in user's information and allows editing name/avatar + logout.
function Profile() {
  const { user, loading, updateProfile, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (loading) return null; // ProtectedRoute already shows the loader

  async function handleSave(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      await updateProfile({ name: name.trim(), avatar: avatar.trim() });
      setSuccess(t("profileSaved"));
    } catch (err) {
      setError(err.message || "Could not update the profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  const initials = (user?.name || "?")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="page">
      <h2 className="page-heading">{t("profile")}</h2>
      <p className="page-subtitle">{t("profileSubtitle")}</p>

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

      {/* Account overview */}
      <div className="card glass profile-card">
        {user?.avatar ? (
          <img className="profile-avatar" src={user.avatar} alt={user.name} />
        ) : (
          <div className="profile-avatar profile-avatar-fallback" aria-hidden="true">
            {initials}
          </div>
        )}

        <div className="profile-info">
          <h3 className="card-title">{user?.name}</h3>
          <p>
            <i className="ri-mail-line" aria-hidden="true"></i> {user?.email}
          </p>
          <p>
            <i className="ri-shield-user-line" aria-hidden="true"></i>{" "}
            {user?.provider === "google" ? "Google account" : "Local account"}
            {" · "}
            {t("role")}: {user?.role}
          </p>
          <p>
            <i className="ri-calendar-line" aria-hidden="true"></i>{" "}
            {t("memberSince")}: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
          </p>
          <p className="profile-tokens">
            <i className="ri-price-tag-3-line" aria-hidden="true"></i>{" "}
            {t("tokens")}: <strong>{user?.tokens ?? 0}</strong>
          </p>
        </div>
      </div>

      {/* Edit profile */}
      <form className="card glass" onSubmit={handleSave}>
        <h3 className="card-title">{t("editProfile")}</h3>

        <div className="input">
          <p>{t("name")}</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            minLength={2}
          />

          <p>{t("avatarUrl")}</p>
          <input
            type="url"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://example.com/avatar.png"
          />
        </div>

        <div className="button profile-btn">
          <button type="submit" disabled={saving} className={saving ? "is-loading" : "primary-btn"}>
            <i
              className={saving ? "ri-loader-4-line is-spinning" : "ri-save-3-line"}
              aria-hidden="true"
            ></i>
            {saving ? t("saving") : t("saveChanges")}
          </button>
          <button type="button" onClick={handleLogout} disabled={loggingOut} className="primary-btn">
            <i
              className={loggingOut ? "ri-loader-4-line is-spinning" : "ri-logout-box-r-line"}
              aria-hidden="true"
            ></i>
            {t("logout")}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Profile;
