import { api } from './client';
import type { DeviationAnalysis } from '$types';

export const deviationAnalysisApi = {
  getList: (progressReportId?: string) =>
    api.get<DeviationAnalysis[]>('/deviation-analysis', progressReportId ? { progressReportId } : undefined),
};
