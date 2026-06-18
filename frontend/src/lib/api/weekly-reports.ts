import { api } from './client';
import type { WeeklyReport } from '$types';

export interface CreateWeeklyReportData {
  progressReportId: string;
  weekStartDate: string;
  weekEndDate: string;
  weekProgress?: string;
  nextWeekPlan?: string;
  existingProblems?: string;
  completionRate: number;
}

export interface UpdateWeeklyReportData {
  weekStartDate?: string;
  weekEndDate?: string;
  weekProgress?: string;
  nextWeekPlan?: string;
  existingProblems?: string;
  completionRate?: number;
}

export const weeklyReportsApi = {
  getList: (progressReportId?: string, authToken?: string | null) =>
    api.get<WeeklyReport[]>('/weekly-reports', progressReportId ? { progressReportId } : undefined, authToken),

  create: (data: CreateWeeklyReportData, authToken?: string | null) =>
    api.post<WeeklyReport>('/weekly-reports', data, authToken),

  getDetail: (id: string, authToken?: string | null) =>
    api.get<WeeklyReport>(`/weekly-reports/${id}`, undefined, authToken),

  update: (id: string, data: UpdateWeeklyReportData, authToken?: string | null) =>
    api.patch<WeeklyReport>(`/weekly-reports/${id}`, data, authToken),

  delete: (id: string, authToken?: string | null) =>
    api.delete<void>(`/weekly-reports/${id}`, authToken),
};
