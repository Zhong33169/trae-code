import type { PageServerLoad } from './$types';
import { statisticsApi } from '$api';

export const load: PageServerLoad = async ({ cookies }) => {
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
