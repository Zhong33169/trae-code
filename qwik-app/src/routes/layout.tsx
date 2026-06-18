import { component$, Slot } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import Layout from '~/components/layout';
import type { User } from '~/types';

export const useAuthCheck = routeLoader$<{ isLoggedIn: boolean; user: User | null }>(
  ({ cookie, pathname }) => {
    if (pathname === '/login' || pathname === '/login/') {
      return { isLoggedIn: false, user: null };
    }

    const userCookie = cookie.get('user');
    if (!userCookie) {
      return { isLoggedIn: false, user: null };
    }

    try {
      const user = JSON.parse(decodeURIComponent(userCookie.value)) as User;
      return { isLoggedIn: true, user };
    } catch {
      return { isLoggedIn: false, user: null };
    }
  }
);

export default component$(() => {
  const auth = useAuthCheck();

  if (!auth.value.isLoggedIn) {
    return <Slot />;
  }

  return (
    <Layout user={auth.value.user!}>
      <Slot />
    </Layout>
  );
});

export const head = {
  title: '展商申请管理系统',
  meta: [
    {
      name: 'description',
      content: '展会主办方展商申请审批管理系统',
    },
  ],
};
