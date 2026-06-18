// @ts-nocheck
import type { PageServerLoad } from './$types';
import { statisticsApi } from '$api';

export const load = async ({ cookies }: Parameters<PageServerLoad>[0]) => {
  const token = cookies.get('access_token');
  try {
    const response = await statisticsApi.getOverview(token);
    return {
      statistics: response.data,
    };
  } catch (e) {
    return {
      statistics: null,
    };
  }
};
