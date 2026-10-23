import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import authService from "../services/authService";

// AuthContext
// Holds the current user (from the HTTP-only cookie session).
// On mount it asks GET /api/auth/me so a refresh keeps the user logged in.
const AuthContext = createContext(null);

function unwrapUser(payload) {
  return payload?.data?.user ?? payload?.user ?? null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until the first /me check finishes

  // Refresh the current user from the server. Returns the user (or null).
  const refreshUser = useCallback(async () => {
    try {
      const payload = await authService.me();
      const nextUser = unwrapUser(payload);
      setUser(nextUser);
      return nextUser;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await refreshUser();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  // Register → server logs the user in (cookie) → we store the user.
  const register = useCallback(async (payload) => {
    const data = await authService.register(payload);
    setUser(unwrapUser(data));
    return data;
  }, []);

  // Login → server sets the HTTP-only cookie → we store the user.
  const login = useCallback(async (credentials) => {
    const data = await authService.login(credentials);
    setUser(unwrapUser(data));
    return data;
  }, []);

  // Admin login → separate endpoint stores the cookie and returns the user.
  const adminLogin = useCallback(async (userData) => {
    setUser(userData);
    return { success: true, user: userData };
  }, []);

  // Logout → server clears the cookie → we clear local state.
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  }, []);

  // Update profile → server returns the updated user.
  const updateProfile = useCallback(async (payload) => {
    const data = await authService.updateProfile(payload);
    setUser(unwrapUser(data));
    return data;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      refreshUser,
      login,
      register,
      adminLogin,
      logout,
      updateProfile,
    }),
    [user, loading, refreshUser, login, register, adminLogin, logout, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// useAuth — same pattern as useLanguage()
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}
