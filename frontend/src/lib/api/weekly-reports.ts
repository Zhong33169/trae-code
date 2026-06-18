import { api } from './client';
import type { WeeklyReport } from '$types';

export const weeklyReportsApi = {
  getList: (progressReportId?: string, authToken?: string | null) =>
    api.get<WeeklyReport[]>('/weekly-reports', progressReportId ? { progressReportId } : undefined, authToken),
};
