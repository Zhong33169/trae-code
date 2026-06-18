// @ts-nocheck
import type { PageServerLoad } from './$types';
import { progressReportsApi, usersApi } from '$api';
import type { QueryParams } from '$api/progress-reports';

export const load = async ({ url, cookies }: Parameters<PageServerLoad>[0]) => {
  const token = cookies.get('access_token');
  const params: QueryParams = {
    page: parseInt(url.searchParams.get('page') || '1'),
    pageSize: parseInt(url.searchParams.get('pageSize') || '10'),
  };

  const status = url.searchParams.get('status');
  if (status) params.status = status as any;

  const timeoutStatus = url.searchParams.get('timeoutStatus');
  if (timeoutStatus) params.timeoutStatus = timeoutStatus as any;

  const keyword = url.searchParams.get('keyword');
  if (keyword) params.keyword = keyword;

  const responsiblePersonId = url.searchParams.get('responsiblePersonId');
  if (responsiblePersonId) params.responsiblePersonId = responsiblePersonId;

  const startDate = url.searchParams.get('startDate');
  if (startDate) params.startDate = startDate;

  const endDate = url.searchParams.get('endDate');
  if (endDate) params.endDate = endDate;

  try {
    const [reportsResponse, usersResponse, statsResponse] = await Promise.all([
      progressReportsApi.getList(params, token),
      usersApi.getList(token),
      progressReportsApi.getStatistics(token),
    ]);

    return {
      reports: reportsResponse.data,
      users: usersResponse.data,
      statistics: statsResponse.data,
      queryParams: params,
    };
  } catch (e) {
    return {
      reports: { list: [], total: 0 },
      users: [],
      statistics: null,
      queryParams: params,
    };
  }
};
