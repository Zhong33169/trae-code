import { component$ } from '@builder.io/qwik';
import { useNavigate } from '@builder.io/qwik-city';

export default component$(() => {
  const nav = useNavigate();

  if (typeof document !== 'undefined') {
    const user = localStorage.getItem('user');
    if (user) {
      nav('/applications');
    } else {
      nav('/login');
    }
  }

  return <div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>;
});
