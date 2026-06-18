import { api } from './client';
import type { OperationLog, PageResult } from '$types';
import type { OperationType } from '$types';

export interface QueryParams {
  page?: number;
  pageSize?: number;
  operatorId?: string;
  operationType?: OperationType;
  progressReportId?: string;
}

export const operationLogsApi = {
  getList: (params?: QueryParams, authToken?: string | null) =>
    api.get<PageResult<OperationLog>>('/operation-logs', params, authToken),

  getByProgressReportId: (progressReportId: string, authToken?: string | null) =>
    api.get<OperationLog[]>(`/operation-logs/progress-report/${progressReportId}`, undefined, authToken),
};
