<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0;">生产工单详情</h2>
      <NuxtLink to="/workorders" class="btn">← 返回列表</NuxtLink>
    </div>
    
    <div v-if="loading" class="card" style="text-align: center; padding: 40px; color: #999;">加载中...</div>
    
    <div v-else-if="error" class="card">
      <div class="alert alert-error">{{ error }}</div>
    </div>
    
    <div v-else>
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h3 style="margin-bottom: 8px;">
              <code style="font-size: 18px;">{{ order.qrCode }}</code>
              <span :class="'status-tag status-' + order.status" style="margin-left: 12px;">
                {{ order.statusName }}
              </span>
              <span :class="'priority-badge priority-' + order.priority" style="margin-left: 8px;">
                {{ order.priorityName }}
              </span>
            </h3>
            <p style="color: #666;">产品: {{ order.productName }} · 批次: {{ order.productBatch }} · 数量: {{ order.quantity }}</p>
          </div>
          <div style="text-align: right;">
            <p style="color: #666; font-size: 13px;">创建时间: {{ formatDate(order.createdAt) }}</p>
            <p style="color: #666; font-size: 13px;">当前处理人: {{ order.currentHandlerName || '-' }}</p>
            <p :style="{ color: isOverdue(order.deadline) ? '#f5222d' : '#666', fontSize: '13px' }">
              时限: {{ formatDate(order.deadline) }}
            </p>
          </div>
        </div>
      </div>
      
      <div class="card" v-if="order.registration">
        <h3 class="section-title">📝 登记信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">登记人</span>
            <span class="info-value">{{ order.registrarName || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">登记时间</span>
            <span class="info-value">{{ formatDate(order.registration?.submittedAt) }}</span>
          </div>
          <div class="info-item" style="grid-column: span 2;">
            <span class="info-label">登记说明</span>
            <span class="info-value">{{ order.registration?.comment || '-' }}</span>
          </div>
        </div>
        <div v-if="order.registration?.materials?.length > 0" style="margin-top: 12px;">
          <p style="font-weight: 500; margin-bottom: 8px;">上传材料 ({{ order.registration.materials.length }} 份):</p>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <span v-for="(m, idx) in order.registration.materials" :key="idx" style="padding: 4px 10px; background: #f0f5ff; border-radius: 4px; font-size: 12px;">
              📄 {{ m }}
            </span>
          </div>
        </div>
      </div>
      
      <div class="card" v-if="order.audit">
        <h3 class="section-title">🔍 核验信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">核验人</span>
            <span class="info-value">{{ order.auditorName || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">核验时间</span>
            <span class="info-value">{{ formatDate(order.audit?.completedAt) }}</span>
          </div>
          <div class="info-item" style="grid-column: span 2;">
            <span class="info-label">核验结果</span>
            <span class="info-value">
              <span v-if="order.audit.result === 'pass'" style="color: #52c41a;">✅ 通过</span>
              <span v-else style="color: #f5222d;">❌ 驳回</span>
            </span>
          </div>
          <div class="info-item" style="grid-column: span 2;">
            <span class="info-label">核验意见</span>
            <span class="info-value">{{ order.audit?.comment || '-' }}</span>
          </div>
        </div>
        <div v-if="order.audit?.checkItems?.length > 0" style="margin-top: 12px;">
          <p style="font-weight: 500; margin-bottom: 8px;">核验项 ({{ order.audit.checkItems.length }} 项):</p>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div v-for="(item, idx) in order.audit.checkItems" :key="idx" style="display: flex; align-items: center; gap: 8px;">
              <span v-if="item.passed" style="color: #52c41a;">✓</span>
              <span v-else style="color: #f5222d;">✗</span>
              <span>{{ item.name }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card" v-if="order.review">
        <h3 class="section-title">📦 复核归档</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">复核人</span>
            <span class="info-value">{{ order.reviewerName || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">归档编号</span>
            <span class="info-value"><code>{{ order.review.archiveNo }}</code></span>
          </div>
          <div class="info-item">
            <span class="info-label">归档时间</span>
            <span class="info-value">{{ formatDate(order.review?.completedAt) }}</span>
          </div>
          <div class="info-item" style="grid-column: span 2;">
            <span class="info-label">复核意见</span>
            <span class="info-value">{{ order.review?.comment || '-' }}</span>
          </div>
        </div>
      </div>
      
      <div class="card" v-if="canSubmit">
        <h3 class="section-title">{{ isRejected ? '📝 补正登记' : '📝 登记提交' }}</h3>
        <div class="form-item">
          <label class="form-label">处理时限</label>
          <input type="datetime-local" v-model="submitForm.deadline" class="form-input" />
        </div>
        <div class="form-item">
          <label class="form-label">上传材料 (至少3份)</label>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
            <span v-for="(m, idx) in submitForm.materials" :key="idx" style="padding: 4px 10px; background: #f0f5ff; border-radius: 4px; font-size: 12px; display: flex; align-items: center; gap: 4px;">
              📄 {{ m }}
              <span @click="removeMaterial(idx)" style="cursor: pointer; color: #f5222d;">×</span>
            </span>
          </div>
          <div style="display: flex; gap: 8px;">
            <input v-model="newMaterial" class="form-input" placeholder="输入材料名称..." style="flex: 1;" @keyup.enter="addMaterial" />
            <button class="btn" @click="addMaterial">添加</button>
          </div>
        </div>
        <div class="form-item">
          <label class="form-label">登记说明 (至少5个字符)</label>
          <textarea v-model="submitForm.comment" class="form-textarea" rows="3" placeholder="请输入登记说明..."></textarea>
        </div>
        <button class="btn btn-primary" @click="handleSubmit" :disabled="submitting">
          {{ submitting ? '提交中...' : '提交登记' }}
        </button>
      </div>
      
      <div class="card" v-if="canAudit">
        <h3 class="section-title">🔍 核验办理</h3>
        <div class="form-item">
          <label class="form-label">核验项 (至少2项)</label>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label v-for="(item, idx) in auditForm.checkItems" :key="idx" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" v-model="item.passed" />
              <span>{{ item.name }}</span>
            </label>
          </div>
        </div>
        <div class="form-item">
          <label class="form-label">核验意见 (至少5个字符)</label>
          <textarea v-model="auditForm.comment" class="form-textarea" rows="3" placeholder="请输入核验意见..."></textarea>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary" @click="handleAudit('pass')" :disabled="submitting">
            {{ submitting ? '处理中...' : '核验通过' }}
          </button>
          <button class="btn btn-danger" @click="showRejectModal = true" :disabled="submitting">
            核验驳回
          </button>
        </div>
      </div>
      
      <div class="card" v-if="canReview">
        <h3 class="section-title">📦 复核归档</h3>
        <div class="form-item">
          <label class="form-label">归档编号</label>
          <input v-model="reviewForm.archiveNo" class="form-input" placeholder="请输入归档编号..." />
        </div>
        <div class="form-item">
          <label class="form-label">复核意见 (至少5个字符)</label>
          <textarea v-model="reviewForm.comment" class="form-textarea" rows="3" placeholder="请输入复核意见..."></textarea>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary" @click="handleReview" :disabled="submitting">
            {{ submitting ? '处理中...' : '确认归档' }}
          </button>
          <button class="btn btn-danger" @click="showRejectModal = true" :disabled="submitting">
            复核驳回
          </button>
        </div>
      </div>
      
      <div class="card">
        <h3 class="section-title">� 操作记录</h3>
        <div v-if="auditLogs.length === 0" style="text-align: center; padding: 20px; color: #999;">暂无操作记录</div>
        <div v-else class="audit-timeline">
          <div v-for="log in auditLogs" :key="log.id" :class="'audit-item ' + (log.success ? '' : 'audit-failed')">
            <div class="audit-time">{{ formatDate(log.createdAt) }}</div>
            <div class="audit-content">
              <div class="audit-title">
                <span class="audit-action">{{ log.actionName }}</span>
                <span v-if="!log.success" class="audit-failure-badge">失败</span>
              </div>
              <div class="audit-detail">
                <span>{{ log.operatorName }}</span>
                <span v-if="log.comment"> · {{ log.comment }}</span>
              </div>
              <div v-if="log.failureReason" class="audit-failure-reason">
                失败原因: {{ log.failureReason }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="showRejectModal" class="modal-overlay" @click.self="showRejectModal = false">
      <div class="modal-content">
        <h3>驳回确认</h3>
        <div class="form-item">
          <label class="form-label">驳回原因</label>
          <textarea 
            v-model="rejectReason" 
            class="form-textarea" 
            rows="4"
            placeholder="请输入驳回原因..."
          ></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button class="btn" @click="showRejectModal = false">取消</button>
          <button class="btn btn-danger" @click="confirmReject">确认驳回</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const auth = useAuth()
const api = useApi()
const route = useRoute()

const order = ref(null)
const auditLogs = ref([])
const loading = ref(false)
const error = ref('')
const submitting = ref(false)
const showRejectModal = ref(false)
const rejectReason = ref('')
const newMaterial = ref('')

const submitForm = ref({
  deadline: '',
  materials: [],
  comment: ''
})

const auditForm = ref({
  checkItems: [
    { name: '材料完整性检查', passed: false },
    { name: '规格参数检查', passed: false },
    { name: '工艺标准检查', passed: false },
    { name: '质检报告检查', passed: false }
  ],
  comment: ''
})

const reviewForm = ref({
  archiveNo: '',
  comment: ''
})

const canSubmit = computed(() => {
  if (!order.value) return false
  return auth.userRole.value === 'registrar' && 
         (order.value.status === 'draft' || order.value.status === 'rejected')
})

const canAudit = computed(() => {
  if (!order.value) return false
  return auth.userRole.value === 'auditor' && order.value.status === 'pending_audit'
})

const canReview = computed(() => {
  if (!order.value) return false
  return auth.userRole.value === 'reviewer' && order.value.status === 'pending_review'
})

const isRejected = computed(() => order.value?.status === 'rejected')

onMounted(async () => {
  if (!auth.checkAuth()) {
    navigateTo('/login')
    return
  }
  await loadOrder()
  await loadAuditLogs()
})

const loadOrder = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await api.get('/workorders/' + route.params.id)
    if (res.success) {
      order.value = res.data
      
      if (order.value.deadline) {
        const d = new Date(order.value.deadline)
        submitForm.value.deadline = d.toISOString().slice(0, 16)
      }
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const loadAuditLogs = async () => {
  try {
    const res = await api.get('/audit/workorder/' + route.params.id)
    if (res.success) {
      auditLogs.value = res.data
    }
  } catch (e) {
    console.error('加载审计记录失败', e)
  }
}

const addMaterial = () => {
  if (newMaterial.value.trim()) {
    submitForm.value.materials.push(newMaterial.value.trim())
    newMaterial.value = ''
  }
}

const removeMaterial = (idx) => {
  submitForm.value.materials.splice(idx, 1)
}

const handleSubmit = async () => {
  if (submitForm.value.materials.length < 3) {
    alert('请至少上传3份材料')
    return
  }
  if (!submitForm.value.comment || submitForm.value.comment.length < 5) {
    alert('登记说明至少5个字符')
    return
  }
  if (!submitForm.value.deadline) {
    alert('请设置处理时限')
    return
  }
  
  submitting.value = true
  try {
    const res = await api.post('/workorders/' + route.params.id + '/submit', {
      materials: submitForm.value.materials,
      comment: submitForm.value.comment,
      deadline: new Date(submitForm.value.deadline).toISOString()
    })
    if (res.success) {
      alert('提交成功')
      await loadOrder()
      await loadAuditLogs()
    }
  } catch (e) {
    alert('提交失败：' + e.message)
  } finally {
    submitting.value = false
  }
}

const handleAudit = async (action) => {
  if (action === 'pass') {
    const passedCount = auditForm.value.checkItems.filter(i => i.passed).length
    if (passedCount < 2) {
      alert('请至少勾选2项核验')
      return
    }
    if (!auditForm.value.comment || auditForm.value.comment.length < 5) {
      alert('核验意见至少5个字符')
      return
    }
    
    submitting.value = true
    try {
      const res = await api.post('/workorders/' + route.params.id + '/audit', {
        action: 'pass',
        comment: auditForm.value.comment,
        checkItems: auditForm.value.checkItems
      })
      if (res.success) {
        alert('核验通过')
        await loadOrder()
        await loadAuditLogs()
      }
    } catch (e) {
      alert('核验失败：' + e.message)
    } finally {
      submitting.value = false
    }
  } else {
    showRejectModal.value = true
  }
}

const handleReview = async () => {
  if (!reviewForm.value.archiveNo) {
    alert('请输入归档编号')
    return
  }
  if (!reviewForm.value.comment || reviewForm.value.comment.length < 5) {
    alert('复核意见至少5个字符')
    return
  }
  
  submitting.value = true
  try {
    const res = await api.post('/workorders/' + route.params.id + '/review', {
      archiveNo: reviewForm.value.archiveNo,
      comment: reviewForm.value.comment
    })
    if (res.success) {
      alert('归档成功')
      await loadOrder()
      await loadAuditLogs()
    }
  } catch (e) {
    alert('归档失败：' + e.message)
  } finally {
    submitting.value = false
  }
}

const confirmReject = async () => {
  if (!rejectReason.value || rejectReason.value.length < 5) {
    alert('驳回原因至少5个字符')
    return
  }
  
  submitting.value = true
  try {
    let endpoint = '/workorders/' + route.params.id
    if (auth.userRole.value === 'auditor') {
      endpoint += '/audit'
    } else {
      endpoint += '/review'
    }
    
    const res = await api.post(endpoint, {
      action: 'reject',
      comment: rejectReason.value
    })
    
    if (res.success) {
      alert('已驳回')
      showRejectModal.value = false
      rejectReason.value = ''
      await loadOrder()
      await loadAuditLogs()
    }
  } catch (e) {
    alert('操作失败：' + e.message)
  } finally {
    submitting.value = false
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  })
}

const isOverdue = (deadline) => {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

useHead({ title: '工单详情 - 生产工单系统' })
</script>

<style scoped>
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.info-label {
  font-size: 12px;
  color: #999;
}
.info-value {
  color: #333;
}
.priority-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}
.priority-high {
  background: #fff1f0;
  color: #f5222d;
}
.priority-medium {
  background: #fff7e6;
  color: #fa8c16;
}
.priority-low {
  background: #f6ffed;
  color: #52c41a;
}
</style>
