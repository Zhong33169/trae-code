// @ts-nocheck
import type { PageServerLoad } from './$types';
import { progressReportsApi, usersApi } from '$api';
import { error } from '@sveltejs/kit';

export const load = async ({ params, cookies }: Parameters<PageServerLoad>[0]) => {
  const token = cookies.get('access_token');
  try {
    const [reportResponse, usersResponse] = await Promise.all([
      progressReportsApi.getDetail(params.id, token),
      usersApi.getList(token),
    ]);

    return {
      report: reportResponse.data,
      users: usersResponse.data,
    };
  } catch (e) {
    throw error(404, '进度报告不存在');
  }
};
