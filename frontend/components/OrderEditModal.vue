<template>
  <OrderCreateModal
    :order="order"
    mode="edit"
    @close="$emit('close')"
    @success="$emit('success')"
  />
</template>

<script setup lang="ts">
import OrderCreateModal from './OrderCreateModal.vue';
import type { Order } from '~/types';

defineProps<{
  order: Order | null;
}>();

defineEmits<{
  close: [];
  success: [];
}>();
</script>
