import type { PageServerLoad } from './$types';
import { usersApi } from '$api';

export const load: PageServerLoad = async () => {
  try {
    const response = await usersApi.getList();
    return {
      users: response.data,
    };
  } catch (e) {
    return {
      users: [],
    };
  }
};
