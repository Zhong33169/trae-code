export default defineNuxtRouteMiddleware((to, from) => {
  const authStore = useAuthStore();
  authStore.loadFromCookie();

  const publicPaths = ['/login'];

  if (!authStore.isLoggedIn && !publicPaths.includes(to.path)) {
    return navigateTo('/login');
  }

  if (authStore.isLoggedIn && to.path === '/login') {
    return navigateTo('/orders');
  }
});
