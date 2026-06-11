import { createSignal } from 'solid-js';

const [refreshKey, setRefreshKey] = createSignal(0);

export const useStatsRefresh = () => {
  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return {
    statsRefreshKey: refreshKey,
    triggerStatsRefresh: triggerRefresh,
  };
};
