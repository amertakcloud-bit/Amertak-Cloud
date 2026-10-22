import { NavLink } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import favIcon from "../assets/favicon/favicon.svg";

const LINKS = [
  { to: "/", key: "home" },
  { to: "/getstart", key: "getStart" },
  { to: "/tools", key: "tools" },
  { to: "/plants", key: "plantTitle" },
  { to: "/#TermOfServices", key: "termsOfService" },
];
const SOCIAL = [
  { href: "https://t.me/amertak_dev", icon: "ri-telegram-2-line", label: "@Amertak_Dev" },
  { href: "https://t.me/amertak_cloud", icon: "ri-telegram-line", label: "Amertak Cloud" },
  { href: "https://www.tiktok.com/@amertak.dev", icon: "ri-tiktok-line", label: "@amertak.dev" },
];

function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <div className="sf-grid">
        <div className="sf-col sf-about">
          <div className="sf-brand">
            <img src={favIcon} alt="" width={28} height={28} />
            <span className="grad">Amertak Cloud</span>
          </div>
          <p>{t("footerAbout")}</p>
        </div>

        <nav className="sf-col" aria-label={t("fastLink")}>
          <h4>{t("fastLink")}</h4>
          {LINKS.map((l) => (
            <NavLink key={l.key} to={l.to}>{t(l.key)}</NavLink>
          ))}
        </nav>

        <div className="sf-col">
          <h4>{t("contactUs")}</h4>
          <div className="sf-social">
            {SOCIAL.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                <i className={s.icon} aria-hidden="true"></i>
                <span>{s.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="sf-bottom">© 2026 Amertak Cloud. {t("footerRights")}</div>
    </footer>
  );
}

export default Footer;
