const API_BASE = '/api'

function getStoredUser() {
  try {
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null')
    return user || { id: 1, role: 'registrar' }
  } catch (e) {
    return { id: 1, role: 'registrar' }
  }
}

function getHeaders() {
  const user = getStoredUser()
  return {
    'Content-Type': 'application/json',
    'X-User-ID': String(user.id || '1'),
    'X-User-Role': user.role || 'registrar'
  }
}

export async function getOrders(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await fetch(`${API_BASE}/orders?${query}`, {
    headers: getHeaders()
  })
  return res.json()
}

export async function getOrder(id) {
  const res = await fetch(`${API_BASE}/orders/${id}`, {
    headers: getHeaders()
  })
  return res.json()
}

export async function createOrder(data) {
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  })
  return res.json()
}

export async function processOrder(id, data) {
  const res = await fetch(`${API_BASE}/orders/${id}/process`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  })
  return res.json()
}

export async function getAttachments(orderId) {
  const res = await fetch(`${API_BASE}/attachments/order/${orderId}`, {
    headers: getHeaders()
  })
  return res.json()
}

export async function uploadAttachment(orderId, file) {
  const formData = new FormData()
  formData.append('file', file)
  
  const user = getStoredUser()
  const headers = {
    'X-User-ID': String(user.id || '1'),
    'X-User-Role': user.role || 'registrar'
  }

  const res = await fetch(`${API_BASE}/attachments/order/${orderId}/upload`, {
    method: 'POST',
    headers,
    body: formData
  })
  return res.json()
}

export async function rejectAttachment(id, reason) {
  const res = await fetch(`${API_BASE}/attachments/${id}/reject`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ reason })
  })
  return res.json()
}

export async function approveAttachment(id) {
  const res = await fetch(`${API_BASE}/attachments/${id}/approve`, {
    method: 'POST',
    headers: getHeaders()
  })
  return res.json()
}

export async function deleteAttachment(id) {
  const res = await fetch(`${API_BASE}/attachments/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  })
  return res.json()
}

export async function getUsers() {
  const res = await fetch(`${API_BASE}/users`, {
    headers: getHeaders()
  })
  return res.json()
}

export async function getCurrentUser() {
  const res = await fetch(`${API_BASE}/users/current`, {
    headers: getHeaders()
  })
  return res.json()
}
