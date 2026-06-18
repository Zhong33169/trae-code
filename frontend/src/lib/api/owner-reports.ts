import { api } from './client';
import type { OwnerReport } from '$types';

export interface CreateOwnerReportData {
  progressReportId: string;
  reportTitle: string;
  reportContent: string;
  reportDate: string;
}

export interface UpdateOwnerReportData {
  reportTitle?: string;
  reportContent?: string;
  reportDate?: string;
}

export const ownerReportsApi = {
  getList: (progressReportId?: string, authToken?: string | null) =>
    api.get<OwnerReport[]>('/owner-reports', progressReportId ? { progressReportId } : undefined, authToken),

  create: (data: CreateOwnerReportData, authToken?: string | null) =>
    api.post<OwnerReport>('/owner-reports', data, authToken),

  getDetail: (id: string, authToken?: string | null) =>
    api.get<OwnerReport>(`/owner-reports/${id}`, undefined, authToken),

  acknowledge: (id: string, feedback: string, authToken?: string | null) =>
    api.post<OwnerReport>(`/owner-reports/${id}/acknowledge`, { feedback }, authToken),

  update: (id: string, data: UpdateOwnerReportData, authToken?: string | null) =>
    api.patch<OwnerReport>(`/owner-reports/${id}`, data, authToken),

  delete: (id: string, authToken?: string | null) =>
    api.delete<void>(`/owner-reports/${id}`, authToken),
};
