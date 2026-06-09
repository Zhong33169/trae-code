<template>
  <div></div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()

onMounted(() => {
  if (authStore.isLoggedIn) {
    navigateTo('/plans')
  } else {
    navigateTo('/login')
  }
})
</script>
