// api.js
// Tiny fetch wrapper for the Express API.
// - Base URL comes from VITE_API_URL (frontend .env) — no secrets live here.
// - credentials: "include" sends/receives the HTTP-only auth cookie.
const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "/api" : "http://localhost:5000/api")).replace(
  /\/+$/,
  ""
);

const TOKEN_KEY = "amertak_token";
export function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } }
export function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } }
// Google login redirects back with #token=… → store it and clean the URL.
if (typeof window !== "undefined" && /[#&]token=/.test(window.location.hash)) {
  const m = /[#&]token=([^&]+)/.exec(window.location.hash);
  if (m) { setToken(decodeURIComponent(m[1])); history.replaceState(null, "", window.location.pathname + window.location.search); }
}

async function request(path, { method = "GET", body, headers = {}, params } = {}) {
  const query = new URLSearchParams();

  if (params && typeof params === "object") {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      query.append(key, String(value));
    });
  }

  const url = `${API_URL}${path}${query.toString() ? `?${query.toString()}` : ""}`;

  let response;

  try {
    response = await fetch(url, {
      method,
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (_error) {
    // Almost always: VITE_API_URL missing/wrong on the deployed site, or the backend's
    // CLIENT_URL does not match this site's origin (CORS). The console shows which.
    console.error(`[API] request failed: ${url} (page origin: ${window.location.origin}). Check VITE_API_URL and the backend CLIENT_URL.`);
    const error = new Error(
      import.meta.env.PROD && /localhost|127\.0\.0\.1/.test(API_URL)
        ? "This site is still pointing at localhost. Set VITE_API_URL in Vercel and redeploy the frontend."
        : "Cannot reach the server. Please check your connection."
    );
    error.status = 0;
    throw error;
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(
      data?.message || `Request failed with status ${response.status}.`
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  if (data?.data?.token) setToken(data.data.token);
  if (path.startsWith("/auth/logout") || (response.status === 401 && path.startsWith("/auth/me"))) setToken("");
  return data;
}

const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
};

export { API_URL };
export default api;
