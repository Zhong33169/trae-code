import { api } from './client';
import type { Statistics } from '$types';

export const statisticsApi = {
  getOverview: () => api.get<Statistics>('/statistics/overview'),
};
