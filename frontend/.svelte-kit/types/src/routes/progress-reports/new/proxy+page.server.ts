// @ts-nocheck
import type { PageServerLoad } from './$types';
import { usersApi } from '$api';

export const load = async () => {
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
;null as any as PageServerLoad;