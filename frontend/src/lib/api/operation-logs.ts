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
  getList: (params?: QueryParams) =>
    api.get<PageResult<OperationLog>>('/operation-logs', params),

  getByProgressReportId: (progressReportId: string) =>
    api.get<OperationLog[]>(`/operation-logs/progress-report/${progressReportId}`),
};
