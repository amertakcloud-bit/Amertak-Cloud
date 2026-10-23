import api from "./api";

const adminService = {
  // Auth
  login: (credentials) => api.post("/admin/auth/login", credentials),
  logout: () => api.post("/admin/auth/logout"),
  me: () => api.get("/admin/auth/me"),

  // Users
  getUsers: (params) => api.get("/admin/users", { params }),
  getUserDetail: (userId) => api.get(`/admin/users/${userId}`),

  // Tokens
  addTokens: (userId, tokens) =>
    api.post(`/admin/users/${userId}/tokens`, { tokens }),

  // Promo codes
  getPromoCodes: (params) => api.get("/admin/promo-codes", { params }),
  createPromoCode: (data) => api.post("/admin/promo-codes", data),
  deletePromoCode: (id) => api.delete(`/admin/promo-codes/${id}`),
  activatePromoCode: (id) => api.post(`/admin/promo-codes/${id}/activate`),
  deactivatePromoCode: (id) => api.post(`/admin/promo-codes/${id}/deactivate`),
  usePromoCode: (id, userId) =>
    api.post(`/admin/promo-codes/${id}/use`, { userId }),
};

export default adminService;
