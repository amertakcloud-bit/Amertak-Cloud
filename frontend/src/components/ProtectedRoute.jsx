import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ProtectedRoute
// Wraps private pages (/dashboard, /profile, /settings).
// - While the /me check is running → show a loader (avoids flicker/redirect loops)
// - Guest → redirect to /login (remembering where they wanted to go)
export function AuthLoader() {
  return (
    <div className="auth-loader" role="status" aria-label="Checking session">
      <i className="ri-loader-4-line auth-loader-icon" aria-hidden="true"></i>
      <p>Checking your session…</p>
    </div>
  );
}

// Check if a user matches the required roles.
function hasRole(user, requiredRoles) {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  return requiredRoles.includes(user.role || "user");
}

function ProtectedRoute({ children, roles = [], redirectTo = "/login" }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoader />;

  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }

  if (!hasRole(user, roles)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children ?? <Outlet />;
}

export default ProtectedRoute;
