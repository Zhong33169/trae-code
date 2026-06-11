<template>
  <div style="padding: 40px;">
    <h1>测试页面</h1>
    <p>测试值: {{ testValue }}</p>
    <p>API Base: {{ apiBase }}</p>
  </div>
</template>

<script setup>
const config = useRuntimeConfig()
const testValue = ref('hello test')
const apiBase = computed(() => config.public.apiBase)

useHead({ title: '测试页' })
</script>
