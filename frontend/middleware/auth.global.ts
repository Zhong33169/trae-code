export default defineNuxtRouteMiddleware((to) => {
  const userStore = useUserStore()

  if (process.client) {
    userStore.loadFromStorage()
  }

  if (to.path === '/' && userStore.isLoggedIn) {
    return navigateTo('/workbench')
  }

  if (to.path !== '/' && !userStore.isLoggedIn) {
    return navigateTo('/')
  }
})
