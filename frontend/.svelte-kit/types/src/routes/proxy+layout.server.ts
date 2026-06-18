// @ts-nocheck
import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { authApi } from '$api';

export const load = async ({ url, cookies }: Parameters<LayoutServerLoad>[0]) => {
  const accessToken = cookies.get('access_token');
  const isLoginPage = url.pathname === '/login';

  if (!accessToken && !isLoginPage) {
    throw redirect(302, '/login');
  }

  if (accessToken && isLoginPage) {
    throw redirect(302, '/');
  }

  let user = null;
  if (accessToken) {
    try {
      const response = await authApi.getCurrentUser();
      user = response.data;
    } catch (e) {
      cookies.delete('access_token', { path: '/' });
      if (!isLoginPage) {
        throw redirect(302, '/login');
      }
    }
  }

  return { user };
};
