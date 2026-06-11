import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CheckinRecord,
  Attachment,
  AuditLog,
  ConsistencyIssue,
  BatchHandleResponse,
} from '../models';

const API_URL = '/api';

@Injectable({ providedIn: 'root' })
export class CheckinService {
  constructor(private http: HttpClient) {}

  list(params?: {
    status?: string;
    is_abnormal?: string;
    flight_no?: string;
    batch_no?: string;
    search?: string;
  }): Observable<{ records: CheckinRecord[]; role: string; allowed_actions: string[] }> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) httpParams = httpParams.set(k, v);
      });
    }
    return this.http.get<{ records: CheckinRecord[]; role: string; allowed_actions: string[] }>(
      `${API_URL}/checkin`,
      { params: httpParams }
    );
  }

  get(id: number): Observable<{
    record: CheckinRecord;
    consistency_issues: ConsistencyIssue[];
    role: string;
    allowed_actions: string[];
    valid_transitions: string[];
  }> {
    return this.http.get<{
      record: CheckinRecord;
      consistency_issues: ConsistencyIssue[];
      role: string;
      allowed_actions: string[];
      valid_transitions: string[];
    }>(`${API_URL}/checkin/${id}`);
  }

  create(data: Partial<CheckinRecord>): Observable<any> {
    return this.http.post(`${API_URL}/checkin`, data);
  }

  handleAction(
    id: number,
    action: string,
    body?: { result?: string; return_reason?: string; audit_remark?: string; remark?: string }
  ): Observable<any> {
    return this.http.post(`${API_URL}/checkin/${id}/${action}`, body || {});
  }

  batchHandle(body: {
    ids: number[];
    action: string;
    result?: string;
    remark?: string;
    return_reason?: string;
  }): Observable<BatchHandleResponse> {
    return this.http.post<BatchHandleResponse>(`${API_URL}/checkin/batch`, body);
  }

  getAttachments(id: number): Observable<Attachment[]> {
    return this.http.get<Attachment[]>(`${API_URL}/checkin/${id}/attachments`);
  }

  uploadAttachment(id: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${API_URL}/checkin/${id}/attachments`, formData);
  }

  deleteAttachment(id: number): Observable<any> {
    return this.http.delete(`${API_URL}/attachments/${id}`);
  }

  getAuditLogs(id: number): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${API_URL}/checkin/${id}/audit`);
  }

  getFailureLogs(): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${API_URL}/audit/failures`);
  }
}
