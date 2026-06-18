<template>
  <div class="flex gap-3">
    <div class="flex flex-col items-center pt-0.5">
      <div
        :class="[
          'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0',
          status === 'done' ? 'bg-green-500 text-white' : '',
          status === 'current' ? 'bg-blue-500 text-white ring-4 ring-blue-100' : '',
          status === 'ready' ? 'bg-amber-400 text-white' : '',
          status === 'pending' ? 'bg-gray-200 text-gray-500' : '',
        ]"
      >
        <template v-if="status === 'done'">✓</template>
        <template v-else-if="status === 'current'">●</template>
        <template v-else-if="status === 'ready'">!</template>
        <template v-else>○</template>
      </div>
      <div v-if="!last" class="w-px flex-1 bg-gray-200 mt-1 min-h-[24px]" />
    </div>
    <div class="flex-1 pb-4">
      <div
        :class="[
          'text-sm font-medium',
          status === 'pending' ? 'text-gray-400' : 'text-gray-800'
        ]"
      >
        {{ title }}
      </div>
      <div v-if="subtitle" class="text-xs text-gray-500 mt-0.5">{{ subtitle }}</div>
      <div v-if="time" class="text-xs text-gray-400 mt-0.5">{{ time }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  status: 'done' | 'current' | 'ready' | 'pending'
  time?: string | null
  last?: boolean
}>()
</script>
