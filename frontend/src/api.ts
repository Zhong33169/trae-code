import {
  FollowUpRecord, RecordListResponse, Patient,
  EvidenceResponse, User, BatchResult, ApiError, AuditLog,
} from './types';

const API_BASE = '/api';

function getHeaders(): HeadersInit {
  const role = localStorage.getItem('current_role') || 'triage_nurse';
  const username = localStorage.getItem('current_username') || 'nurse1';
  return {
    'Content-Type': 'application/json',
    'X-User-Role': role,
    'X-User-Name': username,
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: ApiError = {
      detail: errorData.detail || `请求失败: ${response.status}`,
      error_code: errorData.error_code || 'UNKNOWN_ERROR',
      field: errorData.field || null,
    };
    throw error;
  }
  return response.json();
}

export const api = {
  async getRecords(params: {
    status?: string;
    patient_name?: string;
    skip?: number;
    limit?: number;
  } = {}): Promise<RecordListResponse> {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.patient_name) searchParams.set('patient_name', params.patient_name);
    if (params.skip !== undefined) searchParams.set('skip', String(params.skip));
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));

    const response = await fetch(`${API_BASE}/records?${searchParams}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  async getRecord(id: number): Promise<FollowUpRecord> {
    const response = await fetch(`${API_BASE}/records/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  async createRecord(data: Partial<FollowUpRecord>): Promise<FollowUpRecord> {
    const response = await fetch(`${API_BASE}/records`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateRecord(id: number, data: {
    version: number;
    appointment_id?: number | null;
    visit_id?: number | null;
    follow_up_visit_id?: number | null;
    follow_up_type?: string;
    content?: string;
    result?: string;
    remarks?: string;
  }): Promise<FollowUpRecord> {
    const response = await fetch(`${API_BASE}/records/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async submitRecord(id: number, version: number): Promise<FollowUpRecord> {
    const response = await fetch(`${API_BASE}/records/${id}/submit`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ version }),
    });
    return handleResponse(response);
  },

  async rejectRecord(id: number, version: number, opinion: string): Promise<FollowUpRecord> {
    const response = await fetch(`${API_BASE}/records/${id}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ version, opinion }),
    });
    return handleResponse(response);
  },

  async processRecord(id: number, data: {
    version: number;
    opinion?: string;
    result?: string;
  }): Promise<FollowUpRecord> {
    const response = await fetch(`${API_BASE}/records/${id}/process`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async batchProcess(ids: number[], versionMap: Record<string, number>, opinion: string): Promise<BatchResult> {
    const response = await fetch(`${API_BASE}/batch/process`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ record_ids: ids, version_map: versionMap, opinion }),
    });
    return handleResponse(response);
  },

  async batchReject(ids: number[], versionMap: Record<string, number>, opinion: string): Promise<BatchResult> {
    const response = await fetch(`${API_BASE}/batch/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ record_ids: ids, version_map: versionMap, opinion }),
    });
    return handleResponse(response);
  },

  async getPatients(name?: string): Promise<Patient[]> {
    const searchParams = new URLSearchParams();
    if (name) searchParams.set('name', name);
    const response = await fetch(`${API_BASE}/patients?${searchParams}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  async getEvidence(patientId: number): Promise<EvidenceResponse> {
    const response = await fetch(`${API_BASE}/patients/${patientId}/evidence`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${API_BASE}/user/current`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  async getUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE}/users`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  async getRoles(): Promise<Record<string, { name: string; allowed_statuses: string[] }>> {
    const response = await fetch(`${API_BASE}/roles`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  async getAuditLogs(recordId: number): Promise<AuditLog[]> {
    const response = await fetch(`${API_BASE}/records/${recordId}/audit-logs`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  async healthCheck(): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE}/health`);
    return handleResponse(response);
  },
};
