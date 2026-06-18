// @ts-nocheck
import type { PageServerLoad } from './$types';
import { progressReportsApi, usersApi } from '$api';
import { error, redirect } from '@sveltejs/kit';

export const load = async ({ params }: Parameters<PageServerLoad>[0]) => {
  try {
    const [reportResponse, usersResponse] = await Promise.all([
      progressReportsApi.getDetail(params.id),
      usersApi.getList(),
    ]);

    return {
      report: reportResponse.data,
      users: usersResponse.data,
    };
  } catch (e) {
    throw error(404, '进度报告不存在');
  }
};
