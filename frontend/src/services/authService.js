import api, { API_URL } from "./api";

// authService
// Every call returns the API envelope: { success, data: { user }, message }
// and throws an Error (with .status / .message) on failure.
const authService = {
  register: (payload) => api.post("/auth/register", payload),
  login: (credentials) => api.post("/auth/login", credentials),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),

  // Profile (protected user routes)
  getProfile: () => api.get("/users/me"),
  updateProfile: (payload) => api.put("/users/me", payload),

  // Full URL that starts the Google OAuth hand-off (browser navigation, not fetch)
  googleUrl: () => `${API_URL}/auth/google`,
  telegramUrl: () => `${API_URL}/auth/telegram`
};

export default authService;
