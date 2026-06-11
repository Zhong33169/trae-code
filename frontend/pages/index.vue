<template>
  <div>
    <h2 style="margin-bottom: 20px;">工作台 - {{ auth.user.value?.roleName }}</h2>
    
    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-card-title">我的待办</div>
        <div class="stat-card-value" style="color: #1890ff;">{{ myQueueCount }}</div>
        <div class="stat-card-sub">需要处理的工单</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">高优先级</div>
        <div class="stat-card-value" style="color: #ff4d4f;">{{ stats?.highPriority || 0 }}</div>
        <div class="stat-card-sub">紧急处理</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">今日处理</div>
        <div class="stat-card-value" style="color: #52c41a;">{{ stats?.todayActions || 0 }}</div>
        <div class="stat-card-sub">操作记录</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">异常扫码</div>
        <div class="stat-card-value" style="color: #faad14;">{{ stats?.failureCount || 0 }}</div>
        <div class="stat-card-sub">失败次数</div>
      </div>
    </div>

    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 class="section-title" style="margin-bottom: 0; border: none;">📋 我的待办队列</h3>
        <NuxtLink to="/scan" class="btn btn-primary">📱 扫码处理</NuxtLink>
      </div>
      
      <div v-if="loading" style="text-align: center; padding: 40px; color: #999;">加载中...</div>
      
      <div v-else-if="myQueue.length === 0" style="text-align: center; padding: 40px; color: #999;">
        暂无待处理工单
      </div>
      
      <table v-else>
        <thead>
          <tr>
            <th>工单码</th>
            <th>产品名称</th>
            <th>批次</th>
            <th>数量</th>
            <th>优先级</th>
            <th>状态</th>
            <th>时限</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in myQueue" :key="item.id">
            <td><code>{{ item.qrCode }}</code></td>
            <td>{{ item.productName }}</td>
            <td>{{ item.productBatch }}</td>
            <td>{{ item.quantity }}</td>
            <td :class="'priority-' + item.priority">{{ item.priorityName }}</td>
            <td>
              <span :class="'status-tag status-' + item.status">
                {{ item.statusName }}
              </span>
            </td>
            <td :style="{ color: isOverdue(item.deadline) ? '#f5222d' : '#666' }">
              {{ formatDate(item.deadline) }}
            </td>
            <td>
              <NuxtLink :to="'/workorders/' + item.id" class="btn btn-primary" style="padding: 4px 12px; font-size: 12px;">
                处理
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-if="myQueue.length > 0" style="margin-top: 16px; text-align: right;">
        <NuxtLink to="/workorders" style="color: #1890ff; text-decoration: none;">
          查看全部 →
        </NuxtLink>
      </div>
    </div>

    <div class="card" v-if="auth.userRole.value === 'reviewer'">
      <h3 class="section-title">📊 全局统计</h3>
      <div class="stat-cards" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
        <div class="stat-card" style="box-shadow: none; border: 1px solid #f0f0f0;">
          <div class="stat-card-title">总工单</div>
          <div class="stat-card-value" style="font-size: 24px;">{{ stats?.statusCounts?.total || 0 }}</div>
        </div>
        <div class="stat-card" style="box-shadow: none; border: 1px solid #f0f0f0;">
          <div class="stat-card-title">待登记</div>
          <div class="stat-card-value" style="font-size: 24px; color: #666;">{{ stats?.statusCounts?.draft || 0 }}</div>
        </div>
        <div class="stat-card" style="box-shadow: none; border: 1px solid #f0f0f0;">
          <div class="stat-card-title">待核验</div>
          <div class="stat-card-value" style="font-size: 24px; color: #fa8c16;">{{ stats?.statusCounts?.pending_audit || 0 }}</div>
        </div>
        <div class="stat-card" style="box-shadow: none; border: 1px solid #f0f0f0;">
          <div class="stat-card-title">待复核</div>
          <div class="stat-card-value" style="font-size: 24px; color: #722ed1;">{{ stats?.statusCounts?.pending_review || 0 }}</div>
        </div>
        <div class="stat-card" style="box-shadow: none; border: 1px solid #f0f0f0;">
          <div class="stat-card-title">已归档</div>
          <div class="stat-card-value" style="font-size: 24px; color: #52c41a;">{{ stats?.statusCounts?.completed || 0 }}</div>
        </div>
        <div class="stat-card" style="box-shadow: none; border: 1px solid #f0f0f0;">
          <div class="stat-card-title">已驳回</div>
          <div class="stat-card-value" style="font-size: 24px; color: #f5222d;">{{ stats?.statusCounts?.rejected || 0 }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const auth = useAuth()
const api = useApi()

const stats = ref(null)
const myQueue = ref([])
const myQueueCount = ref(0)
const loading = ref(false)

onMounted(async () => {
  if (!auth.checkAuth()) {
    navigateTo('/login')
    return
  }
  loading.value = true
  await Promise.all([loadStats(), loadMyQueue()])
  loading.value = false
})

const loadStats = async () => {
  try {
    const res = await api.get('/stats/summary')
    if (res.success) {
      stats.value = res.data
    }
  } catch (e) {
    console.error('加载统计失败', e)
  }
}

const loadMyQueue = async () => {
  try {
    const res = await api.get('/workorders', { 
      myQueue: 'true', 
      pageSize: 10 
    })
    if (res.success) {
      myQueue.value = res.data.list
      myQueueCount.value = res.data.total
    }
  } catch (e) {
    console.error('加载待办失败', e)
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const isOverdue = (deadline) => {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

useHead({ title: '工作台 - 生产工单系统' })
</script>
