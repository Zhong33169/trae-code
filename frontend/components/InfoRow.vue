<template>
  <div>
    <div class="text-gray-500 mb-1">{{ label }}</div>
    <div class="text-gray-800">{{ value || '-' }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value?: string | number | null
}>()
</script>
