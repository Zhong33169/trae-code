<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
onMounted(() => {
  const authStore = useAuthStore();
  authStore.loadFromCookie();
});
</script>
