import { useLanguage } from "../context/LanguageContext";
import ToolCards from "../components/ToolCards";
import toolCards from "../data/toolCards";

// /tools — hub that lists every tool (same cards as Get Start).
export default function Tools() {
  const { t } = useLanguage();
  return (
    <div className="page" data-aos="fade-in">
      <h1 className="page-heading reflect">{t("toolsTitle")}</h1>
      <p className="page-subtitle reflect">{t("toolsSub")}</p>
      <div className="tools-container">
        {toolCards.map((c) => (
          <ToolCards key={c.name} aosDelay={c.aosDelay} path={c.path} name={c.name} tag={c.tag} icon={c.icon} describe={c.describe} />
        ))}
      </div>
    </div>
  );
}
