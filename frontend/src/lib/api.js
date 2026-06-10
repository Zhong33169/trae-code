import { get } from 'svelte/store';
import { currentUserId } from './stores.js';
import { API_BASE } from './constants.js';

function getHeaders() {
  const userId = get(currentUserId);
  return {
    'Content-Type': 'application/json',
    'X-User-ID': String(userId),
  };
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const config = {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  };

  if (options.body && typeof options.body !== 'string') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.detail || `请求失败 (${response.status})`);
    error.code = data.code || 'unknown';
    error.errors = data.errors || [];
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  getReservations(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/reservations${query ? `?${query}` : ''}`);
  },

  getReservation(id) {
    return request(`/reservations/${id}`);
  },

  getEvidences(id) {
    return request(`/reservations/${id}/evidences`);
  },

  getSupplementaryRecords(id) {
    return request(`/reservations/${id}/supplementary-records`);
  },

  getAuditLogs(id) {
    return request(`/reservations/${id}/audit-logs`);
  },

  createReservation(data) {
    return request('/reservations', { method: 'POST', body: data });
  },

  updateReservation(id, data) {
    return request(`/reservations/${id}`, { method: 'PUT', body: data });
  },

  submitReservation(id, expectedVersion) {
    return request(`/reservations/${id}/submit`, {
      method: 'POST',
      body: { expected_version: expectedVersion },
    });
  },

  labReview(id, pass, comment, expectedVersion) {
    return request(`/reservations/${id}/lab-review`, {
      method: 'POST',
      body: { pass, comment, expected_version: expectedVersion },
    });
  },

  collegeConfirm(id, pass, comment, expectedVersion) {
    return request(`/reservations/${id}/college-confirm`, {
      method: 'POST',
      body: { pass, comment, expected_version: expectedVersion },
    });
  },

  supplementEvidence(id, data) {
    return request(`/reservations/${id}/supplement-evidence`, {
      method: 'POST',
      body: data,
    });
  },

  batchOperation(ids, versions, operation, comment = '') {
    return request('/reservations/batch', {
      method: 'POST',
      body: {
        ids,
        expected_versions: versions,
        operation,
        comment,
      },
    });
  },
};
