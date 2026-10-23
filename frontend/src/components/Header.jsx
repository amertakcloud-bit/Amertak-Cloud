import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { NavLink } from "react-router-dom";

// this token function is example
function userToken() {

}
// Header
// Top bar with: desktop sidebar toggle, mobile menu button, page title,
// language toggle, theme toggle, and a profile button.
function Header({ title, onMenuClick, onToggleSidebar, isSidebarCollapsed, theme, onThemeToggle }) {
  const { language, toggleLanguage, t } = useLanguage();
  const { user } = useAuth();

  return (
    <header className="header">
      <div className="header-left">
        {/*{user?.role === "admin" && (
          <NavLink to="/" className="icon-btn" aria-label="Back to default page" title="Back to default page">
            <i className="ri-arrow-left-line" aria-hidden="true"></i>
          </NavLink>
        )}*/}

        {/* Desktop sidebar collapse/expand toggle */}
        <button
          type="button"
          className="icon-btn desktop-only"
          onClick={onToggleSidebar}
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <i
            className={isSidebarCollapsed ? "ri-arrow-right-s-line" : "ri-arrow-left-s-line"}
            aria-hidden="true"
          ></i>
        </button>

        {/* Mobile sidebar button */}
        <button
          type="button"
          className="icon-btn mobile-only"
          onClick={onMenuClick}
          aria-label="Open sidebar menu"
        >
          <i className="ri-menu-line" aria-hidden="true"></i>
        </button>

        <h1 className="header-title">{title}</h1>
      </div>

      <div className="header-right">

        {/* Token balance */}
        <button
          type="button"
          className="icon-btn token-btn"
          aria-label={t("tokens")}
          title={t("tokens")}
        >
          <i className="ri-exchange-funds-line" aria-hidden="true"></i>
          {user && <span className="token-badge">{user.tokens ?? 0}</span>}
        </button>

        {/* Language toggle */}
        <button
          type="button"
          className="icon-btn lang-toggle"
          onClick={toggleLanguage}
          aria-label={t("language")}
          title={t("language")}
        >
          <i className="ri-global-line" aria-hidden="true"></i>
          <span>{language === "en" ? "EN" : "ខ្មែរ"}</span>
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          className="icon-btn"
          onClick={onThemeToggle}
          aria-label={t("theme")}
        >
          <i
            className={theme === "dark" ? "ri-sun-line" : "ri-moon-line"}
            aria-hidden="true"
          ></i>
        </button>

        {/* User/profile button → /profile when signed in, /login when a guest */}
        <NavLink
          to="/profile"
          className="icon-btn profile-btn"
          aria-label={t("profile")}
          title={t("profile")}
        >
          {user?.avatar ? (
            <img className="header-avatar" src={user.avatar} alt={user.name} />
          ) : (
            <i className="ri-user-line" aria-hidden="true"></i>
          )}
        </NavLink>
      </div>
    </header>
  );
}

export default Header;
