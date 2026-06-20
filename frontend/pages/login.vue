<template>
  <div class="login-wrap">
    <div class="login-card">
      <h1>新闻采编中心</h1>
      <div class="sub">新闻线索管理系统登录</div>
      <div class="form-row">
        <label>账号</label>
        <input v-model="form.username" class="form-input" placeholder="请输入账号" />
      </div>
      <div class="form-row">
        <label>密码</label>
        <input v-model="form.password" type="password" class="form-input" placeholder="请输入密码（默认 123456）" @keyup.enter="onSubmit" />
      </div>
      <div class="accounts">
        <div><span>新闻线索登记员（王登记）</span><b>registrar1</b></div>
        <div><span>新闻线索登记员（李录入）</span><b>registrar2</b></div>
        <div><span>新闻线索审核主管（张主管）</span><b>auditor1</b></div>
        <div><span>新闻线索审核主管（赵审核）</span><b>auditor2</b></div>
        <div><span>复核负责人（陈复核）</span><b>reviewer1</b></div>
      </div>
      <button class="btn btn-primary" style="width:100%" :disabled="loading" @click="onSubmit">
        {{ loading ? '登录中...' : '登 录' }}
      </button>
      <div v-if="error" style="color:var(--danger);text-align:center;margin-top:12px;font-size:13px;">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const form = reactive({ username: 'registrar1', password: '123456' })
const loading = ref(false)
const error = ref('')

const onSubmit = async () => {
  if (!form.username || !form.password) {
    error.value = '请输入账号和密码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await authStore.login(form.username, form.password)
    navigateTo('/')
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
