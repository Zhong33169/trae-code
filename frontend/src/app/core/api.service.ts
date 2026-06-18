import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActionType, ApiError, AppUser, AuditLog, Batch, BatchItem, Task, TaskStatus } from './models';

export const API_BASE = 'http://localhost:8005';

interface ApiEnvelope<T> { data: T; }
interface ErrEnvelope { error: ApiError; }

function toApiError(e: unknown): ApiError {
  if (e instanceof HttpErrorResponse) {
    const body = e.error as ErrEnvelope | ApiError | null;
    if (body && typeof body === 'object' && 'error' in body && body.error) return body.error;
    if (body && typeof body === 'object' && 'code' in (body as ApiError)) return body as ApiError;
    return { code: 'HTTP', message: `请求失败（HTTP ${e.status}）` };
  }
  return { code: 'NETWORK', message: '网络错误，请确认后端服务已启动（端口 8005）' };
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  private async call<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown, params?: HttpParams): Promise<T> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const obs$ = method === 'GET'
      ? this.http.get<ApiEnvelope<T>>(`${API_BASE}${path}`, { headers, params })
      : method === 'POST'
        ? this.http.post<ApiEnvelope<T>>(`${API_BASE}${path}`, body, { headers })
        : this.http.put<ApiEnvelope<T>>(`${API_BASE}${path}`, body, { headers });
    try {
      const res = await firstValueFrom(obs$);
      return res.data;
    } catch (e) {
      throw toApiError(e);
    }
  }

  me(): Promise<AppUser> { return this.call<AppUser>('GET', '/api/me'); }

  listTasks(opts: { status?: TaskStatus | ''; batchId?: string; q?: string; page?: number; size?: number } = {}): Promise<{ total: number; items: Task[] }> {
    let params = new HttpParams();
    if (opts.status) params = params.set('status', opts.status);
    if (opts.batchId) params = params.set('batchId', opts.batchId);
    if (opts.q) params = params.set('q', opts.q);
    if (opts.page != null) params = params.set('page', opts.page);
    if (opts.size != null) params = params.set('size', opts.size);
    return this.call('GET', '/api/tasks', undefined, params);
  }

  getTask(id: number): Promise<{ task: Task; auditLogs: AuditLog[] }> {
    return this.call('GET', `/api/tasks/${id}`);
  }

  createTask(payload: {
    policyNo: string; customerName: string; product: string;
    renewalType: string; originalPremium: number; newPremium: number; regEvidence: string;
  }): Promise<Task> { return this.call('POST', '/api/tasks', payload); }

  updateTask(id: number, version: number, patch: Partial<{
    policyNo: string; customerName: string; product: string;
    renewalType: string; originalPremium: number; newPremium: number; regEvidence: string;
  }>): Promise<Task> { return this.call('PUT', `/api/tasks/${id}`, { ...patch, version }); }

  transition(id: number, payload: { action: ActionType; version: number; evidence: string; reason?: string }): Promise<Task> {
    return this.call('POST', `/api/tasks/${id}/transition`, payload);
  }

  createBatch(payload: { action: ActionType; taskIds: number[]; evidence?: string; reason?: string; versions: Record<number, number> }): Promise<{ batch: Batch; items: BatchItem[] }> {
    return this.call('POST', '/api/batches', payload);
  }

  listBatches(): Promise<Batch[]> { return this.call('GET', '/api/batches'); }

  getBatch(id: number): Promise<{ batch: Batch; items: BatchItem[]; auditLogs: AuditLog[] }> {
    return this.call('GET', `/api/batches/${id}`);
  }

  retryBatch(id: number, payload: { itemIds: number[]; evidence?: string; reason?: string; versions: Record<number, number> }): Promise<{ batch: Batch; items: BatchItem[] }> {
    return this.call('POST', `/api/batches/${id}/retry`, payload);
  }

  listAudit(opts: { taskId?: number; batchId?: number; limit?: number } = {}): Promise<AuditLog[]> {
    let params = new HttpParams();
    if (opts.taskId != null) params = params.set('taskId', opts.taskId);
    if (opts.batchId != null) params = params.set('batchId', opts.batchId);
    return this.call('GET', '/api/audit', undefined, params);
  }
}
