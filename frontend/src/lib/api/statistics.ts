import { api } from './client';
import type { Statistics } from '$types';

export const statisticsApi = {
  getOverview: (authToken?: string | null) => api.get<Statistics>('/statistics/overview', undefined, authToken),
};
