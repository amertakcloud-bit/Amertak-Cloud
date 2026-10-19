
import { NavLink } from "react-router-dom"
import { useLanguage } from "../context/LanguageContext"
function ToolCards({ name, icon, describe , tag, path, aosDelay }) {
    const { t } = useLanguage();
    return (
        <NavLink className="card glass" to={path} data-aos="fade-up" data-aos-delay={aosDelay}>
            <div className="icon">
                <i className={icon}></i>
            </div>
            <div className="info">
                <h1 className="reflect">{t(name)}</h1>
                <p>{t(describe)}</p>
            </div>

            <span className="tag">
                <i className={tag}></i>
            </span>
        </NavLink>
    )
}

export default ToolCards