import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

// Language
import { LanguageProvider } from "./context/LanguageContext.jsx";
// Auth (wraps App so ProtectedRoute/GuestRoute can read the session)
import { AuthProvider } from "./context/AuthContext.jsx";
// Toasts + confirm dialog
import { FeedbackProvider } from "./components/ui/Feedback.jsx";

// ---- AOS (Scroll Animations) ----
import "remixicon/fonts/remixicon.css";
// Note: AOS CSS is included via react-aos package or will be loaded by AOS init
//import "aos/dist/aos.css";
import "aos/dist/aos.css";
import "./styles/footer.css";
import "./styles/ui-select.css";
import "./styles/tools.css";
import "./styles/variables.css";
import "./styles/global.css";
import "./styles/layout.css";
import "./styles/plants.css";
import "./styles/payment.css";
import "./styles/sidebar.css";
import "./styles/socails.css";
import "./styles/header.css";
import "./styles/home.css";
import "./styles/pages.css";
import "./styles/auth.css";
import "./styles/admin-dashboard.css";
import "./styles/admin-clean.css";

// TOOLS
import './styles/tools/cloudShare.css'
import "./styles/tools/tts.css";
import "./styles/tools/toolkit.css";
import "./styles/feedback.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <FeedbackProvider>
            <App />
          </FeedbackProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
