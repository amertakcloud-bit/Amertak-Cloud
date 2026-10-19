import { useLanguage } from "../context/LanguageContext";

// Page: Settings
function Settings() {
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <div className="page">
      <h2 className="page-heading">{t("settings")}</h2>
      <p className="page-subtitle">{t("settingsSubtitle")}</p>

      <div className="card glass">
        <h3 className="card-title">{t("language")}</h3>
        <p>Current: {language === "en" ? "English" : "ខ្មែរ"}</p>
        <button type="button" className="primary-btn" onClick={toggleLanguage}>
          <i className="ri-global-line" aria-hidden="true"></i>
          {t("language")}: {language === "en" ? "EN / ខ្មែរ" : "ខ្មែរ / EN"}
        </button>
      </div>
    </div>
  );
}

export default Settings;
