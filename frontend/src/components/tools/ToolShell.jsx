import { useLanguage } from "../../context/LanguageContext";

// Page header shared by all tool pages.
export default function ToolShell({ icon, titleKey, subKey, children, actions }) {
  const { t } = useLanguage();
  return (
    <div className="tk-page" data-aos="fade-in">
      <div className="tk-head">
        <div className="tk-head-icon"><i className={icon} aria-hidden="true" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="reflect">{t(titleKey)}</h1>
          <p>{t(subKey)}</p>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}
