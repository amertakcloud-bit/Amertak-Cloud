import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { motion, AnimatePresence } from "motion/react";

import Tooltip from "./Tooltip";

// Sidebar item
// Renders a single sidebar link. If the item has "children", it renders
// as a dropdown/submenu instead of a plain link.
// When isCollapsed is true, only the icon is shown and a tooltip appears on hover.
function SidebarItem({ item, onNavigate, isCollapsed }) {
  const { t } = useLanguage();
  const location = useLocation();

  // Open the dropdown automatically if the current route matches any child.
  const isChildActive = item.children?.some(
    (child) => location.pathname === child.path,
  );
  const [isOpen, setIsOpen] = useState(Boolean(isChildActive));

  const label = t(item.labelKey);

  // Hover scale animation for the outer sidebar link
  const linkHover = {
    whileHover: {
      scale: isCollapsed ? 1.05 : 1.03,
    },
    transition: { duration: 0.15 },
  };

  // Submenu entrance animation
  const submenuVariants = {
    open: {
      opacity: 1,
      width: "auto",
      transition: {
        staggerChildren: 0.04,
        duration: 0.2,
        ease: [0.22, 1, 0.36, 1],
      },
    },
    closed: {
      opacity: 0,
      width: 0,
      transition: {
        duration: 0.15,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  // Plain link (no children)
  if (!item.children) {
    return (
      <li className="sidebar-item" title={isCollapsed ? label : undefined}>
        <Tooltip text="Tooltip" delay={500} position="right">
          <NavLink
            to={item.path}
            end={item.path === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              "sidebar-link" + (isActive ? " active" : "")
            }
            aria-label={isCollapsed ? label : undefined}
            style={linkHover}
          >
            <i className={item.icon} aria-hidden="true"></i>
            {!isCollapsed && <span>{label}</span>}
          </NavLink>
        </Tooltip>
      </li>
    );
  }

  // Dropdown / submenu
  return (
    <li className="sidebar-item" title={isCollapsed ? label : undefined}>
      <motion.button
        type="button"
        className={
          "sidebar-link sidebar-dropdown-toggle" +
          (isChildActive ? " active" : "")
        }
        onClick={() => !isCollapsed && setIsOpen((prev) => !prev)}
        aria-expanded={isCollapsed ? undefined : isOpen}
        aria-label={label}
        whileTap={{ scale: 0.97 }}
        style={linkHover}
      >
        <i className={item.icon} aria-hidden="true"></i>
        {!isCollapsed && (
          <>
            <span>{label}</span>
            <i
              className={
                "ri-arrow-down-s-line sidebar-caret" + (isOpen ? " open" : "")
              }
              aria-hidden="true"
            ></i>
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            key="submenu"
            initial="closed"
            animate={isOpen ? "open" : "closed"}
            exit="closed"
            variants={submenuVariants}
            className={"sidebar-submenu" + (isOpen ? " open" : "")}
          >
            {/* This inner div is required for the grid 0fr→1fr expand animation */}
            <ul className="sidebar-submenu-inner">
              {item.children.map((child, index) => (
                <motion.li
                  key={`${child.path}-${index}`}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.15 }}
                >
                  <NavLink
                    to={child.path}
                    end
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      "sidebar-sublink" + (isActive ? " active" : "")
                    }
                  >
                    {child.icon && (
                      <i className={child.icon} aria-hidden="true"></i>
                    )}
                    <span>{t(child.labelKey)}</span>
                  </NavLink>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export default SidebarItem;
