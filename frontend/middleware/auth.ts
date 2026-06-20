// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, _from) => {
  const authStore = useAuthStore()
  if (!authStore.isLoggedIn) {
    return navigateTo('/login')
  }
})
