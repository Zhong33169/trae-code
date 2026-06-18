import type { PageServerLoad } from './$types';
import { progressReportsApi, operationLogsApi, weeklyReportsApi, deviationAnalysisApi, ownerReportsApi } from '$api';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
  try {
    const [
      reportResponse,
      logsResponse,
      weeklyResponse,
      deviationResponse,
      ownerResponse,
    ] = await Promise.all([
      progressReportsApi.getDetail(params.id),
      operationLogsApi.getList({ progressReportId: params.id, pageSize: 100 }),
      weeklyReportsApi.getList({ progressReportId: params.id }),
      deviationAnalysisApi.getList({ progressReportId: params.id }),
      ownerReportsApi.getList({ progressReportId: params.id }),
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
