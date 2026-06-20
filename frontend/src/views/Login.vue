<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { login, getUsers } from '../api/care'

const router = useRouter()
const userStore = useUserStore()

const selectedUser = ref('')
const users = ref([])
const loading = ref(false)
const error = ref('')

async function loadUsers() {
  loading.value = true
  try {
    const res = await getUsers()
    users.value = res.data
  } catch (e) {
    error.value = '加载用户列表失败'
  }
  loading.value = false
}

async function handleLogin() {
  if (!selectedUser.value) {
    error.value = '请选择用户'
    return
  }
  try {
    const res = await login(selectedUser.value)
    userStore.setUser(res.data)
    router.push('/care-records')
  } catch (e) {
    error.value = '登录失败'
  }
}

loadUsers()
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h2 class="login-title">🏥 宠物医院住院护理管理系统</h2>
      <p class="login-subtitle">选择角色登录</p>

      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div class="form-group">
        <label>选择用户</label>
        <select v-model="selectedUser">
          <option value="">-- 请选择 --</option>
          <optgroup v-for="role in ['doctor','nurse','reviewer','admin']" :key="role" :label="{doctor:'医生',nurse:'护士',reviewer:'复核员',admin:'管理员'}[role]">
            <option v-for="u in users.filter(u=>u.role===role)" :key="u.id" :value="u.username">
              {{ u.name }} ({{ u.username }})
            </option>
          </optgroup>
        </select>
      </div>

      <button class="btn btn-primary btn-lg" style="width:100%" @click="handleLogin" :disabled="!selectedUser">
        登 录
      </button>

      <div class="login-hint">
        <p>演示账号说明：</p>
        <ul>
          <li><strong>医生</strong>：张医生(dr_zhang)、李医生(dr_li) — 可发起护理单</li>
          <li><strong>护士</strong>：王护士(nurse_wang)、刘护士(nurse_liu) — 可办理护理单</li>
          <li><strong>复核员</strong>：陈主任(reviewer_chen)、赵主任(reviewer_zhao) — 可复核归档</li>
          <li><strong>管理员</strong>：管理员(admin) — 全部权限</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%);
}
.login-card {
  background: white;
  border-radius: 12px;
  padding: 40px;
  width: 420px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}
.login-title {
  text-align: center;
  font-size: 22px;
  color: #1a237e;
  margin-bottom: 4px;
}
.login-subtitle {
  text-align: center;
  color: #999;
  margin-bottom: 24px;
  font-size: 14px;
}
.login-hint {
  margin-top: 24px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  font-size: 12px;
  color: #666;
}
.login-hint ul {
  padding-left: 16px;
  margin-top: 4px;
}
.login-hint li {
  margin-bottom: 2px;
}
</style>
