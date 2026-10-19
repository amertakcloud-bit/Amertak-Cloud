import { useEffect } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { Link, Navigate } from "react-router-dom";

// Page: Dashboard
function Dashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();

  useEffect(() => {
    // Re-trigger AOS animations after route change
    if (typeof window !== "undefined" && window.AOS) {
      window.AOS.refresh();
    }
  }, []);

  if (user?.role === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const stats = [
    { icon: "ri-folder-3-line", labelKey: "totalProjects", value: "12" },
    { icon: "ri-team-line", labelKey: "activeUsers", value: "348" },
    { icon: "ri-checkbox-circle-line", labelKey: "tasksDone", value: "76%" },
  ];

  const activity = [
    "Updated the sidebar dropdown animation",
    "Fixed dark theme contrast on cards",
    "Added Khmer translations for Settings page",
    "Refactored MainLayout to use Outlet",
  ];

  const initials = (user?.name || "?")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="page" data-aos="fade-up">
      <h2 className="page-heading" data-aos="fade-up" data-aos-delay="50">
        {t("dashboard")}
      </h2>
      <p className="page-subtitle" data-aos="fade-up" data-aos-delay="100">
        {t("dashboardSubtitle")}
      </p>

      {/* Signed-in user */}
      {user && (
        <div
          className="card glass welcome-card"
          data-aos="zoom-in"
          data-aos-delay="150"
        >
          {user.avatar ? (
            <img className="profile-avatar" src={user.avatar} alt={user.name} />
          ) : (
            <div className="profile-avatar profile-avatar-fallback" aria-hidden="true">
              {initials}
            </div>
          )}
          <div>
            <h3 className="card-title">
              {t("welcomeBack")}, <strong>{user.name}</strong>!
            </h3>
            <p className="welcome-email">
              <i className="ri-mail-line" aria-hidden="true"></i> {user.email}
            </p>
            <p className="welcome-tokens">
              <i className="ri-price-tag-3-line" aria-hidden="true"></i>{" "}
              {t("tokens")}: <strong>{user.tokens ?? 0}</strong>
            </p>
          </div>
          <Link to="/profile" className="primary-btn welcome-profile-btn">
            <i className="ri-user-3-line" aria-hidden="true"></i>
            {t("profile")}
          </Link>
        </div>
      )}

      {/* Statistic cards */}
      <div
        className="stat-grid"
        data-aos="fade-up"
        data-aos-delay="200"
      >
        {stats.map((stat) => (
          <div className="card glass stat-card" key={stat.labelKey}>
            <i className={stat.icon + " card-icon"} aria-hidden="true"></i>
            <div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{t(stat.labelKey)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="card glass" data-aos="fade-up" data-aos-delay="250">
        <h3 className="card-title">{t("recentActivity")}</h3>
        <ul className="activity-list">
          {activity.map((item, index) => (
            <li key={index}>
              <i className="ri-checkbox-blank-circle-fill activity-dot" aria-hidden="true"></i>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Dashboard;
