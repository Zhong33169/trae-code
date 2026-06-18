// @ts-nocheck
import type { PageServerLoad } from './$types';
import { operationLogsApi, usersApi } from '$api';
import type { QueryParams } from '$api/operation-logs';

export const load = async ({ url, cookies }: Parameters<PageServerLoad>[0]) => {
  const token = cookies.get('access_token');
  const params: QueryParams = {
    page: parseInt(url.searchParams.get('page') || '1'),
    pageSize: parseInt(url.searchParams.get('pageSize') || '20'),
  };

  const operationType = url.searchParams.get('operationType');
  if (operationType) params.operationType = operationType as any;

  const operatorId = url.searchParams.get('operatorId');
  if (operatorId) params.operatorId = operatorId;

  try {
    const [logsResponse, usersResponse] = await Promise.all([
      operationLogsApi.getList(params, token),
      usersApi.getList(token),
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
