import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Footer from "../components/Footer";

function AdminLayout() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebarCollapsed") === "true";
    } catch {
      return false;
    }
  });
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") || "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      navigate("/admin/login", { replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  if (authLoading) {
    return (
      <div className="auth-loader" role="status" aria-label="Loading">
        <i className="ri-loader-4-line auth-loader-icon" aria-hidden="true"></i>
        <p>Loading…</p>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  const title = location.pathname.startsWith("/admin/promo-codes")
    ? t("promoCodes")
    : t("adminDashboard");

  return (
    <div className={"app-shell" + (isSidebarCollapsed ? " sidebar-collapsed" : "")}>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
      />

      <div className="app-main">
        <Header
          title={title}
          onMenuClick={() => setIsSidebarOpen(true)}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          isSidebarCollapsed={isSidebarCollapsed}
          theme={theme}
          onThemeToggle={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
        />

        <div className="admin-page-actions">
          <button type="button" className="admin-back-btn" onClick={() => navigate("/")}>
            <i className="ri-arrow-left-line" aria-hidden="true"></i>
            Back
          </button>
        </div>

        <main className="page-content">
          <Outlet />
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default AdminLayout;
