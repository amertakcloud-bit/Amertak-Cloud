import sidebarItems from "../data/sidebarItems";
import { can, isStaff } from "../lib/permissions";
import sidebarSocail from "../data/sidebarSocails";
import SidebarSocails from "./SidebarSocails";
import SidebarItem from "./SidebarItem";
import { useAuth } from "../context/AuthContext";

import { NavLink } from "react-router-dom";

import logo from "../assets/favicon/logo.svg"
import logoTitle from "../assets/favicon/logoTitle.svg"
import { img } from "motion/react-client";
// Sidebar
// Renders the full navigation list. Handles:
// - Mobile off-canvas (isOpen / onClose)
// - Desktop collapse to icon-only rail (isCollapsed)
// - The "account" item adapts to the session: signed in → Profile, guest → Login
function Sidebar({ isOpen, onClose, isCollapsed }) {
  const { user } = useAuth();

  // Guests do not see the Dashboard link (it needs an account).
  const items = sidebarItems.filter((item) => user || item.labelKey !== "dashboard").map((item) => {
    if (item.labelKey === "account") {
      return {
        ...item,
        labelKey: user ? "profile" : "login",
        icon: user ? "ri-user-3-line" : "ri-login-circle-line",
        path: user ? "/profile" : "/login",
      };
    }

    if (isStaff(user) && item.labelKey === "dashboard") {
      return {
        ...item,
        path: "/admin/dashboard",
        children: [
          { labelKey: "users", icon: "ri-group-line", path: "/admin/dashboard" },
          ...(can(user, "payments.read") ? [{ labelKey: "payments", icon: "ri-bank-card-line", path: "/admin/payments" }] : []),
          ...(can(user, "audit.read") ? [{ labelKey: "auditLog", icon: "ri-file-list-3-line", path: "/admin/audit" }] : []),
          ...(can(user, "*") ? [{ labelKey: "broadcast", icon: "ri-megaphone-line", path: "/admin/broadcast" }, { labelKey: "aiSettings", icon: "ri-settings-3-line", path: "/admin/settings" }] : []),
          ...(can(user, "*") ? [{ labelKey: "promoCodes", icon: "ri-ticket-price-line", path: "/admin/promo-codes" }] : []),
        ],
      };
    }

    return item;
  });

  return (
    <>
      {/* Backdrop shown on mobile when the sidebar is open */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        ></div>
      )}

      <aside
        className={
          "sidebar" +
          (isOpen ? " open" : "") +
          (isCollapsed ? " collapsed" : "")
        }
      >
        <div className="scroll">
          <NavLink to="/">
            <div className="sidebar-brand">
              <img src={logo} width={30} />
              {!isCollapsed && <img src={logoTitle} width={80}/>}
            </div>
          </NavLink>

          <nav aria-label="Main navigation">
            <ul className="sidebar-list">
              {items.map((item) => (
                <SidebarItem
                  key={item.path}
                  item={item}
                  onNavigate={onClose}
                  isCollapsed={isCollapsed}
                />
              ))}
            </ul>
          </nav>

        </div>
        
          <div className="sidebar-social">
            <div className="socail-card">
              <i className="ri-donut-chart-fill"></i>
              {!isCollapsed && (
                <>
                  {sidebarSocail.map((item) => (
                    <SidebarSocails
                      key={item.platform}
                      icon={item.icon}
                      link={item.link}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
      </aside>
    </>
  );
}

export default Sidebar;
