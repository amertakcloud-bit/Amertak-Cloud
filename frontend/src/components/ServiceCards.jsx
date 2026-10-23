
import { NavLink } from "react-router-dom"
function ServiceCards({ name, icon, describe , tag, path }) {
    return (
        <NavLink className="card glass" to={path}>
            <div className="icon">
                <i className={icon}></i>
            </div>
            <div className="info">
                <h1 className="reflect">{name}</h1>
                <p>{describe}</p>
            </div>

            <span className="tag">
                {tag}
            </span>
        </NavLink>
    )
}

export default ServiceCards