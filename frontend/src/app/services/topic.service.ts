import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

export interface Topic {
  id: string;
  topic_no: string;
  title: string;
  source: string;
  reporter: string;
  department: string;
  deadline?: string;
  status: string;
  content?: string;
  register_id: string;
  register_name?: string;
  register_at: string;
  reviewer_id?: string;
  reviewer_name?: string;
  review_at?: string;
  review_result?: string;
  review_comment?: string;
  archiver_id?: string;
  archiver_name?: string;
  archive_at?: string;
  archive_comment?: string;
  reject_reason?: string;
  anomaly_tag?: string;
  created_from: string;
  import_batch_id?: string;
}

export interface Attachment {
  id: string;
  topic_id: string;
  filename: string;
  file_type?: string;
  file_size?: number;
  uploaded_by: string;
  uploaded_by_name?: string;
  uploaded_at: string;
}

export interface AuditLog {
  id: string;
  topic_id?: string;
  import_batch_id?: string;
  user_id: string;
  user_name: string;
  action: string;
  old_status?: string;
  new_status?: string;
  detail?: string;
  created_at: string;
}

export interface ImportBatch {
  id: string;
  batch_no: string;
  source: string;
  operator_id: string;
  operator_name?: string;
  imported_at: string;
  total_count: number;
  success_count: number;
  conflict_count: number;
  error_count: number;
  remark?: string;
}

export interface ImportRecord {
  id: string;
  batch_id: string;
  topic_no: string;
  title?: string;
  status: 'success' | 'conflict' | 'error';
  diff_json?: string;
  error_msg?: string;
  topic_id?: string;
  process_status: 'pending' | 'submitted' | 'resolved' | 'not_applicable';
  process_remark?: string;
  processed_by?: string;
  processed_by_name?: string;
  processed_at?: string;
  decision_summary?: string;
  field_snapshot_old?: string;
  field_snapshot_new?: string;
  process_stage?: string;
}

export interface ProcessConflictRequest {
  action: 'submit' | 'resolve' | 'ignore';
  remark: string;
}

export interface ImportTopicItem {
  topic_no: string;
  title: string;
  source: string;
  reporter: string;
  department: string;
  deadline?: string;
  status?: string;
  content?: string;
}

export interface ImportResult {
  batch_id: string;
  batch_no: string;
  total_count: number;
  success_count: number;
  conflict_count: number;
  error_count: number;
  records: ImportRecord[];
}

@Injectable({ providedIn: 'root' })
export class TopicService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  private opts() {
    return { headers: this.auth.getAuthHeaders() };
  }

  listTopics(params?: { status?: string; anomaly?: string; keyword?: string }) {
    let query = '';
    if (params) {
      const parts: string[] = [];
      if (params.status) parts.push(`status=${encodeURIComponent(params.status)}`);
      if (params.anomaly) parts.push(`anomaly=${encodeURIComponent(params.anomaly)}`);
      if (params.keyword) parts.push(`keyword=${encodeURIComponent(params.keyword)}`);
      if (parts.length) query = '?' + parts.join('&');
    }
    return this.http.get<any>('/api/topics' + query, this.opts());
  }

  getTopic(id: string) {
    return this.http.get<any>(`/api/topics/${id}`, this.opts());
  }

  createTopic(data: any) {
    return this.http.post<any>('/api/topics', data, this.opts());
  }

  reviewTopic(id: string, data: any) {
    return this.http.post<any>(`/api/topics/${id}/review`, data, this.opts());
  }

  archiveTopic(id: string, data: any) {
    return this.http.post<any>(`/api/topics/${id}/archive`, data, this.opts());
  }

  rectifyTopic(id: string, data: any) {
    return this.http.post<any>(`/api/topics/${id}/rectify`, data, this.opts());
  }

  listAttachments(topicId: string) {
    return this.http.get<any>(`/api/topics/${topicId}/attachments`, this.opts());
  }

  addAttachment(topicId: string, data: any) {
    return this.http.post<any>(`/api/topics/${topicId}/attachments`, data, this.opts());
  }

  listBatches() {
    return this.http.get<any>('/api/import/batches', this.opts());
  }

  batchRecords(id: string) {
    return this.http.get<any>(`/api/import/batches/${id}/records`, this.opts());
  }

  executeImport(data: any) {
    return this.http.post<any>('/api/import/execute', data, this.opts());
  }

  processConflict(recordId: string, data: ProcessConflictRequest) {
    return this.http.post<any>(`/api/import/records/${recordId}/process`, data, this.opts());
  }

  listAudit(params?: { topic_id?: string; batch_id?: string }) {
    const parts: string[] = [];
    if (params?.topic_id) parts.push(`topic_id=${encodeURIComponent(params.topic_id)}`);
    if (params?.batch_id) parts.push(`batch_id=${encodeURIComponent(params.batch_id)}`);
    const q = parts.length ? '?' + parts.join('&') : '';
    return this.http.get<any>(`/api/audit/logs` + q, this.opts());
  }
}
