<template>
  <div></div>
</template>

<script setup lang="ts">
onMounted(() => {
  const authStore = useAuthStore();
  authStore.loadFromCookie();

  if (authStore.isLoggedIn) {
    navigateTo('/orders');
  } else {
    navigateTo('/login');
  }
});
</script>
