import { useState, useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AOS from "aos";
import AOSRefresh from "./components/AOSRefresh";

import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import GuestRoute from "./components/GuestRoute";


// Tools Page
// Every page is code-split: the browser only downloads the page you open.
const Home = lazy(() => import("./pages/Home"));
const GetStart = lazy(() => import("./pages/GetStart"));
const TopUp = lazy(() => import("./pages/TopUp"));
const Plants = lazy(() => import("./pages/Plants"));
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/profile/Profile"));
const Register = lazy(() => import("./pages/auth/Register"));
const Login = lazy(() => import("./pages/auth/Login"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const PromoCodeForm = lazy(() => import("./pages/admin/PromoCodeForm"));
const Tools = lazy(() => import("./pages/Tools"));
const CloudShare = lazy(() => import("./pages/tools/CloudShare"));
const AuthPage = lazy(() => import("./pages/auth/Auth"));
// Heavier tool pages are code-split (they pull in wavesurfer / audio code only when opened).
const TextToSpeech = lazy(() => import("./pages/tools/TextToSpeech"));
const GenerateQr = lazy(() => import("./pages/tools/GenerateQr"));
const ImageToPrompt = lazy(() => import("./pages/tools/ImageToPrompt"));
const VideoDownloader = lazy(() => import("./pages/tools/VideoDownloader"));
const ExportAudio = lazy(() => import("./pages/tools/ExportAudio"));
const Srt = lazy(() => import("./pages/tools/Srt"));
const VideoEditor = lazy(() => import("./pages/tools/VideoEditor"));

function ToolFallback() {
  return <div className="tk-empty" style={{ minHeight: 240 }}><i className="ri-loader-4-line spin" /></div>;
}

// Auth Page
// ---- Motion animations ----
import { AnimatePresence, motion } from "motion/react";


// MainLayout wraps every page with Sidebar + Header (via <Outlet />).
// - Public pages stay public.
// - ProtectedRoute: /dashboard, /profile, /settings (guests → /login)
// - GuestRoute: /login, /register, /forgot-password (auth users → dashboard)
// Page transitions use motion/react with fade + slide animations
// Header & Sidebar stay static (don't re-animate on route changes)

// Canonical tool URLs (+ aliases used by older links / sidebar versions).
const TOOL_ROUTES = [
  { path: "tools/video-editor", Component: VideoEditor },
  { path: "tools/video-editor/:id", Component: VideoEditor },
  { path: "tools/tts", Component: TextToSpeech },
  { path: "tools/qr", Component: GenerateQr, aliases: ["tools/generate-qr"] },
  { path: "tools/image-prompt", Component: ImageToPrompt, aliases: ["tools/image-to-prompt"] },
  { path: "tools/downloader", Component: VideoDownloader, aliases: ["tools/video-downloader"] },
  { path: "tools/export-audio", Component: ExportAudio, aliases: ["tools/audio"] },
  { path: "tools/srt", Component: Srt, aliases: ["tools/speech-to-text", "tools/transcribe", "tools/captions"] },
];

function getPageAnimation(location, prevLocation) {
  const isHome = location.pathname === "/";

  // First visit (no history) → quick in
  if (!prevLocation) {
    return {
      initial: { opacity: 0, y: 16 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -16 },
      transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
    };
  }

  // Same route (deep link / resubscroll) → no animation
  if (location.pathname === prevLocation.pathname) {
    return null;
  }

  // Default crossfade between content pages
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  };
}

function App() {
  const location = useLocation();
  const [prev, setPrev] = useState(null);

  useEffect(() => {
    setPrev(location);
  }, [location]);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    AOS.init({
      disable: reduce,
      duration: 600,
      easing: "ease-out",
      once: false,
      //mirror: true,
      offset: 80,
      //anchorPlacement: "top-bottom"
    });
  }, []);

  const pageAnim = getPageAnimation(location, prev);
  const isFirstVisit = !prev;

  return (
    <AnimatePresence mode="wait">
      <AOSRefresh />
      <Routes location={location} key={location.pathname}>
        <Route element={<MainLayout />}>
          <Route
            index
            path="/"
            element={
              <motion.div {...getPageAnimation(location, prev)} key="home">
                <Home />
              </motion.div>
            }
          />
          <Route
            path="getstart"
            element={
              <motion.div {...getPageAnimation(location, prev)} key="getstart">
                <GetStart />
              </motion.div>
            }
          />
          <Route
            path="topup"
            element={
              <motion.div {...getPageAnimation(location, prev)} key="topup">
                <TopUp />
              </motion.div>
            }
          />
          <Route
            path="plans"
            element={
              <motion.div {...getPageAnimation(location, prev)} key="plants">
                <Plants />
              </motion.div>
            }
          />
          <Route
            path="tools"
            element={
              <motion.div {...getPageAnimation(location, prev)} key="tools">
                <Tools />
              </motion.div>
            }
          />
          <Route
            path="tools/cloud"
            element={
              <motion.div {...getPageAnimation(location, prev)} key="tools-cloud">
                <CloudShare />
              </motion.div>
            }
          />
          {TOOL_ROUTES.map(({ path, Component, aliases = [] }) =>
            [path, ...aliases].map((p, i) =>
              i === 0 ? (
                <Route
                  key={p}
                  path={p}
                  element={
                    <motion.div {...getPageAnimation(location, prev)} key={p}>
                      <Suspense fallback={<ToolFallback />}>
                        <Component />
                      </Suspense>
                    </motion.div>
                  }
                />
              ) : (
                // Old / alternative URLs keep working and redirect to the canonical one.
                <Route key={p} path={p} element={<Navigate to={`/${path}`} replace />} />
              )
            )
          )}

          {/* Protected — requires a valid session */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="dashboard"
              element={
                <motion.div
                  {...getPageAnimation(location, prev)}
                  key="dashboard"
                >
                  <Dashboard />
                </motion.div>
              }
            />
            <Route
              path="profile"
              element={
                <motion.div {...getPageAnimation(location, prev)} key="profile">
                  <Profile />
                </motion.div>
              }
            />
            <Route
              path="settings"
              element={
                <motion.div
                  {...getPageAnimation(location, prev)}
                  key="settings"
                >
                  <Settings />
                </motion.div>
              }
            />
          </Route>

          {/* Guest only — authenticated users are redirected away */}
          <Route element={<GuestRoute />}>
            <Route
              path="auth"
              element={
                <motion.div {...getPageAnimation(location, prev)} key="auth">
                  <AuthPage />
                </motion.div>
              }
            />
            <Route
              path="login"
              element={
                <motion.div {...getPageAnimation(location, prev)} key="login">
                  <Login />
                </motion.div>
              }
            />
            <Route
              path="register"
              element={
                <motion.div
                  {...getPageAnimation(location, prev)}
                  key="register"
                >
                  <Register />
                </motion.div>
              }
            />
            <Route
              path="forgot-password"
              element={
                <motion.div
                  {...getPageAnimation(location, prev)}
                  key="forgot-password"
                >
                  <ForgotPassword />
                </motion.div>
              }
            />
            {/* Legacy URLs kept working */}
            <Route
              path="account/login"
              element={<Navigate to="/login" replace />}
            />
            <Route
              path="account/register"
              element={<Navigate to="/register" replace />}
            />
          </Route>

          <Route
            path="*"
            element={
              <motion.div {...getPageAnimation(location, prev)} key="notfound">
                <NotFound />
              </motion.div>
            }
          />
        </Route>

        {/* Admin — /admin/login is public; the rest require the admin role */}
        <Route
          path="/admin/login"
          element={
            <motion.div {...getPageAnimation(location, prev)} key="admin-login">
              <Suspense fallback={<ToolFallback />}><AdminLogin /></Suspense>
            </motion.div>
          }
        />
        <Route element={<AdminLayout />}>
          <Route
            path="/admin/dashboard"
            element={
              <motion.div
                {...getPageAnimation(location, prev)}
                key="admin-dashboard"
              >
                <AdminDashboard />
              </motion.div>
            }
          />
          <Route
            path="/admin/users/:userId"
            element={
              <motion.div
                {...getPageAnimation(location, prev)}
                key={`admin-user-${location.pathname}`}
              >
                <AdminDashboard />
              </motion.div>
            }
          />
          <Route
            path="/admin/settings"
            element={<motion.div {...getPageAnimation(location, prev)} key="admin-settings"><AdminDashboard /></motion.div>}
          />
          <Route
            path="/admin/broadcast"
            element={<motion.div {...getPageAnimation(location, prev)} key="admin-broadcast"><AdminDashboard /></motion.div>}
          />
          <Route
            path="/admin/payments"
            element={<motion.div {...getPageAnimation(location, prev)} key="admin-payments"><AdminDashboard /></motion.div>}
          />
          <Route
            path="/admin/audit"
            element={<motion.div {...getPageAnimation(location, prev)} key="admin-audit"><AdminDashboard /></motion.div>}
          />
          <Route
            path="/admin/promo-codes"
            element={
              <motion.div
                {...getPageAnimation(location, prev)}
                key="admin-promos"
              >
                <AdminDashboard />
              </motion.div>
            }
          />
          <Route
            path="/admin/promo-codes/new"
            element={
              <motion.div
                {...getPageAnimation(location, prev)}
                key="admin-promo-new"
              >
                <PromoCodeForm />
              </motion.div>
            }
          />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

export default App;
