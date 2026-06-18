import { api } from './client';
import type { ProgressReport, PageResult, Statistics, ApiResponse } from '$types';
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
  getList: (params?: QueryParams) =>
    api.get<PageResult<ProgressReport>>('/progress-reports', params),

  getDetail: (id: string) => api.get<ProgressReport>(`/progress-reports/${id}`),

  create: (data: CreateProgressReportData) =>
    api.post<ProgressReport>('/progress-reports', data),

  update: (id: string, data: UpdateProgressReportData) =>
    api.patch<ProgressReport>(`/progress-reports/${id}`, data),

  submitForReview: (id: string, data?: SubmitReviewData) =>
    api.post<ProgressReport>(`/progress-reports/${id}/submit-review`, data || {}),

  startReview: (id: string) =>
    api.post<ProgressReport>(`/progress-reports/${id}/start-review`),

  review: (id: string, data: ReviewData) =>
    api.post<ProgressReport>(`/progress-reports/${id}/review`, data),

  startVerification: (id: string) =>
    api.post<ProgressReport>(`/progress-reports/${id}/start-verification`),

  verify: (id: string, data: VerifyData) =>
    api.post<ProgressReport>(`/progress-reports/${id}/verify`, data),

  correct: (id: string, data: CorrectData) =>
    api.post<ProgressReport>(`/progress-reports/${id}/correct`, data),

  handleTimeout: (id: string, data: HandleTimeoutData) =>
    api.post<ProgressReport>(`/progress-reports/${id}/handle-timeout`, data),

  delete: (id: string) => api.delete<void>(`/progress-reports/${id}`),

  getStatistics: () => api.get<Statistics>('/progress-reports/statistics'),
};
