<template>
  <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #eff6ff 0%, #ede9fe 100%);">
    <div class="card" style="width: 420px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg, #2563eb, #7c3aed); margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 24px; font-weight: 700;">健</div>
        <h1 style="font-size: 20px; font-weight: 700; color: #111827;">社区健身房 · 会员入会单系统</h1>
        <p style="font-size: 13px; color: #6b7280; margin-top: 4px;">附件缺失补正 · 审核流转 · 审计归档</p>
      </div>

      <div class="divider"></div>

      <p style="font-size: 13px; color: #4b5563; margin-bottom: 12px;">请选择登录角色：</p>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button
          class="btn btn-lg"
          :class="{ 'btn-primary': selectedRole === 'registrar' }"
          style="justify-content: flex-start;"
          @click="login('registrar')"
        >
          <div style="text-align: left;">
            <div style="font-weight: 600;">李登记</div>
            <div style="font-size: 12px; opacity: 0.8; margin-top: 2px;">会员入会登记员 · 发起/补正入会单</div>
          </div>
        </button>
        <button
          class="btn btn-lg"
          :class="{ 'btn-primary': selectedRole === 'supervisor' }"
          style="justify-content: flex-start;"
          @click="login('supervisor')"
        >
          <div style="text-align: left;">
            <div style="font-weight: 600;">王审核</div>
            <div style="font-size: 12px; opacity: 0.8; margin-top: 2px;">会员入会审核主管 · 办理审核、退回补正、驳回</div>
          </div>
        </button>
        <button
          class="btn btn-lg"
          :class="{ 'btn-primary': selectedRole === 'reviewer' }"
          style="justify-content: flex-start;"
          @click="login('reviewer')"
        >
          <div style="text-align: left;">
            <div style="font-weight: 600;">张复核</div>
            <div style="font-size: 12px; opacity: 0.8; margin-top: 2px;">社区健身房复核负责人 · 复核、启用卡权益、归档</div>
          </div>
        </button>
      </div>

      <div v-if="error" class="alert alert-danger mt-4">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const auth = useAuth()
const router = useRouter()
const selectedRole = ref('')
const error = ref('')

async function login(username: string) {
  selectedRole.value = username
  error.value = ''
  try {
    await auth.login(username)
    router.push('/')
  } catch (e: any) {
    error.value = e?.data?.detail || '登录失败'
  }
}

onMounted(() => {
  if (auth.state.user) {
    router.push('/')
  }
})
</script>
