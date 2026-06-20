const API_BASE = (import.meta.env?.VITE_API_BASE) || "http://localhost:8004/api";

function getUser() {
  try {
    const s = typeof localStorage !== "undefined" ? localStorage.getItem("credit_user") : null;
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function headers(extra) {
  const u = getUser();
  const h = {
    "Content-Type": "application/json",
    ...(extra || {}),
  };
  if (u) {
    h["x-user-id"] = u.id;
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

export const api = {
  login: (username, password) => request("POST", "/auth/login", { username, password }),
  users: () => request("GET", "/users"),
  applications: (query) => {
    const q = query ? ("?" + new URLSearchParams(Object.entries(query).filter(([,v]) => v !== "" && v !== undefined && v !== null)).toString()) : "";
    return request("GET", "/applications" + q);
  },
  stats: () => request("GET", "/applications/stats"),
  application: (id) => request("GET", "/applications/" + id),
  createApp: (data) => request("POST", "/applications", data),
  action: (id, data) => request("POST", "/applications/" + id + "/action", data),
  updateEvidence: (appId, eid, data) => request("PUT", "/applications/" + appId + "/evidence/" + eid, data),
  logs: (id) => request("GET", "/applications/" + id + "/logs"),
  statusDict: () => request("GET", "/dict/statuses"),
  roleDict: () => request("GET", "/dict/roles"),
  getCurrentUser: getUser,
  saveUser: (u) => { typeof localStorage !== "undefined" && localStorage.setItem("credit_user", JSON.stringify(u)); },
  clearUser: () => { typeof localStorage !== "undefined" && localStorage.removeItem("credit_user"); },
  API_BASE,
};
