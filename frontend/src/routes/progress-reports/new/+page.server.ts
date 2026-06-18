import type { PageServerLoad } from './$types';
import { usersApi } from '$api';

export const load: PageServerLoad = async ({ cookies }) => {
  const token = cookies.get('access_token');
  try {
    const response = await usersApi.getList(token);
    return {
      users: response.data,
    };
  } catch (e) {
    return {
      users: [],
    };
  }
};
