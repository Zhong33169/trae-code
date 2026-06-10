import { writable, derived, get } from 'svelte/store';
import { DEMO_USERS as _DEMO_USERS, ROLE_LABELS } from './constants.js';
import { api } from './api.js';

export const DEMO_USERS = _DEMO_USERS;

export const currentUserId = writable(1);

export const currentUser = derived(currentUserId, ($id) => {
  const user = DEMO_USERS.find((u) => u.id === $id);
  return user
    ? {
        ...user,
        role_display: ROLE_LABELS[user.role],
      }
    : null;
});

export const selectedReservationId = writable(null);

export const filterParams = writable({
  status: '',
  keyword: '',
  mineOnly: false,
  page: 1,
  pageSize: 20,
});

export const listData = writable({
  items: [],
  total: 0,
  loading: false,
  error: null,
});

export const detailData = writable({
  reservation: null,
  evidences: [],
  supplementaryRecords: [],
  auditLogs: [],
  loading: false,
  error: null,
});

let listLoadToken = 0;
let detailLoadToken = 0;

export async function loadReservations() {
  const token = ++listLoadToken;
  listData.update((d) => ({ ...d, loading: true, error: null }));

  try {
    const params = get(filterParams);
    const queryParams = {
      page: params.page,
      page_size: params.pageSize,
    };
    if (params.status) queryParams.status = params.status;
    if (params.keyword) queryParams.keyword = params.keyword;
    if (params.mineOnly) queryParams.mine_only = 'true';

    const data = await api.getReservations(queryParams);

    if (token === listLoadToken) {
      listData.set({
        items: data.items,
        total: data.total,
        loading: false,
        error: null,
      });
    }
  } catch (e) {
    if (token === listLoadToken) {
      listData.update((d) => ({ ...d, loading: false, error: e.message }));
    }
  }
}

export async function loadDetail(reservationId) {
  if (!reservationId) {
    detailData.set({
      reservation: null,
      evidences: [],
      supplementaryRecords: [],
      auditLogs: [],
      loading: false,
      error: null,
    });
    return;
  }

  const token = ++detailLoadToken;
  detailData.update((d) => ({ ...d, loading: true, error: null }));

  try {
    const [res, ev, sup, logs] = await Promise.all([
      api.getReservation(reservationId),
      api.getEvidences(reservationId),
      api.getSupplementaryRecords(reservationId),
      api.getAuditLogs(reservationId),
    ]);

    if (token === detailLoadToken) {
      detailData.set({
        reservation: res,
        evidences: ev,
        supplementaryRecords: sup,
        auditLogs: logs,
        loading: false,
        error: null,
      });
    }
  } catch (e) {
    if (token === detailLoadToken) {
      detailData.update((d) => ({ ...d, loading: false, error: e.message }));
    }
  }
}

export function refreshAll() {
  loadReservations();
  const selectedId = get(selectedReservationId);
  if (selectedId) {
    loadDetail(selectedId);
  }
}

export function switchUser(userId) {
  currentUserId.set(userId);
  selectedReservationId.set(null);
  filterParams.update((p) => ({ ...p, page: 1 }));
  refreshAll();
}

export function updateFilters(newFilters) {
  filterParams.update((p) => ({ ...p, ...newFilters, page: 1 }));
  refreshAll();
}

export function selectReservation(id) {
  selectedReservationId.set(id);
  if (id) {
    loadDetail(id);
  } else {
    detailData.set({
      reservation: null,
      evidences: [],
      supplementaryRecords: [],
      auditLogs: [],
      loading: false,
      error: null,
    });
  }
}

let userUnsubscribe = null;

export function initStores() {
  if (userUnsubscribe) return;
  userUnsubscribe = currentUserId.subscribe(() => {
    loadReservations();
  });
  loadReservations();
}
