import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly refresh$ = new Subject<RefreshEvent>();
  public readonly refreshEvents$ = this.refresh$.asObservable();

  constructor(private http: HttpClient) {}

  emit(event: RefreshEvent) { this.refresh$.next(event); }

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

  create(data: any): Observable<ApiResponse<OrderDetail>> {
    const req = this.http.post<ApiResponse<OrderDetail>>('/api/orders', data);
    req.subscribe({ next: () => this.emit({ kind: 'all' }) });
    return req;
  }

  submit(id: number, data: any): Observable<ApiResponse<OrderDetail>> {
    const req = this.http.post<ApiResponse<OrderDetail>>(`/api/orders/${id}/submit`, data);
    req.subscribe({ next: r => { if (r.code === 0) this.emit({ kind: 'all' }); } });
    return req;
  }

  audit(id: number, decision: 'approve' | 'reject', data: any = {}): Observable<ApiResponse<OrderDetail>> {
    const req = this.http.post<ApiResponse<OrderDetail>>(`/api/orders/${id}/audit`, { ...data, decision });
    req.subscribe({ next: r => { if (r.code === 0) this.emit({ kind: 'all' }); } });
    return req;
  }

  review(id: number, decision: 'approve' | 'reject', data: any = {}): Observable<ApiResponse<OrderDetail>> {
    const req = this.http.post<ApiResponse<OrderDetail>>(`/api/orders/${id}/review`, { ...data, decision });
    req.subscribe({ next: r => { if (r.code === 0) this.emit({ kind: 'all' }); } });
    return req;
  }

  batchReview(orderIds: number[], data: any = {}): Observable<ApiResponse<BatchResultItem[]>> {
    const req = this.http.post<ApiResponse<BatchResultItem[]>>('/api/orders/batch-review', { orderIds, ...data });
    req.subscribe({ next: r => { if (r.code === 0) this.emit({ kind: 'all' }); } });
    return req;
  }

  addEvidence(orderId: number, data: Partial<Evidence> & { type: string; description: string }) {
    const req = this.http.post<ApiResponse<any>>(`/api/orders/${orderId}/evidences`, data);
    req.subscribe({ next: r => { if (r.code === 0) this.emit({ kind: 'all' }); } });
    return req;
  }

  deleteEvidence(evidenceId: number) {
    const req = this.http.delete<ApiResponse<any>>(`/api/orders/evidences/${evidenceId}`);
    req.subscribe({ next: r => { if (r.code === 0) this.emit({ kind: 'all' }); } });
    return req;
  }
}
