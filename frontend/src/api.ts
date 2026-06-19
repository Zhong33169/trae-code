import type {
  SampleRecord,
  SampleStatusKey,
  UserRole,
  User,
  SampleEvidence,
  SampleAppeal,
  OperationLog,
  TemperatureRecord,
} from './types';

const API_BASE = (import.meta as any).env?.VITE_API_BASE ||
  `http://localhost:${(import.meta as any).env?.VITE_API_PORT || 8004}`;

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  errors?: { field?: string; message: string }[];
  error?: string;
}

async function request<T>(
  path: string,
  options: RequestInit & { headers?: Record<string, string> } = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  if (!text) return undefined as any;
  return JSON.parse(text);
}

export const api = {
  async health(): Promise<{ status: string; time: string }> {
    return request('/health');
  },

  async users(): Promise<User[]> {
    return request('/api/users');
  },

  async stats(): Promise<Record<string, number>> {
    return request('/api/samples/stats');
  },

  async listSamples(group: SampleStatusKey = 'pending', role?: UserRole): Promise<SampleRecord[]> {
    const qs = new URLSearchParams();
    qs.set('group', group);
    if (role) qs.set('role', role);
    return request(`/api/samples?${qs.toString()}`);
  },

  async getSample(id: string): Promise<{
    record: SampleRecord;
    evidences: SampleEvidence[];
    appeals: SampleAppeal[];
    logs: OperationLog[];
    temperatures: TemperatureRecord[];
  }> {
    return request(`/api/samples/${id}`);
  },

  async createSample(input: Partial<SampleRecord> & { operator: string }): Promise<SampleRecord> {
    return request('/api/samples', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async submitForReview(
    id: string,
    handler: string,
    role: UserRole,
    version: number,
    evidences: Omit<SampleEvidence, 'id' | 'sample_id' | 'uploaded_at'>[]
  ): Promise<{ ok: boolean; errors?: any[]; record?: SampleRecord }> {
    return request(`/api/samples/${id}/submit`, {
      method: 'POST',
      headers: {
        'X-Handler': handler,
        'X-Role': role,
        'X-Version': String(version),
      },
      body: JSON.stringify({ evidences }),
    });
  },

  async qcReview(
    id: string,
    handler: string,
    role: UserRole,
    version: number,
    decision: 'approve' | 'reject' | 'need_evidence',
    opinion?: string
  ): Promise<{ ok: boolean; errors?: any[]; record?: SampleRecord }> {
    return request(`/api/samples/${id}/qc-review`, {
      method: 'POST',
      headers: {
        'X-Handler': handler,
        'X-Role': role,
        'X-Version': String(version),
      },
      body: JSON.stringify({ decision, opinion }),
    });
  },

  async managerReview(
    id: string,
    handler: string,
    role: UserRole,
    version: number,
    decision: 'approve' | 'reject',
    opinion?: string
  ): Promise<{ ok: boolean; errors?: any[]; record?: SampleRecord }> {
    return request(`/api/samples/${id}/manager-review`, {
      method: 'POST',
      headers: {
        'X-Handler': handler,
        'X-Role': role,
        'X-Version': String(version),
      },
      body: JSON.stringify({ decision, opinion }),
    });
  },

  async submitAppeal(
    id: string,
    submitter: string,
    role: UserRole,
    version: number,
    reason: string
  ): Promise<{ ok: boolean; errors?: any[]; record?: SampleRecord }> {
    return request(`/api/samples/${id}/appeal`, {
      method: 'POST',
      headers: {
        'X-Handler': submitter,
        'X-Role': role,
        'X-Version': String(version),
      },
      body: JSON.stringify({ reason }),
    });
  },

  async reviewAppeal(
    id: string,
    handler: string,
    role: UserRole,
    decision: 'accept' | 'reject',
    opinion: string,
    rejectReason?: string
  ): Promise<{ ok: boolean; errors?: any[]; record?: SampleRecord }> {
    return request(`/api/samples/${id}/appeal-review`, {
      method: 'POST',
      headers: { 'X-Handler': handler, 'X-Role': role },
      body: JSON.stringify({ decision, opinion, rejectReason }),
    });
  },

  async resubmitAppeal(
    id: string,
    submitter: string,
    role: UserRole,
    version: number,
    reason: string
  ): Promise<{ ok: boolean; errors?: any[]; record?: SampleRecord }> {
    return request(`/api/samples/${id}/appeal-resubmit`, {
      method: 'POST',
      headers: {
        'X-Handler': submitter,
        'X-Role': role,
        'X-Version': String(version),
      },
      body: JSON.stringify({ reason }),
    });
  },
};
