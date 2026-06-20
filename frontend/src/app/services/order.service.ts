import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(private http: HttpClient) {}

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
    return this.http.post<ApiResponse<OrderDetail>>('/api/orders', data);
  }

  submit(id: number, data: any): Observable<ApiResponse<OrderDetail>> {
    return this.http.post<ApiResponse<OrderDetail>>(`/api/orders/${id}/submit`, data);
  }

  audit(id: number, decision: 'approve' | 'reject', data: any = {}): Observable<ApiResponse<OrderDetail>> {
    return this.http.post<ApiResponse<OrderDetail>>(`/api/orders/${id}/audit`, { ...data, decision });
  }

  review(id: number, decision: 'approve' | 'reject', data: any = {}): Observable<ApiResponse<OrderDetail>> {
    return this.http.post<ApiResponse<OrderDetail>>(`/api/orders/${id}/review`, { ...data, decision });
  }

  batchReview(orderIds: number[], data: any = {}): Observable<ApiResponse<BatchResultItem[]>> {
    return this.http.post<ApiResponse<BatchResultItem[]>>('/api/orders/batch-review', { orderIds, ...data });
  }

  addEvidence(orderId: number, data: Partial<Evidence> & { type: string; description: string }) {
    return this.http.post<ApiResponse<any>>(`/api/orders/${orderId}/evidences`, data);
  }

  deleteEvidence(evidenceId: number) {
    return this.http.delete<ApiResponse<any>>(`/api/orders/evidences/${evidenceId}`);
  }
}
