// @ts-nocheck
import type { PageServerLoad } from './$types';
import { operationLogsApi, usersApi } from '$api';
import type { QueryParams } from '$api/operation-logs';

export const load = async ({ url }: Parameters<PageServerLoad>[0]) => {
  const params: QueryParams = {
    page: parseInt(url.searchParams.get('page') || '1'),
    pageSize: parseInt(url.searchParams.get('pageSize') || '20'),
  };

  const operationType = url.searchParams.get('operationType');
  if (operationType) params.operationType = operationType as any;

  const operatorId = url.searchParams.get('operatorId');
  if (operatorId) params.operatorId = operatorId;

  const startDate = url.searchParams.get('startDate');
  if (startDate) params.startDate = startDate;

  const endDate = url.searchParams.get('endDate');
  if (endDate) params.endDate = endDate;

  try {
    const [logsResponse, usersResponse] = await Promise.all([
      operationLogsApi.getList(params),
      usersApi.getList(),
    ]);

    return {
      logs: logsResponse.data,
      users: usersResponse.data,
      queryParams: params,
    };
  } catch (e) {
    return {
      logs: { list: [], total: 0 },
      users: [],
      queryParams: params,
    };
  }
};
