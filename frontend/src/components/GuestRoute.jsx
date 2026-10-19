import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthLoader } from "./ProtectedRoute";

// GuestRoute
// Wraps /login, /register and /forgot-password.
// Authenticated users are sent to the dashboard instead.
function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoader />;

  if (user) {
    const from = location.state?.from;
    return <Navigate to={from || "/dashboard"} replace />;
  }

  return children ?? <Outlet />;
}

export default GuestRoute;
