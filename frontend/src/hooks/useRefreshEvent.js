import { useEffect } from 'preact/hooks';

export default function useRefreshEvent(callback) {
  useEffect(() => {
    const handler = () => {
      if (callback) callback();
    };
    try {
      window.addEventListener('aftersales:refresh', handler);
    } catch (e) {}
    return () => {
      try {
        window.removeEventListener('aftersales:refresh', handler);
      } catch (e) {}
    };
  }, [callback]);
}
