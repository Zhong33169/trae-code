// @ts-nocheck
import type { PageServerLoad } from './$types';
import { progressReportsApi, operationLogsApi, weeklyReportsApi, deviationAnalysisApi, ownerReportsApi } from '$api';
import { error } from '@sveltejs/kit';

export const load = async ({ params, cookies }: Parameters<PageServerLoad>[0]) => {
  const token = cookies.get('access_token');
  try {
    const [
      reportResponse,
      logsResponse,
      weeklyResponse,
      deviationResponse,
      ownerResponse,
    ] = await Promise.all([
      progressReportsApi.getDetail(params.id, token),
      operationLogsApi.getList({ progressReportId: params.id, page: 1, pageSize: 100 }, token),
      weeklyReportsApi.getList(params.id, token),
      deviationAnalysisApi.getList(params.id, token),
      ownerReportsApi.getList(params.id, token),
    ]);

    return {
      report: reportResponse.data,
      operationLogs: logsResponse.data.list,
      weeklyReports: weeklyResponse.data,
      deviationAnalyses: deviationResponse.data,
      ownerReports: ownerResponse.data,
    };
  } catch (e) {
    throw error(404, '进度报告不存在');
  }
};
