import { useState, useEffect, Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useLanguage } from "../context/LanguageContext";
import useDocumentTitle from "../hooks/useDocumentTitle";

// Maps a route path to a translation key used as the header title.
const pageTitleKeys = {
  "/": "home",
  "/getstart": "getStart",
  "/topup": "TopUp",
  "/plants": "viewPlants",
  "/dashboard": "dashboard",
  "/projects": "projects",
  "/projects/active": "activeProjects",
  "/projects/archived": "archivedProjects",
  "/settings": "settings",
  "/profile": "profile",
  "/login": "login",
  "/register": "register",
  "/forgot-password": "forgotPasswordTitle",

  // Tools
  "/tools": "toolsTitle",
  "/tools/cloud": "CloudShareTitle",
  "/tools/downloader": "VideoDownloader",
  "/tools/export-audio": "ExportAudio",
  "/tools/srt": "Srt",
  "/tools/image-prompt": "ImageToPrompt",
  "/tools/tts": "TextToSpeech",
  "/tools/qr": "GenerateQr",
  "/auth": "login",
};

// MainLayout
// Shared layout for every page: Sidebar + Header + Outlet (page content).
// Pages never re-create Sidebar/Header themselves.
function MainLayout() {
  const { t } = useLanguage();
  const location = useLocation();

  // Sidebar (mobile open/close state)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Sidebar (desktop collapsed/expanded state — persisted)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebarCollapsed") === "true";
    } catch {
      return false;
    }
  });

  function toggleSidebarCollapsed() {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebarCollapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  // Theme
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") || "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // localStorage not available, ignore
    }
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  // trailing slash / unknown paths: normalise, then fall back to "not found"
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const titleKey = pageTitleKeys[path] || (path.startsWith("/admin") ? "adminDashboard" : "notFound");
  const pageTitle = t(titleKey);
  useDocumentTitle(path === "/" ? "" : pageTitle);

  return (
    <div className={"app-shell" + (isSidebarCollapsed ? " sidebar-collapsed" : "")}>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
      />

      <div className="app-main">
        <Header
          title={pageTitle}
          onMenuClick={() => setIsSidebarOpen(true)}
          onToggleSidebar={toggleSidebarCollapsed}
          isSidebarCollapsed={isSidebarCollapsed}
          theme={theme}
          onThemeToggle={toggleTheme}
        />

        <main className="page-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="page-content-inner"
            >
              <Suspense fallback={<div className="tk-empty" style={{ minHeight: 240 }}><i className="ri-loader-4-line spin" /></div>}>
            <Outlet />
          </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default MainLayout;
