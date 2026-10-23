import { useLanguage } from "../context/LanguageContext";
import { NavLink } from "react-router-dom";
const FEATURES = [
  { id: 1, icon: "ri-closed-captioning-line", items: ["a", "b", "c", "d"], path: "/tools/srt" },
  { id: 2, icon: "ri-movie-2-line", items: ["a", "b", "c", "d"], path: "/tools/video-editor" },
  { id: 3, icon: "ri-translate-2", items: ["a", "b", "c", "d"], path: "/tools/video-editor" },
  { id: 4, icon: "ri-text-to-speech-line", items: ["a", "b", "c", "d"], path: "/tools/tts" },
  { id: 5, icon: "ri-image-ai-line", items: ["a", "b", "c"], path: "/tools/image-prompt" },
  { id: 6, icon: "ri-cloud-line", items: ["a", "b", "c"], path: "/tools/cloud" },
  { id: 7, icon: "ri-tools-line", items: ["a", "b", "c", "d"], path: "/tools" },
];
const TERMS = [
  { id: 1, icon: "ri-user-add-line", items: ["a", "b", "c"] },
  { id: 2, icon: "ri-google-line", items: ["a", "b", "c"] },
  { id: 3, icon: "ri-telegram-2-line", items: ["a", "b", "c"] },
  { id: 4, icon: "ri-coin-line", items: ["a", "b", "c", "d"] },
  { id: 5, icon: "ri-folder-shield-2-line", items: ["a", "b", "c"] },
  { id: 6, icon: "ri-robot-2-line", items: ["a", "b", "c"] },
  { id: 7, icon: "ri-scales-3-line", items: ["a", "b", "c"] },
  { id: 8, icon: "ri-lock-line", items: ["a", "b", "c"] },
  { id: 9, icon: "ri-information-line", items: ["a", "b", "c"] },
];

// Page: Home
function Home() {
  const { t } = useLanguage();

  // Link Page
  const pGetstart = "/getstart";
  const pPlants = "/plants"
  return (
    <div className="page home">
      <h2 className="page-heading" data-aos="fade-in" data-aos-delay="100">
        {t("welcome")} {t('brandTitle')}
      </h2>
      <p className="page-subtitle grad" data-aos="fade-in" data-aos-delay="200">
        {t("homeSubtitle")}
      </p>

      <div className="card" style={{ background: 'none', border: 'none', boxShadow: 'none'}}>
        <p data-aos="fade-in" data-aos-delay="300">
          {t('getStartDecribtion')}
        </p>

        <div className="btn-content">
          <NavLink to={pGetstart}>
            <button>
              <i className="ri-flashlight-fill"></i>
              <span>{t('getStart')}</span>
            </button>
          </NavLink>
          
          <NavLink to={pPlants}>
            <button>
              <i className="ri-shopping-basket-2-line"></i>
              <span>{t('viewPlans')}</span>
            </button>
          </NavLink>
        </div>
      </div>
      
      {/* Features */}
      <h3 className="home-h3" id="Features">{t("homeFeaturesTitle")}</h3>
      <div className="feature grid">
        {FEATURES.map((f, i) => (
          <div className="card glass" key={f.id} data-aos="fade-up" data-aos-delay={String(100 + (i % 3) * 50)}>
            <h1 className="title">
              <i className={f.icon}></i>
              <span>{t(`hf${f.id}Title`)}</span>
            </h1>
            <ul className="home-list">
              {f.items.map((k) => <li key={k}>{t(`hf${f.id}${k}`)}</li>)}
            </ul>
            {f.path && (
              <NavLink className="home-try" to={f.path}>
                <span>{t("homeTry")}</span> <i className="ri-arrow-right-line"></i>
              </NavLink>
            )}
          </div>
        ))}
      </div>

      {/* Terms Of Services */}
      <h3 className="home-h3" id="TermOfServices">{t("homeTermsTitle")}</h3>
      <p className="home-terms-intro">{t("homeTermsIntro")} <span className="home-muted">{t("homeTermsUpdated")}</span></p>
      <div className="grid">
        {TERMS.map((s, i) => (
          <div className="card" key={s.id} data-aos="fade-up" data-aos-delay={String(100 + (i % 3) * 50)}>
            <h1 className="title">
              <i className={s.icon}></i>
              <span>{i + 1}. {t(`ht${s.id}Title`)}</span>
            </h1>
            <ul className="home-list">
              {s.items.map((k) => <li key={k}>{t(`ht${s.id}${k}`)}</li>)}
            </ul>
          </div>
        ))}
      </div>

      {/* Get Start*/}
      <h3 className="home-h3">{t('getStart')}</h3>
      <div style={{ display: 'flex', gap: '.5rem', margin: '0 auto'}}>
        <NavLink className="getstart" to="/getstart">
          <i className="ri-flashlight-line"></i>
          <span>{t('getStart')}</span>
        </NavLink>

        <NavLink className="getstart" to="/register">
          <i className="ri-user-line"></i>
          <span>{t('register')}</span>
        </NavLink>
      </div>
    </div>
  );
}

export default Home;
