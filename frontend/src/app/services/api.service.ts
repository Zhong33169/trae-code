import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import {
  ReleaseApplication, ReleaseListResponse, RollbackPlan,
  PostLaunchReview, ShiftHandover, OperationLog, Statistics,
  BatchOperationResult
} from '../models/release.model';
import { User } from '../models/auth.model';

const API_URL = 'http://localhost:8002/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders() {
    return { headers: this.authService.getAuthHeaders() };
  }

  getReleaseApplications(params: {
    skip?: number;
    limit?: number;
    status?: string;
    project_name?: string;
    keyword?: string;
    my?: boolean;
  } = {}): Observable<ReleaseListResponse> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return this.http.get<ReleaseListResponse>(`${API_URL}/release-applications`, {
      ...this.getHeaders(),
      params: httpParams
    });
  }

  getReleaseApplication(id: number): Observable<ReleaseApplication> {
    return this.http.get<ReleaseApplication>(`${API_URL}/release-applications/${id}`, this.getHeaders());
  }

  createReleaseApplication(data: any): Observable<ReleaseApplication> {
    return this.http.post<ReleaseApplication>(`${API_URL}/release-applications`, data, this.getHeaders());
  }

  updateReleaseApplication(id: number, data: any): Observable<ReleaseApplication> {
    return this.http.put<ReleaseApplication>(`${API_URL}/release-applications/${id}`, data, this.getHeaders());
  }

  submitForReview(id: number): Observable<ReleaseApplication> {
    return this.http.post<ReleaseApplication>(`${API_URL}/release-applications/${id}/submit-review`, {}, this.getHeaders());
  }

  reviewApprove(id: number, comment?: string): Observable<ReleaseApplication> {
    return this.http.post<ReleaseApplication>(`${API_URL}/release-applications/${id}/review-approve`, { comment }, this.getHeaders());
  }

  reviewReject(id: number, comment?: string): Observable<ReleaseApplication> {
    return this.http.post<ReleaseApplication>(`${API_URL}/release-applications/${id}/review-reject`, { comment }, this.getHeaders());
  }

  submitForRecheck(id: number): Observable<ReleaseApplication> {
    return this.http.post<ReleaseApplication>(`${API_URL}/release-applications/${id}/submit-recheck`, {}, this.getHeaders());
  }

  recheckApprove(id: number, comment?: string): Observable<ReleaseApplication> {
    return this.http.post<ReleaseApplication>(`${API_URL}/release-applications/${id}/recheck-approve`, { comment }, this.getHeaders());
  }

  recheckReject(id: number, comment?: string): Observable<ReleaseApplication> {
    return this.http.post<ReleaseApplication>(`${API_URL}/release-applications/${id}/recheck-reject`, { comment }, this.getHeaders());
  }

  publishRelease(id: number): Observable<ReleaseApplication> {
    return this.http.post<ReleaseApplication>(`${API_URL}/release-applications/${id}/publish`, {}, this.getHeaders());
  }

  rollbackRelease(id: number, comment?: string): Observable<ReleaseApplication> {
    return this.http.post<ReleaseApplication>(`${API_URL}/release-applications/${id}/rollback`, { comment }, this.getHeaders());
  }

  archiveRelease(id: number): Observable<ReleaseApplication> {
    return this.http.post<ReleaseApplication>(`${API_URL}/release-applications/${id}/archive`, {}, this.getHeaders());
  }

  batchOperation(ids: number[], operation: string, comment?: string): Observable<BatchOperationResult> {
    return this.http.post<BatchOperationResult>(`${API_URL}/release-applications/batch`, {
      ids, operation, comment
    }, this.getHeaders());
  }

  getRollbackPlan(appId: number): Observable<RollbackPlan> {
    return this.http.get<RollbackPlan>(`${API_URL}/rollback-plans/${appId}`, this.getHeaders());
  }

  createRollbackPlan(data: any): Observable<RollbackPlan> {
    return this.http.post<RollbackPlan>(`${API_URL}/rollback-plans`, data, this.getHeaders());
  }

  updateRollbackPlan(planId: number, data: any): Observable<RollbackPlan> {
    return this.http.put<RollbackPlan>(`${API_URL}/rollback-plans/${planId}`, data, this.getHeaders());
  }

  approveRollbackPlan(planId: number): Observable<RollbackPlan> {
    return this.http.post<RollbackPlan>(`${API_URL}/rollback-plans/${planId}/approve`, {}, this.getHeaders());
  }

  getPostLaunchReview(appId: number): Observable<PostLaunchReview> {
    return this.http.get<PostLaunchReview>(`${API_URL}/post-launch-reviews/${appId}`, this.getHeaders());
  }

  createPostLaunchReview(data: any): Observable<PostLaunchReview> {
    return this.http.post<PostLaunchReview>(`${API_URL}/post-launch-reviews`, data, this.getHeaders());
  }

  updatePostLaunchReview(reviewId: number, data: any): Observable<PostLaunchReview> {
    return this.http.put<PostLaunchReview>(`${API_URL}/post-launch-reviews/${reviewId}`, data, this.getHeaders());
  }

  completePostLaunchReview(reviewId: number): Observable<PostLaunchReview> {
    return this.http.post<PostLaunchReview>(`${API_URL}/post-launch-reviews/${reviewId}/complete`, {}, this.getHeaders());
  }

  getShiftHandovers(params: { app_id?: number; my?: boolean } = {}): Observable<ShiftHandover[]> {
    let httpParams = new HttpParams();
    if (params.app_id) httpParams = httpParams.set('app_id', params.app_id);
    if (params.my) httpParams = httpParams.set('my', 'true');
    return this.http.get<ShiftHandover[]>(`${API_URL}/shift-handovers`, {
      ...this.getHeaders(),
      params: httpParams
    });
  }

  createShiftHandover(data: any): Observable<ShiftHandover> {
    return this.http.post<ShiftHandover>(`${API_URL}/shift-handovers`, data, this.getHeaders());
  }

  confirmShiftHandover(handoverId: number): Observable<ShiftHandover> {
    return this.http.post<ShiftHandover>(`${API_URL}/shift-handovers/${handoverId}/confirm`, {}, this.getHeaders());
  }

  getOperationLogs(params: { app_id?: number; skip?: number; limit?: number } = {}): Observable<any> {
    let httpParams = new HttpParams();
    if (params.app_id) httpParams = httpParams.set('app_id', params.app_id);
    if (params.skip !== undefined) httpParams = httpParams.set('skip', params.skip);
    if (params.limit !== undefined) httpParams = httpParams.set('limit', params.limit);
    return this.http.get<any>(`${API_URL}/operation-logs`, {
      ...this.getHeaders(),
      params: httpParams
    });
  }

  getStatistics(): Observable<Statistics> {
    return this.http.get<Statistics>(`${API_URL}/statistics`, this.getHeaders());
  }

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${API_URL}/users`, this.getHeaders());
  }
}
