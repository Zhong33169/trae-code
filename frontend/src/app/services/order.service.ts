import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  ApiResponse, OrderSummary, OrderDetail, QueueStats,
  BatchResultItem, Evidence
} from '../models/app.models';

interface ListParams {
  status?: string;
  statusIn?: string[];
  keyword?: string;
  myCreated?: boolean;
  page?: number;
  pageSize?: number;
}

export type RefreshEvent =
  | { kind: 'all' }
  | { kind: 'queue' }
  | { kind: 'stats' }
  | { kind: 'preview'; orderId: number }
  | { kind: 'detail'; orderId: number }
  | { kind: 'roleChanged' };

export type WriteAction =
  | 'create' | 'submit' | 'audit' | 'review'
  | 'batchReview' | 'addEvidence' | 'deleteEvidence';

export interface WriteRequestMeta {
  requestId: string;
  action: WriteAction;
  sentAt: number;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly refresh$ = new Subject<RefreshEvent>();
  public readonly refreshEvents$ = this.refresh$.asObservable();

  constructor(private http: HttpClient) {}

  static newRequestId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  emit(event: RefreshEvent) { this.refresh$.next(event); }

  private emitOnSuccess<T extends { code: number }>(ev: RefreshEvent) {
    return tap<T>((r: T) => { if (r.code === 0) this.emit(ev); });
  }

  private idempotentHeaders(requestId: string): { headers: HttpHeaders } {
    return {
      headers: new HttpHeaders({ 'X-Request-Id': requestId })
    };
  }

  list(params: ListParams = {}): Observable<ApiResponse<{ rows: OrderSummary[]; total: number }>> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.statusIn?.length) httpParams = httpParams.set('statusIn', params.statusIn.join(','));
    if (params.keyword) httpParams = httpParams.set('keyword', params.keyword);
    if (params.myCreated) httpParams = httpParams.set('myCreated', '1');
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize);
    return this.http.get<ApiResponse<any>>('/api/orders', { params: httpParams });
  }

  stats(): Observable<ApiResponse<QueueStats>> {
    return this.http.get<ApiResponse<QueueStats>>('/api/orders/stats');
  }

  detail(id: number): Observable<ApiResponse<OrderDetail>> {
    return this.http.get<ApiResponse<OrderDetail>>(`/api/orders/${id}`);
  }

  create(data: any, requestId?: string): Observable<ApiResponse<OrderDetail>> {
    const rid = requestId || OrderService.newRequestId();
    return this.http.post<ApiResponse<OrderDetail>>(
      '/api/orders', data, this.idempotentHeaders(rid)
    ).pipe(this.emitOnSuccess({ kind: 'all' }));
  }

  submit(id: number, data: any & { version?: number }, requestId?: string): Observable<ApiResponse<OrderDetail>> {
    const rid = requestId || OrderService.newRequestId();
    return this.http.post<ApiResponse<OrderDetail>>(
      `/api/orders/${id}/submit`, data, this.idempotentHeaders(rid)
    ).pipe(this.emitOnSuccess({ kind: 'all' }));
  }

  audit(id: number, decision: 'approve' | 'reject', data: any & { version?: number } = {}, requestId?: string): Observable<ApiResponse<OrderDetail>> {
    const rid = requestId || OrderService.newRequestId();
    return this.http.post<ApiResponse<OrderDetail>>(
      `/api/orders/${id}/audit`, { ...data, decision }, this.idempotentHeaders(rid)
    ).pipe(this.emitOnSuccess({ kind: 'all' }));
  }

  review(id: number, decision: 'approve' | 'reject', data: any & { version?: number } = {}, requestId?: string): Observable<ApiResponse<OrderDetail>> {
    const rid = requestId || OrderService.newRequestId();
    return this.http.post<ApiResponse<OrderDetail>>(
      `/api/orders/${id}/review`, { ...data, decision }, this.idempotentHeaders(rid)
    ).pipe(this.emitOnSuccess({ kind: 'all' }));
  }

  batchReview(orderIds: number[], data: any = {}, requestId?: string): Observable<ApiResponse<BatchResultItem[]>> {
    const rid = requestId || OrderService.newRequestId();
    return this.http.post<ApiResponse<BatchResultItem[]>>(
      '/api/orders/batch-review', { orderIds, ...data }, this.idempotentHeaders(rid)
    ).pipe(this.emitOnSuccess({ kind: 'all' }));
  }

  addEvidence(orderId: number, data: Partial<Evidence> & { type: string; description: string; version?: number }, requestId?: string) {
    const rid = requestId || OrderService.newRequestId();
    return this.http.post<ApiResponse<any>>(
      `/api/orders/${orderId}/evidences`, data, this.idempotentHeaders(rid)
    ).pipe(this.emitOnSuccess({ kind: 'all' }));
  }

  deleteEvidence(evidenceId: number, data: any & { version?: number } = {}, requestId?: string) {
    const rid = requestId || OrderService.newRequestId();
    return this.http.request<ApiResponse<any>>(
      'DELETE', `/api/orders/evidences/${evidenceId}`,
      { body: data, ...this.idempotentHeaders(rid) }
    ).pipe(this.emitOnSuccess({ kind: 'all' }));
  }
}
