<template>
  <el-container style="height:100vh;">
    <el-aside width="220px" style="background:#001529;">
      <div style="padding:20px 16px; color:#fff; font-size:16px; font-weight:bold; border-bottom:1px solid #1f2d3d;">
        <el-icon style="margin-right:8px; vertical-align:-2px;"><ScaleToOriginal /></el-icon>
        诉讼材料管理
      </div>
      <el-menu
        :default-active="$route.path"
        router
        background-color="#001529"
        text-color="#cfd3dc"
        active-text-color="#ffffff"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>工作台</span>
        </el-menu-item>
        <el-menu-item index="/materials">
          <el-icon><Document /></el-icon>
          <span>诉讼材料单</span>
        </el-menu-item>
        <el-menu-item index="/audit">
          <el-icon><Warning /></el-icon>
          <span>审计日志</span>
        </el-menu-item>
        <el-menu-item index="/batches">
          <el-icon><Tickets /></el-icon>
          <span>批量任务</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header style="background:#fff; display:flex; align-items:center; justify-content:space-between; padding:0 24px; border-bottom:1px solid #ebeef5;">
        <div style="font-size:18px; font-weight:600;">
          法务服务中心 — {{ $route.meta.title || '' }}
        </div>
        <div style="display:flex; align-items:center; gap:16px;">
          <el-tag :type="roleTagType" effect="dark" size="large" style="cursor:pointer;" @click="showRoleSwitch = true">
            <el-icon style="margin-right:4px; vertical-align:-2px;"><UserFilled /></el-icon>
            {{ userStore.user?.real_name }} · {{ userStore.roleName }}
          </el-tag>
          <el-button type="primary" plain @click="handleNewMaterial" v-if="userStore.can('register')">
            <el-icon><Plus /></el-icon>新建登记
          </el-button>
          <el-button type="danger" plain size="small" @click="onLogout">
            <el-icon><SwitchButton /></el-icon>退出
          </el-button>
        </div>
      </el-header>

      <el-main style="padding:0;">
        <router-view />
      </el-main>
    </el-container>

    <el-dialog v-model="showRoleSwitch" title="切换角色用户" width="520px">
      <el-radio-group v-model="selectedUserId" style="width:100%;">
        <el-radio v-for="u in sortedUsers" :key="u.id" :value="u.id" style="display:block; padding:10px 0; border-bottom:1px solid #f0f0f0;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div>
              <b>{{ u.real_name }}</b>
              <el-tag size="small" :type="roleTagColor(u.role)" style="margin-left:8px;">{{ roleDisplay(u.role) }}</el-tag>
            </div>
            <div style="color:#999; font-size:12px;">账号：{{ u.username }} / 123456</div>
          </div>
        </el-radio>
      </el-radio-group>
      <template #footer>
        <el-button @click="showRoleSwitch = false">取消</el-button>
        <el-button type="primary" @click="confirmSwitch">切换</el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ElMessage } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()
const showRoleSwitch = ref(false)
const selectedUserId = ref(userStore.user?.id || '')

const sortedUsers = computed(() => {
  const order = { registrar: 0, reviewer: 1, verifier: 2 }
  return [...userStore.allUsers].sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9))
})

const roleTagType = computed(() => {
  switch (userStore.role) {
    case 'registrar': return 'success'
    case 'reviewer': return 'warning'
    case 'verifier': return 'danger'
    default: return 'info'
  }
})

function roleTagColor(r) {
  switch (r) {
    case 'registrar': return 'success'
    case 'reviewer': return 'warning'
    case 'verifier': return 'danger'
    default: return 'info'
  }
}

function roleDisplay(r) {
  return { registrar: '诉讼材料登记员', reviewer: '诉讼材料审核主管', verifier: '法务服务中心复核负责人' }[r] || r
}

function onLogout() {
  userStore.logout()
  router.push('/login')
  ElMessage.info('已退出登录')
}

function handleNewMaterial() {
  router.push('/materials/new')
}

function confirmSwitch() {
  const target = userStore.allUsers.find((u) => u.id === selectedUserId.value)
  if (target) {
    userStore.switchUser(target)
    showRoleSwitch.value = false
    ElMessage.success(`已切换到：${target.real_name}（${roleDisplay(target.role)}）`)
    router.push('/dashboard')
  }
}

onMounted(async () => {
  await userStore.fetchUsers()
  await userStore.fetchRoles()
  selectedUserId.value = userStore.user?.id || ''
})
</script>
