import { useLanguage } from "../context/LanguageContext";
import { NavLink } from "react-router-dom";
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
      <h3 style={{ fontFamily: 'Kantumruy', color: 'var(--primary)' }}>លក្ខណៈពិសេស និង មុខងារ</h3>
      <div className="feature grid">

        <div className="card glass" data-aos="fade-up" data-aos-delay="100">
          <h1 className="title">
            <i className="ri-settings-6-line"></i>
            <span>{t('សម្លេងទៅជា Caption')}</span>
          </h1>

            <li>ល្បឿនបម្លែងលឿន</li>
            <li>អក្សរច្បាស់និងត្រូវតាមសម្លេង</li>
            <li>ចំណាយថូខេនតិចបំផុត</li>
            <li>គាំទ្រសម្លេងរយៈពេលវែង (៥ នាទី)</li>
        </div>

        <div className="card glass" data-aos="fade-up" data-aos-delay="150">
          <h1 className="title">
            <i className="ri-settings-6-line"></i>
            <span>{t('បកប្រែវីដេអូ')}</span>
          </h1>

          <li>ល្បឿនបម្លែងលឿន</li>
            <li>អក្សរច្បាស់និងត្រូវតាមសម្លេង</li>
            <li>ចំណាយថូខេនតិចបំផុត</li>
            <li>គាំទ្រសម្លេងរយៈពេលវែង (៥ នាទី)</li>
        </div>

        <div className="card glass" data-aos="fade-up" data-aos-delay="200">
          <h1 className="title">
            <i className="ri-text-to-speech-line"></i>
            <span>{t('បង្ហោះឯកសារ/ហ្វាល់')}</span>
          </h1>

          <li>ល្បឿនបម្លែងលឿន</li>
            <li>អក្សរច្បាស់និងត្រូវតាមសម្លេង</li>
            <li>ចំណាយថូខេនតិចបំផុត</li>
            <li>គាំទ្រសម្លេងរយៈពេលវែង (៥ នាទី)</li>
        </div>
      </div>

      {/* Terms Of Services :( */}
      <h3 style={{ fontFamily: 'Kantumruy', color: 'var(--primary)' }} id="TermOfServices">លក្ខខណ្ឌនៃសេវាកម្ម</h3>
      <div className="grid">
        <div className="card" data-aos="fade-up" data-aos-delay="100">
          <h1 className="title">
            <i className="ri-information-line"></i>
            <span>ការចុះឈ្មោះបង្កើតគណនី</span>
          </h1>
            
            <li></li>
            <li></li>
            <li></li>
        </div>
        <div className="card" data-aos="fade-up" data-aos-delay="150">
          <h1 className="title">
            <i className="ri-information-line"></i>
            <span>ការចូលតាមរយៈ Google</span>
          </h1>
        </div>
        <div className="card" data-aos="fade-up" data-aos-delay="200">
          <h1 className="title">
            <i className="ri-information-line"></i>
            <span>ការចូលតាមរយៈ Telegram</span>
          </h1>
        </div>
      </div>

      {/* Get Start*/}
      <h3 style={{ fontFamily: 'Kantumruy', color: 'var(--primary)' }}>{t('getStart')}</h3>
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
