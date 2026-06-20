const API_BASE = (import.meta.env?.VITE_API_BASE) || "http://localhost:8004/api";

function getUser() {
  try {
    const s = typeof localStorage !== "undefined" ? localStorage.getItem("credit_user") : null;
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function setUser(u) {
  try {
    if (u) localStorage.setItem("credit_user", JSON.stringify(u));
    else localStorage.removeItem("credit_user");
    _notifyUserChange();
  } catch {}
}

function clearUser() {
  try {
    localStorage.removeItem("credit_user");
    _notifyUserChange();
  } catch {}
}

function headers(extra) {
  const u = getUser();
  const h = {
    "Content-Type": "application/json",
    ...(extra || {}),
  };
  if (u) {
    h["x-user-id"] = String(u.id);
    h["x-user-role"] = u.role;
  }
  return h;
}

async function request(method, path, data) {
  const url = (path.startsWith("http") ? path : (API_BASE + path));
  const init = { method, headers: headers() };
  if (data !== undefined && method !== "GET") {
    init.body = JSON.stringify(data);
  }
  const res = await fetch(url, init);
  const ct = res.headers.get("content-type") || "";
  const json = ct.includes("json") ? await res.json() : await res.text();
  return json;
}

const _listeners = { user: new Set(), refresh: new Set() };
function _notifyUserChange() {
  const u = getUser();
  _listeners.user.forEach(fn => { try { fn(u); } catch {} });
}
function _notifyRefresh() {
  _listeners.refresh.forEach(fn => { try { fn(); } catch {} });
}

function onUserChange(fn) {
  _listeners.user.add(fn);
  return () => _listeners.user.delete(fn);
}
function onRefresh(fn) {
  _listeners.refresh.add(fn);
  return () => _listeners.refresh.delete(fn);
}
function notifyRefresh() {
  _notifyRefresh();
}

export const api = {
  login: async (username, password) => {
    const r = await request("POST", "/auth/login", { username, password });
    if (r?.ok && r?.data) setUser(r.data);
    return r;
  },
  logout: () => { clearUser(); },
  users: () => request("GET", "/users"),
  applications: (query) => {
    const q = query ? ("?" + new URLSearchParams(Object.entries(query).filter(([,v]) => v !== "" && v !== undefined && v !== null)).toString()) : "";
    return request("GET", "/applications" + q);
  },
  stats: () => request("GET", "/applications/stats"),
  application: (id) => request("GET", "/applications/" + id),
  createApp: async (data) => {
    const r = await request("POST", "/applications", data);
    if (r?.ok) _notifyRefresh();
    return r;
  },
  action: async (id, data) => {
    const r = await request("POST", "/applications/" + id + "/action", data);
    _notifyRefresh();
    return r;
  },
  updateEvidence: async (appId, eid, data) => {
    const r = await request("PUT", "/applications/" + appId + "/evidence/" + eid, data);
    if (r?.ok) _notifyRefresh();
    return r;
  },
  logs: (id) => request("GET", "/applications/" + id + "/logs"),
  statusDict: () => request("GET", "/dict/statuses"),
  roleDict: () => request("GET", "/dict/roles"),
  getCurrentUser: getUser,
  saveUser: setUser,
  clearUser,
  onUserChange,
  onRefresh,
  notifyRefresh,
  API_BASE,
};
