import sidebarItems from "../data/sidebarItems";
import sidebarSocail from "../data/sidebarSocails";
import SidebarSocails from "./SidebarSocails";
import SidebarItem from "./SidebarItem";
import { useAuth } from "../context/AuthContext";

import { NavLink } from "react-router-dom";

import favIcon from "../assets/favicon/favicon.svg";
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

    if (user?.role === "admin" && item.labelKey === "dashboard") {
      return {
        ...item,
        path: "/admin/dashboard",
        children: [
          { labelKey: "users", icon: "ri-group-line", path: "/admin/dashboard" },
          { labelKey: "promoCodes", icon: "ri-ticket-price-line", path: "/admin/promo-codes" },
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="440 420 660 690"
              role="img"
              aria-labelledby="title desc"
              width={30}
            >
              <path
                fill="var(--text)"
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M 625.50 461.00
Q 613.00 460.00 599.00 476.00
Q 585.00 492.00 572.00 517.00
Q 559.00 542.00 525.50 566.50
Q 492.00 591.00 476.50 617.50
Q 461.00 644.00 456.00 669.50
Q 451.00 695.00 452.00 798.00
Q 453.00 901.00 460.50 925.50
Q 468.00 950.00 478.50 967.00
Q 489.00 984.00 510.50 1001.50
Q 532.00 1019.00 561.00 1029.50
Q 590.00 1040.00 619.00 1041.50
Q 648.00 1043.00 670.50 1070.00
Q 693.00 1097.00 699.50 1095.00
Q 706.00 1093.00 719.00 1068.00
Q 732.00 1043.00 819.50 1043.00
Q 907.00 1043.00 921.00 1062.00
Q 935.00 1081.00 944.00 1081.50
Q 953.00 1082.00 969.00 1056.50
Q 985.00 1031.00 998.50 1024.50
Q 1012.00 1018.00 1031.00 1003.00
Q 1050.00 988.00 1068.00 953.50
Q 1086.00 919.00 1089.00 892.00
Q 1092.00 865.00 1092.00 788.00
Q 1092.00 711.00 1089.00 686.00
Q 1086.00 661.00 1078.50 641.50
Q 1071.00 622.00 1053.50 599.50
Q 1036.00 577.00 1013.50 562.50
Q 991.00 548.00 971.50 543.00
Q 952.00 538.00 900.00 534.50
Q 848.00 531.00 823.00 482.50
Q 798.00 434.00 788.50 433.50
Q 779.00 433.00 767.50 438.00
Q 756.00 443.00 738.00 455.50
Q 720.00 468.00 703.50 485.00
Q 687.00 502.00 662.50 482.00
Q 638.00 462.00 625.50 461.00 Z M 760.50 760.00
Q 768.00 764.00 775.50 783.50
Q 783.00 803.00 783.00 818.50
Q 783.00 834.00 772.50 857.00
Q 762.00 880.00 747.50 893.00
Q 733.00 906.00 712.50 912.50
Q 692.00 919.00 674.50 917.50
Q 657.00 916.00 636.50 905.50
Q 616.00 895.00 604.00 879.50
Q 592.00 864.00 586.50 844.50
Q 581.00 825.00 581.50 815.50
Q 582.00 806.00 585.00 803.50
Q 588.00 801.00 670.50 778.50
Q 753.00 756.00 760.50 760.00 Z M 828.00 818.00
Q 828.00 802.00 832.00 797.00
Q 836.00 792.00 928.50 792.00
Q 1021.00 792.00 1025.00 796.50
Q 1029.00 801.00 1029.00 819.00
Q 1029.00 837.00 1018.50 859.00
Q 1008.00 881.00 996.00 892.00
Q 984.00 903.00 970.50 909.50
Q 957.00 916.00 935.50 917.00
Q 914.00 918.00 895.50 911.50
Q 877.00 905.00 860.50 888.50
Q 844.00 872.00 836.00 853.00
Q 828.00 834.00 828.00 818.00 Z"
              />
            </svg>
            {!isCollapsed && <span>Amertak Cloud</span>}
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
