import { api } from './client';
import type { DeviationAnalysis } from '$types';

export const deviationAnalysisApi = {
  getList: (progressReportId?: string, authToken?: string | null) =>
    api.get<DeviationAnalysis[]>('/deviation-analysis', progressReportId ? { progressReportId } : undefined, authToken),
};
