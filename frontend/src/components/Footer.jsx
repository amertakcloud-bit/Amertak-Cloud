import { useLanguage } from "../context/LanguageContext";
import favIcon from '../assets/favicon/favicon.svg'

function Footer() {

    const { t } = useLanguage();
  return (
    <footer>
      <div className="brand">
        <img src={favIcon} alt="icon" width={30}/>
        <span className="grad">Amertak Cloud</span>
      </div>

      <div className="footer-info">
        {/* About Us */}
        <div className="about-use">
            <span><i class="ri-information-line"></i><strong>{t('aboutUs')}</strong></span>
            <p>This website, we make it for user easy to transcript, generate voice from video.</p>
        </div>

        {/* fast Link */}
        <div className="fast-link">
            <span><i class="ri-link-m"></i><strong>{t('fastLink')}</strong></span>
            <a>home</a>
            <a>home</a>
            <a>home</a>
        </div>

        {/* More Social */}
        <div className="social">
          <span><i class="ri-send-ins-line"></i><strong>{t('contactUs')}</strong></span>
          <a href="https://t.me/amertak_dev">
            <i className="ri-telegram-line"></i>
            <strong>@Amertak_Dev</strong>
          </a>
          <a href="https://t.me/amertak_cloud">
            <i className="ri-telegram-line"></i>
            <strong>Amertak Cloud</strong>
          </a>
          <a href="https://t.me/amertak_dev">
            <i className="ri-tiktok-line"></i>
            <strong>@amertak.dev</strong>
          </a>
        </div>

      </div>
        <p className="f-text">@2026 - Amertak Cloud. All right reverse</p>
    </footer>
  );
}

export default Footer;
