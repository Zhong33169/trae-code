const API_PORT = import.meta.env.PUBLIC_API_PORT || '8003';
const API_BASE = `http://localhost:${API_PORT}/api`;

const request = async (path, options = {}) => {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json();
  return data;
};

export const getOrders = (userId, userRole, filters = {}) => {
  const params = new URLSearchParams({ userId, userRole, ...filters });
  return request(`/orders?${params.toString()}`);
};

export const getOrderDetail = (orderId, userId) => {
  return request(`/orders/${orderId}?userId=${userId}`);
};

export const getStats = (userId, userRole) => {
  return request(`/stats?userId=${userId}&userRole=${userRole}`);
};

export const performAction = (orderId, action, payload) => {
  return request(`/orders/${orderId}/actions/${action}`, {
    method: 'POST',
    body: payload
  });
};

export const createOrder = (data, userId) => {
  return request('/orders', {
    method: 'POST',
    body: { userId, ...data }
  });
};

export const updateOrder = (orderId, data, userId, version) => {
  return request(`/orders/${orderId}`, {
    method: 'PUT',
    body: { userId, version, ...data }
  });
};

export const addEvidence = (orderId, type, name, userId) => {
  return request(`/orders/${orderId}/evidences`, {
    method: 'POST',
    body: { userId, type, name }
  });
};

export const deleteEvidence = (evidenceId, userId) => {
  return request(`/evidences/${evidenceId}`, {
    method: 'DELETE',
    body: { userId }
  });
};

export const getCurrentUser = (userId) => {
  return request(`/users/current?userId=${userId}`);
};

export const getStores = () => {
  return request('/stores');
};

export const API_PORT_VALUE = API_PORT;
