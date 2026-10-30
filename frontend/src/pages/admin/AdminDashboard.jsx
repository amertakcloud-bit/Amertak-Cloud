import { useState, useEffect } from "react";
import { SkeletonPage } from "../../components/ui/Skeleton";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import UsersListView from "./UsersListView";
import UserDetailPanel from "./UserDetailPanel";
import PromoCodes from "./PromoCodes";
import { AdminAudit, AdminBroadcast, AdminPayments, AdminSettings, AdminStats } from "./AdminLists";
import { can, isStaff } from "../../lib/permissions";

export default function AdminDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [error, setError] = useState("");
  const { userId } = useParams();

  // Keep the detail panel in sync with /admin/users/:userId in the URL.
  useEffect(() => {
    setSelectedUserId(userId || null);
  }, [userId]);

  // Tab follows the URL: /admin/dashboard → Users, /admin/promo-codes → Promo Codes
  const path = location.pathname;
  const activeTab = path.startsWith("/admin/promo-codes") ? "promo" : path.startsWith("/admin/payments") ? "payments" : path.startsWith("/admin/audit") ? "audit" : path.startsWith("/admin/settings") ? "settings" : path.startsWith("/admin/broadcast") ? "broadcast" : "users";

  const normalizedUser = user && {
    ...user,
    id: user._id,
    role: user.role || "user",
    tokens: user.tokens ?? 0,
  };

  if (authLoading) {
    return <SkeletonPage kind="admin" label="Loading admin dashboard" />;
  }

  if (!normalizedUser) {
    navigate("/admin/login", { replace: true });
    return null;
  }

  if (!isStaff(normalizedUser)) {
    return (
      <div className="auth-loader" role="status" aria-label="Access denied">
        <i className="ri-error-warning-line" aria-hidden="true"></i>
        <p>Access denied. Staff access required.</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === "users" ? "active" : ""}`}
          onClick={() => {
            setError("");
            navigate("/admin/dashboard");
          }}
        >
          <i className="ri-group-line" aria-hidden="true"></i>
          Users
        </button>
        {can(normalizedUser, "payments.read") && (
          <button className={`admin-tab ${activeTab === "payments" ? "active" : ""}`} onClick={() => navigate("/admin/payments")}>
            <i className="ri-bank-card-line" aria-hidden="true"></i> Payments
          </button>
        )}
        {can(normalizedUser, "audit.read") && (
          <button className={`admin-tab ${activeTab === "audit" ? "active" : ""}`} onClick={() => navigate("/admin/audit")}>
            <i className="ri-file-list-3-line" aria-hidden="true"></i> Audit log
          </button>
        )}
        {can(normalizedUser, "*") && (
          <button className={`admin-tab ${activeTab === "broadcast" ? "active" : ""}`} onClick={() => navigate("/admin/broadcast")}>
            <i className="ri-megaphone-line" aria-hidden="true"></i> Broadcast
          </button>
        )}
        {can(normalizedUser, "*") && (
          <button className={`admin-tab ${activeTab === "settings" ? "active" : ""}`} onClick={() => navigate("/admin/settings")}>
            <i className="ri-settings-3-line" aria-hidden="true"></i> AI settings
          </button>
        )}
        {can(normalizedUser, "*") && (
          <button className={`admin-tab ${activeTab === "promo" ? "active" : ""}`} onClick={() => { setError(""); navigate("/admin/promo-codes"); }}>
            <i className="ri-ticket-price-line" aria-hidden="true"></i> Promo Codes
          </button>
        )}
      </div>

      {error && <div className="auth-alert error" role="alert">{error}</div>}

      {activeTab === "users" && !selectedUserId && can(normalizedUser, "stats.read") && <AdminStats />}

      {activeTab === "promo" ? (
        can(normalizedUser, "*") ? <PromoCodes /> : null
      ) : activeTab === "settings" ? (
        can(normalizedUser, "*") ? <AdminSettings /> : null
      ) : activeTab === "broadcast" ? (
        can(normalizedUser, "*") ? <AdminBroadcast /> : null
      ) : activeTab === "payments" ? (
        <AdminPayments />
      ) : activeTab === "audit" ? (
        <AdminAudit />
      ) : selectedUserId ? (
        <UserDetailPanel
          userId={selectedUserId}
          onBack={() => navigate("/admin/dashboard")}
        />
      ) : (
        <UsersListView
          onUserSelect={setSelectedUserId}
          currentUserId={normalizedUser.id}
        />
      )}
    </div>
  );
}
