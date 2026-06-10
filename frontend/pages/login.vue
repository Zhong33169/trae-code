<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
    <div class="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-gray-800 mb-2">社区团购订单管理系统</h1>
        <p class="text-gray-500">请登录以继续</p>
      </div>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label class="label">用户名</label>
          <input
            v-model="form.username"
            type="text"
            class="input"
            placeholder="请输入用户名"
            required
          />
        </div>

        <div class="form-group">
          <label class="label">密码</label>
          <input
            v-model="form.password"
            type="password"
            class="input"
            placeholder="请输入密码"
            required
          />
        </div>

        <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md">
          {{ error }}
        </div>

        <button
          type="submit"
          class="btn btn-primary w-full"
          :disabled="loading"
        >
          <span v-if="loading">登录中...</span>
          <span v-else>登 录</span>
        </button>
      </form>

      <div class="mt-6 pt-6 border-t border-gray-100">
        <p class="text-sm text-gray-500 mb-3">测试账号：</p>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600">团购登记员</span>
            <code class="bg-gray-100 px-2 py-0.5 rounded text-gray-700">registrar / 123456</code>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">团购审核主管</span>
            <code class="bg-gray-100 px-2 py-0.5 rounded text-gray-700">supervisor / 123456</code>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">复核负责人</span>
            <code class="bg-gray-100 px-2 py-0.5 rounded text-gray-700">reviewer / 123456</code>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();

const form = reactive({
  username: '',
  password: '',
});

const loading = ref(false);
const error = ref('');

const handleLogin = async () => {
  loading.value = true;
  error.value = '';

  try {
    await authStore.login(form.username, form.password);
    navigateTo('/orders');
  } catch (e: any) {
    error.value = e.data?.message || '登录失败，请检查用户名和密码';
  } finally {
    loading.value = false;
  }
};
</script>
