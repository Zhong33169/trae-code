<template>
  <div class="layout">
    <div class="header">
      <h1>🏢 园区招商中心 · 移动补录校验系统</h1>
      <div class="user-info">
        <div class="role-selector">
          <span>当前角色：</span>
          <select v-model="selectedUserId" @change="switchUser">
            <option v-for="u in userStore.users" :key="u.id" :value="u.id">
              {{ u.name }} - {{ u.roleName }}
            </option>
          </select>
        </div>
      </div>
    </div>
    <div class="nav">
      <router-link to="/queue">招商线索单队列</router-link>
      <router-link to="/enterprises">企业线索库</router-link>
    </div>
    <div class="main">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed, watch } from 'vue';
import { useUserStore } from './stores/user.js';

const userStore = useUserStore();

const selectedUserId = computed({
  get: () => userStore.currentUser?.id,
  set: (v) => {}
});

onMounted(async () => {
  await userStore.fetchUsers();
});

function switchUser(e) {
  const user = userStore.users.find(u => u.id == e.target.value);
  if (user) {
    userStore.setUser(user);
  }
}
</script>
