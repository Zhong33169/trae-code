import type { Actions } from './$types';
import { authApi } from '$api';
import { redirect, fail } from '@sveltejs/kit';

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const formData = await request.formData();
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!username || !password) {
      return fail(400, { error: '请输入用户名和密码' });
    }

    try {
      const response = await authApi.login({ username, password });
      const { accessToken } = response.data;

      cookies.set('access_token', accessToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
      });

      throw redirect(302, '/');
    } catch (e) {
      const error = e as Error;
      return fail(401, { error: error.message || '登录失败，请检查用户名和密码' });
    }
  },
};
