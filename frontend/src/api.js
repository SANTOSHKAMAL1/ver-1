const BASE = "";
const TOKEN_KEY = "ag_admin_token";

export const token = {
  get: () => localStorage.getItem(TOKEN_KEY) || "",
  set: (v) => localStorage.setItem(TOKEN_KEY, v),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) headers["Authorization"] = `Bearer ${token.get()}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    if (res.status === 401 && auth) token.clear();
    throw new Error((data && data.detail) || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  content: () => request("/api/content"),
  sendEnquiry: (body) => request("/api/enquiries", { method: "POST", body }),

  login: (username, password) =>
    request("/api/auth/login", { method: "POST", body: { username, password } }),
  me: () => request("/api/auth/me", { auth: true }),
  changePassword: (current_password, new_password) =>
    request("/api/auth/password", {
      method: "POST",
      auth: true,
      body: { current_password, new_password },
    }),

  stats: () => request("/api/admin/stats", { auth: true }),

  getSettings: () => request("/api/admin/settings", { auth: true }),
  putSettings: (values) =>
    request("/api/admin/settings", { method: "PUT", auth: true, body: { values } }),

  listTicker: () => request("/api/admin/ticker", { auth: true }),
  createTicker: (body) => request("/api/admin/ticker", { method: "POST", auth: true, body }),
  updateTicker: (id, body) => request(`/api/admin/ticker/${id}`, { method: "PUT", auth: true, body }),
  deleteTicker: (id) => request(`/api/admin/ticker/${id}`, { method: "DELETE", auth: true }),

  listNav: () => request("/api/admin/nav", { auth: true }),
  createNav: (body) => request("/api/admin/nav", { method: "POST", auth: true, body }),
  updateNav: (id, body) => request(`/api/admin/nav/${id}`, { method: "PUT", auth: true, body }),
  deleteNav: (id) => request(`/api/admin/nav/${id}`, { method: "DELETE", auth: true }),

  createNavLink: (body) => request("/api/admin/nav-links", { method: "POST", auth: true, body }),
  updateNavLink: (id, body) =>
    request(`/api/admin/nav-links/${id}`, { method: "PUT", auth: true, body }),
  deleteNavLink: (id) => request(`/api/admin/nav-links/${id}`, { method: "DELETE", auth: true }),

  listSections: () => request("/api/admin/sections", { auth: true }),
  createSection: (body) => request("/api/admin/sections", { method: "POST", auth: true, body }),
  updateSection: (id, body) =>
    request(`/api/admin/sections/${id}`, { method: "PUT", auth: true, body }),
  deleteSection: (id) => request(`/api/admin/sections/${id}`, { method: "DELETE", auth: true }),

  createItem: (body) => request("/api/admin/section-items", { method: "POST", auth: true, body }),
  updateItem: (id, body) =>
    request(`/api/admin/section-items/${id}`, { method: "PUT", auth: true, body }),
  deleteItem: (id) => request(`/api/admin/section-items/${id}`, { method: "DELETE", auth: true }),

  listEnquiries: (status = "") =>
    request(`/api/admin/enquiries${status ? `?status=${status}` : ""}`, { auth: true }),
  updateEnquiry: (id, status) =>
    request(`/api/admin/enquiries/${id}`, { method: "PUT", auth: true, body: { status } }),
  deleteEnquiry: (id) => request(`/api/admin/enquiries/${id}`, { method: "DELETE", auth: true }),
};
