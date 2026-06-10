import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RepairOrder, RiskLevel } from '../models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly baseUrl = `${environment.apiBaseUrl}/orders`;
  constructor(private http: HttpClient) {}

  getOrders(params?: {
    view?: string;
    status?: string;
    stage?: string;
    risk?: string;
  }): Observable<RepairOrder[]> {
    let httpParams = new HttpParams();
    if (params?.view) httpParams = httpParams.set('view', params.view);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.stage) httpParams = httpParams.set('stage', params.stage);
    if (params?.risk) httpParams = httpParams.set('risk', params.risk);
    return this.http.get<RepairOrder[]>(this.baseUrl, { params: httpParams });
  }

  getOrder(id: number): Observable<RepairOrder> {
    return this.http.get<RepairOrder>(`${this.baseUrl}/${id}`);
  }

  createOrder(data: any): Observable<RepairOrder> {
    return this.http.post<RepairOrder>(this.baseUrl, data);
  }

  deleteOrder(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  submitOrder(id: number, payload: { version: number }): Observable<RepairOrder> {
    return this.http.post<RepairOrder>(`${this.baseUrl}/${id}/submit`, payload);
  }

  supervisorReview(id: number, payload: {
    version: number;
    action: 'approve' | 'reject' | 'escalate_risk';
    opinion: string;
    result: string;
    risk_override?: RiskLevel;
  }): Observable<RepairOrder> {
    return this.http.post<RepairOrder>(`${this.baseUrl}/${id}/supervisor-review`, payload);
  }

  reviewerReview(id: number, payload: {
    version: number;
    action: 'approve' | 'reject';
    opinion: string;
    result: string;
    final_cost?: number;
  }): Observable<RepairOrder> {
    return this.http.post<RepairOrder>(`${this.baseUrl}/${id}/reviewer-review`, payload);
  }

  rectifyOrder(id: number, payload: {
    version: number;
    customer_name?: string;
    phone?: string;
    vehicle_plate?: string;
    vehicle_model?: string;
    mileage?: number;
    problem_description?: string;
    repair_items?: string;
    estimated_cost?: number;
    evidence_submitted: boolean;
    evidence_list?: string;
    opinion: string;
  }): Observable<RepairOrder> {
    return this.http.post<RepairOrder>(`${this.baseUrl}/${id}/rectify`, payload);
  }

  riskChange(id: number, payload: {
    version: number;
    from_level: RiskLevel;
    to_level: RiskLevel;
    reason: string;
  }): Observable<RepairOrder> {
    return this.http.post<RepairOrder>(`${this.baseUrl}/${id}/risk-change`, payload);
  }
}
