import { createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAuth } from '../auth';
import { api } from '../api';

export default function IndexPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  createEffect(() => {
    const stored = api.getStoredUser();
    if (stored || user()) {
      navigate('/events', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  });

  return <div class="loading">跳转中...</div>;
}
