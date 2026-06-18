<template>
  <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%);">
    <el-card style="width: 420px; padding: 12px; border-radius: 12px;">
      <template #header>
        <div style="text-align:center;">
          <h2 style="margin:0; color:#1e40af;">法务服务中心</h2>
          <p style="margin:8px 0 0; color:#64748b; font-size:14px;">诉讼材料登记与复核管理系统</p>
        </div>
      </template>

      <el-form :model="form" label-width="80px" @submit.prevent="onLogin">
        <el-form-item label="账号">
          <el-select v-model="form.username" placeholder="选择登录账号">
            <el-option label="张登记 (登记员) registrar1 / 123456" value="registrar1" />
            <el-option label="李补正 (登记员) registrar2 / 123456" value="registrar2" />
            <el-option label="王审核 (审核主管) reviewer1 / 123456" value="reviewer1" />
            <el-option label="赵主管 (审核主管) reviewer2 / 123456" value="reviewer2" />
            <el-option label="陈复核 (复核负责人) verifier1 / 123456" value="verifier1" />
            <el-option label="刘归档 (复核负责人) verifier2 / 123456" value="verifier2" />
          </el-select>
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="123456" />
        </el-form-item>
        <el-button type="primary" style="width:100%" :loading="loading" @click="onLogin">登录</el-button>
      </el-form>

      <el-alert style="margin-top:16px" type="info" :closable="false" show-icon>
        <div style="font-size:12px; line-height:1.7;">
          <div><b>样例说明：</b></div>
          <div>• CASE-2026-0001：正常单（已登记附件齐全）</div>
          <div>• CASE-2026-0002：超时单（截止日已过未处理）</div>
          <div>• CASE-2026-0003：缺材料单（有附件被驳回）</div>
          <div>• CASE-2026-0004：退回单（已被退回补正）</div>
        </div>
      </el-alert>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ElMessage } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()

const form = reactive({
  username: 'registrar1',
  password: '123456',
})

const loading = ref(false)

async function onLogin() {
  loading.value = true
  try {
    const ok = await userStore.login(form.username, form.password)
    if (ok) {
      ElMessage.success(`欢迎，${userStore.user.real_name}（${userStore.roleName}）`)
      router.push('/dashboard')
    } else {
      ElMessage.error('登录失败')
    }
  } finally {
    loading.value = false
  }
}
</script>
