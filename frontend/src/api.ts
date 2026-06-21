import type { User, Event, Statistics, AuditLog, AppConfig, QueueSummary, EventFilters, ScanCredential } from './types';

const DEFAULT_API_URL = 'http://localhost:8004';
const API_BASE = (import.meta.env.VITE_API_URL || process.env.API_URL || DEFAULT_API_URL) + '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

function setToken(token: string) {
  localStorage.setItem('token', token);
}

function clearToken() {
  localStorage.removeItem('token');
}

function getStoredUser(): User | null {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}

function setStoredUser(user: User) {
  localStorage.setItem('user', JSON.stringify(user));
}

function clearStoredUser() {
  localStorage.removeItem('user');
}

const SCAN_KEY_PREFIX = 'scan_credential_';
const FILTER_KEY = 'event_filters';

function getStoredFilters(): EventFilters {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    return raw ? JSON.parse(raw) : { role: '', status: '', event_type: '' };
  } catch (e) {
    return { role: '', status: '', event_type: '' };
  }
}

function setStoredFilters(filters: EventFilters) {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
  } catch (e) {}
}

function clearStoredFilters() {
  try {
    localStorage.removeItem(FILTER_KEY);
  } catch (e) {}
}

function saveScanCredential(eventId: number, cred: ScanCredential) {
  try {
    sessionStorage.setItem(`${SCAN_KEY_PREFIX}${eventId}`, JSON.stringify(cred));
  } catch (e) {}
}

function getScanCredential(eventId: number): ScanCredential | null {
  try {
    const raw = sessionStorage.getItem(`${SCAN_KEY_PREFIX}${eventId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearScanCredential(eventId: number) {
  try {
    sessionStorage.removeItem(`${SCAN_KEY_PREFIX}${eventId}`);
  } catch (e) {}
}

function clearAllScanCredentials() {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SCAN_KEY_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch (e) {}
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    throw { status: res.status, ...data };
  }
  return data as T;
}

async function login(username: string, password: string) {
  const data = await request<{ user: User; token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  setStoredUser(data.user);
  return data;
}

function logout() {
  clearToken();
  clearStoredUser();
  clearAllScanCredentials();
}

async function getMe() {
  return request<{ user: User }>('/auth/me');
}

async function listEvents(params: { role?: string; status?: string; event_type?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.role) qs.set('role', params.role);
  if (params.status) qs.set('status', params.status);
  if (params.event_type) qs.set('event_type', params.event_type);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<{ events: Event[] }>(`/events${query}`);
}

async function getEvent(id: number) {
  return request<{ event: Event }>(`/events/${id}`);
}

async function createEvent(data: {
  title: string;
  description: string;
  event_type: string;
  severity: string;
  deadline: string;
  materials: { name: string; material_type: string; content: string }[];
}) {
  return request<{ event: Event }>('/events', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function submitEvent(id: number, version: number, scan_record_id: number) {
  return request<{ event: Event }>(`/events/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ version, scan_record_id }),
  });
}

async function supplementEvent(
  id: number,
  version: number,
  scan_record_id: number,
  opinion: string,
  materials: { name: string; material_type: string; content: string }[],
) {
  return request<{ event: Event }>(`/events/${id}/supplement`, {
    method: 'POST',
    body: JSON.stringify({ version, scan_record_id, opinion, materials }),
  });
}

async function reviewEvent(
  id: number,
  version: number,
  scan_record_id: number,
  opinion: string,
  result: 'pass' | 'reject',
) {
  return request<{ event: Event }>(`/events/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ version, scan_record_id, opinion, result }),
  });
}

async function archiveReviewEvent(
  id: number,
  version: number,
  scan_record_id: number,
  opinion: string,
  result: 'archive' | 'reject',
) {
  return request<{ event: Event }>(`/events/${id}/archive-review`, {
    method: 'POST',
    body: JSON.stringify({ version, scan_record_id, opinion, result }),
  });
}

async function scanCode(code: string) {
  return request<{
    success: boolean;
    message: string;
    event?: Event;
    scan_record_id?: number;
    scan_token?: string;
    scanner?: { id: number; name: string; role: string };
  }>('/scan', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

async function batchProcess(data: {
  event_ids: number[];
  scan_record_ids: number[];
  action: string;
  result: string;
  opinion: string;
}) {
  return request<{ results: { id: number; success: boolean; message: string }[] }>('/events/batch', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function getStatistics() {
  return request<Statistics>('/statistics');
}

async function getQueueSummary() {
  return request<QueueSummary>('/queue-summary');
}

async function getAuditLog(eventId?: number) {
  const qs = eventId ? `?event_id=${eventId}` : '';
  return request<{ logs: AuditLog[] }>(`/audit-log${qs}`);
}

async function getConfig() {
  return request<AppConfig>('/config');
}

async function logFilterChange(filters: EventFilters) {
  return request<{ ok: boolean }>('/audit-log/filter-change', {
    method: 'POST',
    body: JSON.stringify(filters),
  });
}

export const api = {
  login,
  logout,
  getMe,
  getStoredUser,
  getStoredFilters,
  setStoredFilters,
  clearStoredFilters,
  listEvents,
  getEvent,
  createEvent,
  submitEvent,
  supplementEvent,
  reviewEvent,
  archiveReviewEvent,
  scanCode,
  batchProcess,
  getStatistics,
  getQueueSummary,
  getAuditLog,
  getConfig,
  logFilterChange,
  saveScanCredential,
  getScanCredential,
  clearScanCredential,
  clearAllScanCredentials,
};
