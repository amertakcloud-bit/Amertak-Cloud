import { useState, useEffect } from "react";
import { SkeletonPage } from "../../components/ui/Skeleton";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import UsersListView from "./UsersListView";
import UserDetailPanel from "./UserDetailPanel";
import PromoCodes from "./PromoCodes";

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
  const activeTab = location.pathname.startsWith("/admin/promo-codes")
    ? "promo"
    : "users";

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

  if (normalizedUser.role !== "admin") {
    return (
      <div className="auth-loader" role="status" aria-label="Access denied">
        <i className="ri-error-warning-line" aria-hidden="true"></i>
        <p>Access denied. Admin privileges required.</p>
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
        <button
          className={`admin-tab ${activeTab === "promo" ? "active" : ""}`}
          onClick={() => {
            setError("");
            navigate("/admin/promo-codes");
          }}
        >
          <i className="ri-ticket-price-line" aria-hidden="true"></i>
          Promo Codes
        </button>
      </div>

      {error && <div className="auth-alert error" role="alert">{error}</div>}

      {activeTab === "promo" ? (
        <PromoCodes />
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
