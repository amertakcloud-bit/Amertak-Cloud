import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../components/ui/Feedback";
import GeminiKeyPanel, { useGeminiAccess } from "../components/tools/GeminiKey";
import useToolsStatus from "../hooks/useToolsStatus";
import "../styles/settings.css";

const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

// Page: Settings — everything a user may want to change in one place.
function Settings() {
  const { language, toggleLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const { toast } = useFeedback();
  const { data: toolsStatus } = useToolsStatus();
  const access = useGeminiAccess(toolsStatus);
  const [theme, setThemeState] = useState(() => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"));
  const [reduce, setReduce] = useState(() => read("reduceMotion", "0") === "1");

  useEffect(() => {
    if (reduce) document.documentElement.setAttribute("data-motion", "reduce"); else document.documentElement.removeAttribute("data-motion");
    write("reduceMotion", reduce ? "1" : "0");
  }, [reduce]);

  const setTheme = (v) => { setThemeState(v); window.dispatchEvent(new CustomEvent("amertak:theme", { detail: v })); };
  const setLang = (v) => { if (v !== language) toggleLanguage(); };
  const reset = () => {
    try { ["theme", "reduceMotion"].forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
    setReduce(false); setTheme("dark"); if (language !== "en") toggleLanguage();
    toast.success(t("settingsDone"));
  };
  const seg = (items, value, onPick, label) => (
    <div className="st-seg" role="radiogroup" aria-label={label}>
      {items.map(([v, text, icon]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? "on" : ""} onClick={() => onPick(v)}>
          {icon && <i className={icon} aria-hidden="true" />}{text}
        </button>
      ))}
    </div>
  );

  return (
    <div className="page st-page">
      <h2 className="page-heading">{t("settings")}</h2>
      <p className="page-subtitle">{t("settingsSubtitle")}</p>

      <div className="st-grid">
        <section className="st-card">
          <h3 className="st-h"><i className="ri-palette-line" aria-hidden="true" /> {t("settingsAppearance")}</h3>
          <div className="st-row">
            <div><b>{t("settingsTheme")}</b></div>
            {seg([["dark", t("settingsDark"), "ri-moon-line"], ["light", t("settingsLight"), "ri-sun-line"]], theme, setTheme, t("settingsTheme"))}
          </div>
          <div className="st-row">
            <div><b>{t("language")}</b><span>{t("settingsLangHint")}</span></div>
            {seg([["en", "English"], ["km", "ខ្មែរ"]], language, setLang, t("language"))}
          </div>
          <div className="st-row">
            <div><b>{t("settingsReduce")}</b><span>{t("settingsReduceHint")}</span></div>
            <button type="button" role="switch" aria-checked={reduce} aria-label={t("settingsReduce")} className={`st-switch ${reduce ? "on" : ""}`} onClick={() => setReduce((v) => !v)}><i /></button>
          </div>
        </section>

        <section className="st-card">
          <h3 className="st-h"><i className="ri-user-3-line" aria-hidden="true" /> {t("settingsAccount")}</h3>
          {user ? (
            <>
              <div className="st-who">
                {user.avatar ? <img src={user.avatar} alt="" /> : <span className="st-av"><i className="ri-user-line" aria-hidden="true" /></span>}
                <div><b>{user.name}</b><span>{user.email}</span></div>
              </div>
              <div className="st-stats">
                <div><span>{t("settingsTokens")}</span><b>{user.tokens ?? 0}</b></div>
                <div><span>{t("settingsRole")}</span><b>{user.role || "user"}</b></div>
              </div>
              <div className="st-actions">
                <Link className="tk-btn small" to="/profile"><i className="ri-edit-2-line" aria-hidden="true" />{t("settingsProfile")}</Link>
                <Link className="tk-btn ghost small" to="/topup"><i className="ri-coin-line" aria-hidden="true" />{t("settingsTopUp")}</Link>
                <button type="button" className="tk-btn ghost small" onClick={logout}><i className="ri-logout-box-r-line" aria-hidden="true" />{t("settingsLogout")}</button>
              </div>
            </>
          ) : (
            <p className="st-muted">{t("settingsLogin")} <Link to="/login">{t("login")}</Link></p>
          )}
        </section>

        <section className="st-card st-wide">
          <h3 className="st-h"><i className="ri-key-2-line" aria-hidden="true" /> {t("settingsGemini")}</h3>
          <p className="st-muted">{t("settingsGeminiHint")}</p>
          <GeminiKeyPanel status={toolsStatus} access={access} />
        </section>

        <section className="st-card st-wide">
          <h3 className="st-h"><i className="ri-database-2-line" aria-hidden="true" /> {t("settingsData")}</h3>
          <p className="st-muted">{t("settingsDataHint")}</p>
          <div className="st-actions"><button type="button" className="tk-btn ghost small" onClick={reset}><i className="ri-restart-line" aria-hidden="true" />{t("settingsReset")}</button></div>
        </section>
      </div>
    </div>
  );
}

export default Settings;
