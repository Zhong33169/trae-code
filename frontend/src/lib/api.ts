const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function handle<T>(p: Promise<Response>): Promise<T> {
  const r = await p;
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const e = await r.json();
      if (e?.message) msg = Array.isArray(e.message) ? e.message.join('；') : e.message;
    } catch {}
    throw new Error(msg);
  }
  return (await r.json()) as T;
}

export const api = {
  getUsers: () => handle<any[]>(fetch(`${API_BASE}/reviews/users`)),
  getStatistics: () => handle<any>(fetch(`${API_BASE}/reviews/statistics`)),
  getReviews: (q: any = {}) => {
    const params = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v) params.set(k, v as string); });
    return handle<any[]>(fetch(`${API_BASE}/reviews?${params.toString()}`));
  },
  getDetail: (id: string) => handle<any>(fetch(`${API_BASE}/reviews/${id}`)),
  register: (body: any) => handle<any>(fetch(`${API_BASE}/reviews/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })),
  submitReview: (body: any) => handle<any>(fetch(`${API_BASE}/reviews/submit-review`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })),
  requestCorrection: (body: any) => handle<any>(fetch(`${API_BASE}/reviews/request-correction`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })),
  correct: (body: any) => handle<any>(fetch(`${API_BASE}/reviews/correct`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })),
  confirmComplete: (body: any) => handle<any>(fetch(`${API_BASE}/reviews/confirm-complete`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })),
  rejectReview: (body: any) => handle<any>(fetch(`${API_BASE}/reviews/reject-review`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })),
};

