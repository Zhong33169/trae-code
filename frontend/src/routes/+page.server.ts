import type { PageServerLoad } from './$types';
import { statisticsApi } from '$api';

export const load: PageServerLoad = async () => {
  try {
    const response = await statisticsApi.getOverview();
    return {
      statistics: response.data,
    };
  } catch (e) {
    return {
      statistics: null,
    };
  }
};
