<template>
  <div>
    <h2 style="margin-bottom: 20px;">生产工单列表</h2>
    
    <div class="card">
      <div class="filter-bar">
        <div class="filter-item">
          <label class="form-label">状态</label>
          <select v-model="filters.status" class="form-select" @change="loadData">
            <option value="">全部状态</option>
            <option v-for="s in statusOptions" :key="s.value" :value="s.value">
              {{ s.label }}
            </option>
          </select>
        </div>
        <div class="filter-item">
          <label class="form-label">优先级</label>
          <select v-model="filters.priority" class="form-select" @change="loadData">
            <option value="">全部优先级</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </div>
        <div class="filter-item">
          <label class="form-label">关键词</label>
          <input 
            type="text" 
            v-model="filters.keyword" 
            class="form-input" 
            placeholder="工单码/产品/批次"
            @keyup.enter="loadData"
          />
        </div>
        <div class="filter-item">
          <button class="btn btn-primary" @click="loadData">查询</button>
        </div>
      </div>
      
      <div v-if="auth.userRole.value !== 'registrar'" style="margin: 16px 0; padding: 12px; background: #f0f5ff; border-radius: 6px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" v-model="viewMyQueue" @change="loadData" />
          <span style="font-weight: 500;">只看我的待办</span>
        </label>
      </div>
      
      <div v-if="batchMode" style="margin-bottom: 16px; padding: 12px; background: #fffbe6; border: 1px solid #ffe58f; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
        <span>已选择 <strong>{{ selectedIds.length }}</strong> 项</span>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary" @click="openBatchModal('pass')" :disabled="selectedIds.length === 0">
            批量通过
          </button>
          <button class="btn btn-danger" @click="openBatchModal('reject')" :disabled="selectedIds.length === 0">
            批量驳回
          </button>
          <button class="btn" @click="cancelBatch">取消</button>
        </div>
      </div>
      
      <div v-if="loading" style="text-align: center; padding: 40px; color: #999;">加载中...</div>
      
      <table v-else>
        <thead>
          <tr>
            <th v-if="showBatchCheckbox" style="width: 40px;">
              <input type="checkbox" v-model="selectAll" @change="toggleSelectAll" />
            </th>
            <th>工单码</th>
            <th>产品名称</th>
            <th>批次</th>
            <th>数量</th>
            <th>优先级</th>
            <th>状态</th>
            <th>当前处理人</th>
            <th>时限</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in list" :key="item.id">
            <td v-if="showBatchCheckbox">
              <input type="checkbox" :value="item.id" v-model="selectedIds" />
            </td>
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
            <td>{{ item.currentHandlerName || '-' }}</td>
            <td :style="{ color: isOverdue(item.deadline) ? '#f5222d' : '#666' }">
              {{ formatDate(item.deadline) }}
            </td>
            <td>
              <NuxtLink :to="'/workorders/' + item.id" class="btn btn-primary" style="padding: 4px 12px; font-size: 12px;">
                详情
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-if="!loading && list.length === 0" style="text-align: center; padding: 40px; color: #999;">
        暂无数据
      </div>
      
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
    
    <div v-if="showBatchModal" class="modal-overlay" @click.self="closeBatchModal">
      <div class="modal-content">
        <h3>{{ batchAction === 'pass' ? '批量通过' : '批量驳回' }}</h3>
        
        <div v-if="isAuditor" class="form-item">
          <label class="form-label">核验项 (至少2项)</label>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label v-for="(item, idx) in batchCheckItems" :key="idx" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" v-model="item.passed" />
              <span>{{ item.name }}</span>
            </label>
          </div>
        </div>
        
        <div class="form-item">
          <label class="form-label">{{ isAuditor ? '核验' : '复核' }}意见 (至少5个字符)</label>
          <textarea 
            v-model="batchOpinion" 
            class="form-textarea" 
            rows="4"
            :placeholder="'请输入' + (isAuditor ? '核验' : '复核') + '意见...'"
          ></textarea>
        </div>
        
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button class="btn" @click="closeBatchModal">取消</button>
          <button 
            :class="['btn', batchAction === 'pass' ? 'btn-primary' : 'btn-danger']" 
            @click="handleBatchSubmit"
            :disabled="submitting"
          >
            {{ submitting ? '处理中...' : '确认' + (batchAction === 'pass' ? '通过' : '驳回') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const auth = useAuth()
const api = useApi()
const route = useRoute()

const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const submitting = ref(false)
const viewMyQueue = ref(false)
const selectAll = ref(false)
const selectedIds = ref([])
const batchMode = ref(false)
const showBatchModal = ref(false)
const batchAction = ref('pass')
const batchOpinion = ref('')

const batchCheckItems = ref([
  { name: '材料完整性检查', passed: false },
  { name: '规格参数检查', passed: false },
  { name: '工艺标准检查', passed: false },
  { name: '质检报告检查', passed: false }
])

const isAuditor = computed(() => auth.userRole.value === 'auditor')

const filters = ref({
  status: '',
  priority: '',
  keyword: ''
})

const statusOptions = [
  { value: 'draft', label: '待登记' },
  { value: 'pending_audit', label: '待核验' },
  { value: 'pending_review', label: '待复核' },
  { value: 'completed', label: '已归档' },
  { value: 'rejected', label: '已驳回' }
]

const showBatchCheckbox = computed(() => {
  return (auth.userRole.value === 'auditor' || auth.userRole.value === 'reviewer') && viewMyQueue.value
})

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

onMounted(async () => {
  if (!auth.checkAuth()) {
    navigateTo('/login')
    return
  }
  
  if (route.query.myQueue === 'true') {
    viewMyQueue.value = true
  }
  
  batchMode.value = showBatchCheckbox.value
  await loadData()
})

watch(viewMyQueue, (val) => {
  batchMode.value = val && showBatchCheckbox.value
  selectAll.value = false
  selectedIds.value = []
})

const loadData = async () => {
  loading.value = true
  selectAll.value = false
  selectedIds.value = []
  
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value,
      ...filters.value
    }
    if (viewMyQueue.value) {
      params.myQueue = 'true'
    }
    
    const res = await api.get('/workorders', params)
    if (res.success) {
      list.value = res.data.list
      total.value = res.data.total
    }
  } catch (e) {
    console.error('加载列表失败', e)
  } finally {
    loading.value = false
  }
}

const toggleSelectAll = () => {
  if (selectAll.value) {
    selectedIds.value = list.value.map(item => item.id)
  } else {
    selectedIds.value = []
  }
}

const cancelBatch = () => {
  viewMyQueue.value = false
  batchMode.value = false
  selectAll.value = false
  selectedIds.value = []
  loadData()
}

const openBatchModal = (action) => {
  if (selectedIds.value.length === 0) return
  batchAction.value = action
  batchOpinion.value = ''
  batchCheckItems.value.forEach(item => item.passed = false)
  showBatchModal.value = true
}

const closeBatchModal = () => {
  showBatchModal.value = false
  batchOpinion.value = ''
  batchCheckItems.value.forEach(item => item.passed = false)
}

const handleBatchSubmit = async () => {
  if (isAuditor.value) {
    const passedCount = batchCheckItems.value.filter(i => i.passed).length
    if (passedCount < 2) {
      alert('请至少勾选2项核验')
      return
    }
  }
  
  if (!batchOpinion.value || batchOpinion.value.length < 5) {
    alert('处理意见至少5个字符')
    return
  }
  
  submitting.value = true
  try {
    const endpoint = isAuditor.value
      ? '/workorders/batch/audit'
      : '/workorders/batch/review'
    
    const payload = {
      ids: selectedIds.value,
      action: batchAction.value,
      comment: batchOpinion.value
    }
    
    if (isAuditor.value) {
      payload.checkItems = batchCheckItems.value
    }
    
    const res = await api.post(endpoint, payload)
    
    if (res.success) {
      alert(`批量处理完成：成功 ${res.data.success || res.data.successCount} 条，失败 ${res.data.failed || res.data.failCount} 条`)
      closeBatchModal()
      loadData()
    }
  } catch (e) {
    alert('批量处理失败：' + e.message)
  } finally {
    submitting.value = false
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

useHead({ title: '工单列表 - 生产工单系统' })
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
