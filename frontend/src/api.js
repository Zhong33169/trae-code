const API_BASE = 'http://localhost:8001'

function getToken() {
  return localStorage.getItem('repair_token') || ''
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  }
}

async function handleResponse(res) {
  if (!res.ok) {
    let err = { detail: '请求失败' }
    try { err = await res.json() } catch (e) {}
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  try { return await res.json() } catch (e) { return null }
}

export const api = {
  async login(username, password, role) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role })
    })
    return handleResponse(res)
  },

  async getRoles() {
    const res = await fetch(`${API_BASE}/api/auth/roles`)
    return handleResponse(res)
  },

  async listAllUsers() {
    const res = await fetch(`${API_BASE}/api/auth/users`, { headers: authHeaders() })
    return handleResponse(res)
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() })
    return handleResponse(res)
  },

  async listTickets(params = {}) {
    const qs = new URLSearchParams(params).toString()
    const res = await fetch(`${API_BASE}/api/tickets?${qs}`, { headers: authHeaders() })
    return handleResponse(res)
  },

  async getTicket(id) {
    const res = await fetch(`${API_BASE}/api/tickets/${id}`, { headers: authHeaders() })
    return handleResponse(res)
  },

  async createTicket(data) {
    const res = await fetch(`${API_BASE}/api/tickets`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async submitTicket(id, data = {}) {
    const res = await fetch(`${API_BASE}/api/tickets/${id}/submit`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async approveTicket(id, data = {}) {
    const res = await fetch(`${API_BASE}/api/tickets/${id}/approve`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async returnTicket(id, data = {}) {
    const res = await fetch(`${API_BASE}/api/tickets/${id}/return`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async rejectTicket(id, data = {}) {
    const res = await fetch(`${API_BASE}/api/tickets/${id}/reject`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async assignTicket(id, data = {}) {
    const res = await fetch(`${API_BASE}/api/tickets/${id}/assign`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async startTicket(id, data = {}) {
    const res = await fetch(`${API_BASE}/api/tickets/${id}/start`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async completeTicket(id, data = {}) {
    const res = await fetch(`${API_BASE}/api/tickets/${id}/complete`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async reviewTicket(id, data = {}) {
    const res = await fetch(`${API_BASE}/api/tickets/${id}/review`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async addAttachment(ticketId, data) {
    const res = await fetch(`${API_BASE}/api/tickets/${ticketId}/attachments`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async updateAttachment(attId, data) {
    const res = await fetch(`${API_BASE}/api/attachments/${attId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data)
    })
    return handleResponse(res)
  },

  async listAuditLogs(params = {}) {
    const qs = new URLSearchParams(params).toString()
    const res = await fetch(`${API_BASE}/api/audit-logs?${qs}`, { headers: authHeaders() })
    return handleResponse(res)
  },

  async seed() {
    const res = await fetch(`${API_BASE}/api/seed`, { method: 'POST' })
    return handleResponse(res)
  }
}
