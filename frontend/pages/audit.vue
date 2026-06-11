<template>
  <div>
    <h2 style="margin-bottom: 20px;">� 审计记录</h2>
    
    <div class="card">
      <div class="filter-bar">
        <div class="filter-item">
          <label class="form-label">操作类型</label>
          <select v-model="filters.action" class="form-select" @change="loadData">
            <option value="">全部类型</option>
            <option value="scan">扫码</option>
            <option value="submit">提交登记</option>
            <option value="audit">核验</option>
            <option value="review">复核归档</option>
            <option value="reject">驳回</option>
          </select>
        </div>
        <div class="filter-item">
          <label class="form-label">操作岗位</label>
          <select v-model="filters.role" class="form-select" @change="loadData">
            <option value="">全部岗位</option>
            <option value="registrar">生产登记员</option>
            <option value="auditor">生产审核主管</option>
            <option value="reviewer">制造工厂复核负责人</option>
          </select>
        </div>
        <div class="filter-item">
          <label class="form-label">失败类型</label>
          <select v-model="filters.failureType" class="form-select" @change="loadData">
            <option value="">全部</option>
            <option value="all">仅失败记录</option>
            <option value="INVALID_QR">无效二维码</option>
            <option value="WRONG_ROLE">越权操作</option>
            <option value="WRONG_STATUS">状态错误</option>
            <option value="CONCURRENT_LOCK">并发冲突</option>
          </select>
        </div>
        <div class="filter-item">
          <button class="btn btn-primary" @click="loadData">查询</button>
        </div>
      </div>
      
      <div class="stat-cards" style="grid-template-columns: repeat(4, 1fr); margin: 16px 0;">
        <div class="stat-card" style="box-shadow: none; border: 1px solid #f0f0f0;">
          <div class="stat-card-title">总操作数</div>
          <div class="stat-card-value" style="font-size: 20px;">{{ stats?.total || 0 }}</div>
        </div>
        <div class="stat-card" style="box-shadow: none; border: 1px solid #f0f0f0;">
          <div class="stat-card-title">成功</div>
          <div class="stat-card-value" style="font-size: 20px; color: #52c41a;">{{ stats?.success || 0 }}</div>
        </div>
        <div class="stat-card" style="box-shadow: none; border: 1px solid #f0f0f0;">
          <div class="stat-card-title">失败</div>
          <div class="stat-card-value" style="font-size: 20px; color: #f5222d;">{{ stats?.failed || 0 }}</div>
        </div>
        <div class="stat-card" style="box-shadow: none; border: 1px solid #f0f0f0;">
          <div class="stat-card-title">异常扫码</div>
          <div class="stat-card-value" style="font-size: 20px; color: #faad14;">{{ stats?.scanFailures || 0 }}</div>
        </div>
      </div>
      
      <div v-if="loading" style="text-align: center; padding: 40px; color: #999;">加载中...</div>
      
      <table v-else>
        <thead>
          <tr>
            <th>时间</th>
            <th>操作</th>
            <th>操作人</th>
            <th>岗位</th>
            <th>工单码</th>
            <th>结果</th>
            <th>失败原因</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in list" :key="log.id" :style="!log.success ? 'background: #fff1f0;' : ''">
            <td style="font-size: 12px; color: #999;">{{ formatDate(log.createdAt) }}</td>
            <td>{{ log.actionName }}</td>
            <td>{{ log.operatorName }}</td>
            <td>{{ log.roleName }}</td>
            <td>
              <NuxtLink v-if="log.workOrderId" :to="'/workorders/' + log.workOrderId" style="color: #1890ff;">
                <code>{{ log.workOrderQrCode || '-' }}</code>
              </NuxtLink>
              <span v-else>-</span>
            </td>
            <td>
              <span v-if="log.success" style="color: #52c41a;">成功</span>
              <span v-else style="color: #f5222d;">失败</span>
            </td>
            <td style="max-width: 200px;">
              <span v-if="log.failureReason" :title="log.failureReason" style="font-size: 12px;">
                <code>{{ log.failureCode || '' }}</code> {{ log.failureReason }}
              </span>
              <span v-else>-</span>
            </td>
            <td style="max-width: 150px;">
              <span v-if="log.comment" :title="log.comment" style="font-size: 12px;">
                {{ log.comment }}
              </span>
              <span v-else>-</span>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div class="pagination" v-if="total > 0">
        <span style="color: #666;">共 {{ total }} 条</span>
        <div style="display: flex; gap: 4px;">
          <button 
            class="btn" 
            style="padding: 4px 10px;" 
            :disabled="page === 1"
            @click="page--; loadData()"
          >
            上一页
          </button>
          <span style="padding: 4px 10px; line-height: 24px;">
            第 {{ page }} / {{ totalPages }} 页
          </span>
          <button 
            class="btn" 
            style="padding: 4px 10px;" 
            :disabled="page >= totalPages"
            @click="page++; loadData()"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
    
    <div class="card" v-if="failureStats.length > 0">
      <h3 class="section-title">📊 失败类型分布</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 16px;">
        <div 
          v-for="item in failureStats" 
          :key="item.code"
          style="flex: 1; min-width: 200px; padding: 16px; background: #fff1f0; border-radius: 8px;"
        >
          <div style="font-size: 12px; color: #999; margin-bottom: 4px;">{{ item.name }}</div>
          <div style="font-size: 24px; font-weight: 600; color: #f5222d;">{{ item.count }}</div>
          <div style="font-size: 12px; color: #666; margin-top: 4px;">
            <code>{{ item.code }}</code>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const auth = useAuth()
const api = useApi()

const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const stats = ref(null)
const failureStats = ref([])

const filters = ref({
  action: '',
  role: '',
  failureType: ''
})

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

onMounted(async () => {
  if (!auth.checkAuth()) {
    navigateTo('/login')
    return
  }
  
  if (auth.userRole.value !== 'reviewer') {
    navigateTo('/')
    return
  }
  
  await loadData()
  await loadFailureStats()
})

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value,
      ...filters.value
    }
    
    const res = await api.get('/audit', params)
    if (res.success) {
      list.value = res.data.list
      total.value = res.data.total
      stats.value = res.data.stats
    }
  } catch (e) {
    console.error('加载审计记录失败', e)
  } finally {
    loading.value = false
  }
}

const loadFailureStats = async () => {
  try {
    const res = await api.get('/audit/failures')
    if (res.success) {
      failureStats.value = res.data.failureTypes || []
    }
  } catch (e) {
    console.error('加载失败统计失败', e)
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN', { 
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  })
}

useHead({ title: '审计记录 - 生产工单系统' })
</script>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
  align-items: flex-end;
}
.filter-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
