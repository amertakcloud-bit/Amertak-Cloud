import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

// Page: NotFound (404)
function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="page not-found">
      <i className="ri-compass-3-line not-found-icon" aria-hidden="true"></i>
      <h2 className="page-heading">{t("notFound")}</h2>
      <p className="page-subtitle">{t("notFoundMessage")}</p>
      <Link to="/" className="primary-btn">
        <i className="ri-arrow-left-line" aria-hidden="true"></i>
        {t("goHome")}
      </Link>
    </div>
  );
}

export default NotFound;
