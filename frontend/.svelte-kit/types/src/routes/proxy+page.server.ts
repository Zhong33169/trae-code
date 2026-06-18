// @ts-nocheck
import type { PageServerLoad } from './$types';
import { statisticsApi } from '$api';

export const load = async () => {
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
;null as any as PageServerLoad;