const BASE_URL = 'http://localhost:8001'

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const resp = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  })
  let data = null
  const text = await resp.text()
  try {
    data = text ? JSON.parse(text) : null
  } catch (e) {
    data = { message: text }
  }
  if (!resp.ok) {
    const err = new Error(data?.message || `HTTP ${resp.status}`)
    err.data = data
    err.status = resp.status
    throw err
  }
  return data
}

export const api = {
  login: (username, password) =>
    apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => apiFetch('/api/me'),
  users: () => apiFetch('/api/users'),
  projects: () => apiFetch('/api/projects'),
  listForms: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return apiFetch(`/api/forms${qs ? '?' + qs : ''}`)
  },
  getForm: (id) => apiFetch(`/api/forms/${id}`),
  createForm: (data) =>
    apiFetch('/api/forms', { method: 'POST', body: JSON.stringify(data) }),
  processForm: (data) =>
    apiFetch('/api/forms/process', { method: 'POST', body: JSON.stringify(data) }),
  batchProcess: (data) =>
    apiFetch('/api/forms/batch', { method: 'POST', body: JSON.stringify(data) }),
  uploadEvidence: (data) =>
    apiFetch('/api/evidences', { method: 'POST', body: JSON.stringify(data) }),
  deleteEvidence: (id) =>
    apiFetch(`/api/evidences/${id}`, { method: 'DELETE' })
}
