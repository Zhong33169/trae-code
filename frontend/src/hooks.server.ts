import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const accessToken = event.cookies.get('access_token');
  event.locals.accessToken = accessToken || null;
  return resolve(event);
};
