import { api } from './client';
import type { ProgressReport, PageResult, Statistics } from '$types';
import type { ProgressStatus, TimeoutStatus } from '$types';

export interface CreateProgressReportData {
  title: string;
  content?: string;
  deadline: string;
  reportDate?: string;
  projectName?: string;
  abnormalReason?: string;
  responsiblePersonId?: string;
}

export interface UpdateProgressReportData {
  title?: string;
  content?: string;
  deadline?: string;
  reportDate?: string;
  projectName?: string;
  abnormalReason?: string;
  responsiblePersonId?: string;
}

export interface SubmitReviewData {
  remarks?: string;
}

export interface ReviewData {
  approved: boolean;
  opinion: string;
}

export interface VerifyData {
  approved: boolean;
  opinion: string;
}

export interface CorrectData {
  title?: string;
  content?: string;
  abnormalReason?: string;
  correctionRemark: string;
}

export interface HandleTimeoutData {
  timeoutReason: string;
  timeoutFollowUp: string;
  remarks?: string;
}

export interface QueryParams {
  page?: number;
  pageSize?: number;
  status?: ProgressStatus;
  timeoutStatus?: TimeoutStatus;
  keyword?: string;
  responsiblePersonId?: string;
  startDate?: string;
  endDate?: string;
}

export const progressReportsApi = {
  getList: (params?: QueryParams, authToken?: string | null) =>
    api.get<PageResult<ProgressReport>>('/progress-reports', params, authToken),

  getDetail: (id: string, authToken?: string | null) =>
    api.get<ProgressReport>(`/progress-reports/${id}`, undefined, authToken),

  create: (data: CreateProgressReportData, authToken?: string | null) =>
    api.post<ProgressReport>('/progress-reports', data, authToken),

  update: (id: string, data: UpdateProgressReportData, authToken?: string | null) =>
    api.patch<ProgressReport>(`/progress-reports/${id}`, data, authToken),

  submitForReview: (id: string, data?: SubmitReviewData, authToken?: string | null) =>
    api.post<ProgressReport>(`/progress-reports/${id}/submit-review`, data || {}, authToken),

  startReview: (id: string, authToken?: string | null) =>
    api.post<ProgressReport>(`/progress-reports/${id}/start-review`, undefined, authToken),

  review: (id: string, data: ReviewData, authToken?: string | null) =>
    api.post<ProgressReport>(`/progress-reports/${id}/review`, data, authToken),

  startVerification: (id: string, authToken?: string | null) =>
    api.post<ProgressReport>(`/progress-reports/${id}/start-verification`, undefined, authToken),

  verify: (id: string, data: VerifyData, authToken?: string | null) =>
    api.post<ProgressReport>(`/progress-reports/${id}/verify`, data, authToken),

  correct: (id: string, data: CorrectData, authToken?: string | null) =>
    api.post<ProgressReport>(`/progress-reports/${id}/correct`, data, authToken),

  handleTimeout: (id: string, data: HandleTimeoutData, authToken?: string | null) =>
    api.post<ProgressReport>(`/progress-reports/${id}/handle-timeout`, data, authToken),

  delete: (id: string, authToken?: string | null) => api.delete<void>(`/progress-reports/${id}`, authToken),

  getStatistics: (authToken?: string | null) => api.get<Statistics>('/progress-reports/statistics', undefined, authToken),
};
