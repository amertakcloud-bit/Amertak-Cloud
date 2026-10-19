// api.js
// Tiny fetch wrapper for the Express API.
// - Base URL comes from VITE_API_URL (frontend .env) — no secrets live here.
// - credentials: "include" sends/receives the HTTP-only auth cookie.
const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(
  /\/+$/,
  ""
);

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
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (_error) {
    const error = new Error("Cannot reach the server. Please check your connection.");
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
