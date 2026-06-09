export default defineNuxtRouteMiddleware((to, from) => {
  const authStore = useAuthStore()
  authStore.init()

  if (to.path === '/login') {
    if (authStore.isLoggedIn) {
      return navigateTo('/plans')
    }
    return
  }

  if (!authStore.isLoggedIn) {
    return navigateTo('/login')
  }
})
