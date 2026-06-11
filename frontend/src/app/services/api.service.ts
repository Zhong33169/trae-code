import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, throwError } from 'rxjs';
import { User, TransportOrder, BatchChange, AuditLog, Evidence, OrderStatus, EvidenceType } from '../models';

const API_BASE = '/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private currentUser$ = new BehaviorSubject<User | null>(null);
  private userIdKey = 'transport_current_user_id';

  constructor(private http: HttpClient) {
    const savedId = localStorage.getItem(this.userIdKey);
    if (savedId) {
      this.setCurrentUserById(parseInt(savedId, 10)).subscribe({
        error: () => this.clearCurrentUser(),
      });
    }
  }

  getCurrentUser(): Observable<User | null> {
    return this.currentUser$.asObservable();
  }

  getCurrentUserId(): number | null {
    return this.currentUser$.value?.id ?? null;
  }

  setCurrentUser(user: User): void {
    this.currentUser$.next(user);
    localStorage.setItem(this.userIdKey, String(user.id));
  }

  setCurrentUserById(userId: number): Observable<User> {
    return this.http.get<User>(`${API_BASE}/auth/me`, { headers: this.getHeaders(userId) }).pipe(
      tap((user) => this.setCurrentUser(user))
    );
  }

  clearCurrentUser(): void {
    this.currentUser$.next(null);
    localStorage.removeItem(this.userIdKey);
  }

  listUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${API_BASE}/auth/users`);
  }

  listOrders(status?: string, keyword?: string): Observable<TransportOrder[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (keyword) params.set('keyword', keyword);
    const qs = params.toString();
    return this.http.get<TransportOrder[]>(`${API_BASE}/orders${qs ? '?' + qs : ''}`, {
      headers: this.getAuthHeaders(),
    });
  }

  getOrder(id: number): Observable<TransportOrder> {
    return this.http.get<TransportOrder>(`${API_BASE}/orders/${id}`, { headers: this.getAuthHeaders() });
  }

  createOrder(data: any): Observable<TransportOrder> {
    return this.http.post<TransportOrder>(`${API_BASE}/orders`, data, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  updateOrder(id: number, data: any): Observable<TransportOrder> {
    return this.http.put<TransportOrder>(`${API_BASE}/orders/${id}`, data, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  transitionOrder(id: number, data: { target_status: OrderStatus; expected_version: number; remark?: string }): Observable<TransportOrder> {
    return this.http.post<TransportOrder>(`${API_BASE}/orders/${id}/transition`, data, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  uploadEvidence(orderId: number, data: { evidence_type: EvidenceType; file_name: string; file_ref: string; remark?: string }): Observable<Evidence> {
    return this.http.post<Evidence>(`${API_BASE}/orders/${orderId}/evidences`, data, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  listBatches(): Observable<BatchChange[]> {
    return this.http.get<BatchChange[]>(`${API_BASE}/batches`, { headers: this.getAuthHeaders() });
  }

  getBatch(id: number): Observable<BatchChange> {
    return this.http.get<BatchChange>(`${API_BASE}/batches/${id}`, { headers: this.getAuthHeaders() });
  }

  createBatch(data: { order_ids: number[]; target_status: OrderStatus; change_type?: string }): Observable<BatchChange> {
    return this.http.post<BatchChange>(`${API_BASE}/batches`, data, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  executeBatch(id: number): Observable<BatchChange> {
    return this.http.post<BatchChange>(`${API_BASE}/batches/${id}/execute`, {}, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  retryBatch(id: number, batchItemIds: number[]): Observable<BatchChange> {
    return this.http.post<BatchChange>(`${API_BASE}/batches/${id}/retry`, { batch_item_ids: batchItemIds }, { headers: this.getAuthHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  listAuditLogs(orderId?: number, batchId?: number): Observable<AuditLog[]> {
    const params = new URLSearchParams();
    if (orderId) params.set('order_id', String(orderId));
    if (batchId) params.set('batch_id', String(batchId));
    const qs = params.toString();
    return this.http.get<AuditLog[]>(`${API_BASE}/audit${qs ? '?' + qs : ''}`, { headers: this.getAuthHeaders() });
  }

  private getAuthHeaders(): HttpHeaders {
    const userId = this.currentUser$.value?.id;
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(userId ? { 'X-User-Id': String(userId) } : {}),
    });
  }

  private getHeaders(userId: number): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'X-User-Id': String(userId),
    });
  }

  private handleError(error: HttpErrorResponse) {
    let message = '请求失败';
    if (error.error && typeof error.error === 'object') {
      const detail = error.error.detail;
      if (typeof detail === 'string') {
        message = detail;
      } else if (detail && typeof detail === 'object' && detail.error) {
        message = detail.error;
      }
    } else if (error.message) {
      message = error.message;
    }
    return throwError(() => new Error(message));
  }
}
