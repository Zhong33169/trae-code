import { api } from './client';
import type { OwnerReport } from '$types';

export const ownerReportsApi = {
  getList: (progressReportId?: string, authToken?: string | null) =>
    api.get<OwnerReport[]>('/owner-reports', progressReportId ? { progressReportId } : undefined, authToken),
};
