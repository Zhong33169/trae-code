import { api } from './client';
import type { DeviationAnalysis } from '$types';

export interface CreateDeviationAnalysisData {
  progressReportId: string;
  deviationDescription: string;
  causeAnalysis: string;
  impactAssessment: string;
  correctionMeasures: string;
  deviationPercentage: number;
}

export interface UpdateDeviationAnalysisData {
  deviationDescription?: string;
  causeAnalysis?: string;
  impactAssessment?: string;
  correctionMeasures?: string;
  deviationPercentage?: number;
}

export const deviationAnalysisApi = {
  getList: (progressReportId?: string, authToken?: string | null) =>
    api.get<DeviationAnalysis[]>('/deviation-analysis', progressReportId ? { progressReportId } : undefined, authToken),

  create: (data: CreateDeviationAnalysisData, authToken?: string | null) =>
    api.post<DeviationAnalysis>('/deviation-analysis', data, authToken),

  getDetail: (id: string, authToken?: string | null) =>
    api.get<DeviationAnalysis>(`/deviation-analysis/${id}`, undefined, authToken),

  approve: (id: string, opinion: string, authToken?: string | null) =>
    api.post<DeviationAnalysis>(`/deviation-analysis/${id}/approve`, { opinion }, authToken),

  update: (id: string, data: UpdateDeviationAnalysisData, authToken?: string | null) =>
    api.patch<DeviationAnalysis>(`/deviation-analysis/${id}`, data, authToken),

  delete: (id: string, authToken?: string | null) =>
    api.delete<void>(`/deviation-analysis/${id}`, authToken),
};
