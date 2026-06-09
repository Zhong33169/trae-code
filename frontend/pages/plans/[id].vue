<template>
  <div v-if="plan">
    <div class="page-header">
      <div>
        <h2 class="page-title">护理计划单详情</h2>
        <div style="margin-top: 8px;">
          <span class="status-tag" :class="`status-${plan.status}`">
            {{ STATUS_MAP[plan.status] }}
          </span>
          <span style="margin-left: 12px; color: #666;">
            计划编号：{{ plan.plan_no }}
          </span>
        </div>
      </div>
      <button class="btn btn-default" @click="goBack">返回列表</button>
    </div>

    <div v-if="message" :class="['alert', messageType === 'success' ? 'alert-success' : 'alert-error']">
      {{ message }}
    </div>

    <div class="card">
      <h3 class="section-title">基本信息</h3>
      
      <div v-if="editingBasic" class="edit-form">
        <div class="grid-2">
          <div class="form-item">
            <label class="form-label">老人姓名</label>
            <input v-model="editForm.elder_name" class="form-input" />
          </div>
          <div class="form-item">
            <label class="form-label">性别</label>
            <select v-model="editForm.elder_gender" class="form-select">
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">年龄</label>
            <input v-model.number="editForm.elder_age" type="number" class="form-input" />
          </div>
          <div class="form-item">
            <label class="form-label">房间号</label>
            <input v-model="editForm.room_no" class="form-input" />
          </div>
          <div class="form-item">
            <label class="form-label">床位号</label>
            <input v-model="editForm.bed_no" class="form-input" />
          </div>
          <div class="form-item">
            <label class="form-label">入住日期</label>
            <input v-model="editForm.admission_date" type="date" class="form-input" />
          </div>
          <div class="form-item">
            <label class="form-label">护理级别</label>
            <select v-model="editForm.plan_level" class="form-select">
              <option value="">请选择</option>
              <option value="自理">自理</option>
              <option value="半自理">半自理</option>
              <option value="完全失能">完全失能</option>
              <option value="特护">特护</option>
            </select>
          </div>
        </div>
        <div class="form-item">
          <label class="form-label">护理计划内容</label>
          <textarea v-model="editForm.plan_content" class="form-textarea" rows="4"></textarea>
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="btn btn-default" @click="cancelEdit">取消</button>
          <button class="btn btn-primary" @click="saveEdit">保存</button>
        </div>
      </div>
      
      <div v-else>
        <div class="grid-2">
          <div class="info-row">
            <span class="info-label">老人姓名：</span>
            <span class="info-value">{{ plan.elder_name }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">性别：</span>
            <span class="info-value">{{ plan.elder_gender }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">年龄：</span>
            <span class="info-value">{{ plan.elder_age }} 岁</span>
          </div>
          <div class="info-row">
            <span class="info-label">房间/床位：</span>
            <span class="info-value">{{ plan.room_no }} / {{ plan.bed_no }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">入住日期：</span>
            <span class="info-value">{{ plan.admission_date || '-' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">护理级别：</span>
            <span class="info-value">{{ plan.plan_level || '-' }}</span>
          </div>
        </div>
        <div class="info-row" style="margin-top: 12px;">
          <span class="info-label">护理计划内容：</span>
          <span class="info-value" style="white-space: pre-wrap;">{{ plan.plan_content || '-' }}</span>
        </div>
        
        <div v-if="canEdit" style="margin-top: 16px; text-align: right;">
          <button class="btn btn-default" @click="startEdit">编辑</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">入住评估</h3>
      
      <div class="info-row">
        <span class="info-label">评估状态：</span>
        <span class="info-value">
          <span :class="['status-tag', `assessment-${plan.assessment_status}`]">
            {{ ASSESSMENT_STATUS_MAP[plan.assessment_status] }}
          </span>
        </span>
      </div>
      <div class="info-row">
        <span class="info-label">评估人：</span>
        <span class="info-value">{{ plan.assessment_by || '-' }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">评估时间：</span>
        <span class="info-value">{{ plan.assessment_at || '-' }}</span>
      </div>
      <div class="info-row" style="margin-top: 12px;">
        <span class="info-label">评估内容：</span>
        <span class="info-value" style="white-space: pre-wrap;">{{ plan.assessment_content || '-' }}</span>
      </div>
      
      <div v-if="canEditAssessment" style="margin-top: 16px;">
        <button class="btn btn-default" @click="showAssessmentModal = true">
          更新评估
        </button>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">家属确认</h3>
      
      <div class="info-row">
        <span class="info-label">确认状态：</span>
        <span class="info-value">
          <span :class="['status-tag', `family-${plan.family_confirm_status}`]">
            {{ FAMILY_CONFIRM_STATUS_MAP[plan.family_confirm_status] }}
          </span>
        </span>
      </div>
      <div class="info-row">
        <span class="info-label">确认人：</span>
        <span class="info-value">{{ plan.family_confirm_by || '-' }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">确认时间：</span>
        <span class="info-value">{{ plan.family_confirm_at || '-' }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">备注：</span>
        <span class="info-value">{{ plan.family_confirm_remark || '-' }}</span>
      </div>
      
      <div v-if="canEditFamily" style="margin-top: 16px;">
        <button class="btn btn-default" @click="showFamilyModal = true">
          更新家属确认
        </button>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">操作区</h3>
      
      <div v-if="submitBlockReasons.length > 0" class="alert alert-warning" style="margin-bottom: 16px;">
        <div style="font-weight: 600; margin-bottom: 8px;">提交前需要完成以下事项：</div>
        <ul style="margin-left: 20px;">
          <li v-for="(reason, idx) in submitBlockReasons" :key="idx">{{ reason }}</li>
        </ul>
      </div>
      
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <template v-if="(plan.status === 'draft' || plan.status === 'returned') && authStore.role === 'registrar'">
          <button 
            class="btn btn-primary" 
            @click="showSubmitModal = true"
            :disabled="!canSubmit"
          >
            {{ plan.status === 'returned' ? '重新提交审核' : '提交审核' }}
          </button>
        </template>
        
        <template v-if="plan.status === 'pending_audit' && authStore.role === 'auditor'">
          <button class="btn btn-success" @click="showApproveModal = true">
            审核通过
          </button>
          <button class="btn btn-danger" @click="showRejectModal = true">
            退回
          </button>
        </template>
        
        <template v-if="plan.status === 'pending_review' && authStore.role === 'reviewer'">
          <button class="btn btn-success" @click="showArchiveModal = true">
            复核归档
          </button>
          <button class="btn btn-danger" @click="showRejectModal = true">
            退回
          </button>
        </template>
        
        <span v-if="!hasAction" style="color: #999;">当前状态无可用操作</span>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">交接记录</h3>
      <div v-if="handovers.length === 0" class="empty">暂无交接记录</div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>班次</th>
            <th>交出人</th>
            <th>接收人</th>
            <th>确认时间</th>
            <th>交接内容</th>
            <th>记录时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in handovers" :key="record.id">
            <td>{{ record.shift }}</td>
            <td>{{ record.handover_by }}</td>
            <td>{{ record.takeover_by }}</td>
            <td>{{ formatDateTime(record.confirm_time) }}</td>
            <td>{{ record.handover_content || '-' }}</td>
            <td>{{ formatDateTime(record.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h3 class="section-title">操作日志</h3>
      <div v-if="logs.length === 0" class="empty">暂无操作记录</div>
      <div v-else class="timeline">
        <div v-for="log in logs" :key="log.id" class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-action">
              {{ log.action }}
              <span style="color: #999; font-weight: normal; margin-left: 8px;">
                - {{ log.operator_name }}
              </span>
            </div>
            <div class="timeline-time">{{ formatDateTime(log.created_at) }}</div>
            <div v-if="log.from_status && log.to_status" style="font-size: 13px; color: #666; margin-top: 4px;">
              状态变更：{{ STATUS_MAP[log.from_status] }} → {{ STATUS_MAP[log.to_status] }}
            </div>
            <div v-if="log.reason" class="timeline-reason">
              <strong>原因：</strong>{{ log.reason }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showAssessmentModal" class="modal-mask" @click.self="showAssessmentModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-title">更新入住评估</span>
          <button class="modal-close" @click="showAssessmentModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">评估状态</label>
            <select v-model="assessmentForm.status" class="form-select">
              <option value="pending">待评估</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">评估内容</label>
            <textarea 
              v-model="assessmentForm.content" 
              class="form-textarea" 
              rows="4"
              placeholder="请填写入住评估详细内容"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showAssessmentModal = false">取消</button>
          <button class="btn btn-primary" @click="saveAssessment" :disabled="submitting">
            保存
          </button>
        </div>
      </div>
    </div>

    <div v-if="showFamilyModal" class="modal-mask" @click.self="showFamilyModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-title">更新家属确认</span>
          <button class="modal-close" @click="showFamilyModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">确认状态</label>
            <select v-model="familyForm.status" class="form-select">
              <option value="pending">待确认</option>
              <option value="confirmed">已确认</option>
              <option value="rejected">已拒绝</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">确认人姓名</label>
            <input v-model="familyForm.by" class="form-input" placeholder="请输入家属姓名" />
          </div>
          <div class="form-item">
            <label class="form-label">备注</label>
            <textarea 
              v-model="familyForm.remark" 
              class="form-textarea" 
              rows="3"
              placeholder="家属确认备注"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showFamilyModal = false">取消</button>
          <button class="btn btn-primary" @click="saveFamily" :disabled="submitting">
            保存
          </button>
        </div>
      </div>
    </div>

    <div v-if="showSubmitModal" class="modal-mask" @click.self="showSubmitModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-title">提交审核</span>
          <button class="modal-close" @click="showSubmitModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="alert alert-warning">
            提交后将进入审核流程，请确认信息无误。
          </div>
          <p style="margin-top: 12px;">确定要提交该护理计划单进入审核吗？</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showSubmitModal = false">取消</button>
          <button class="btn btn-primary" @click="handleSubmit" :disabled="submitting">
            确认提交
          </button>
        </div>
      </div>
    </div>

    <div v-if="showApproveModal || showArchiveModal" class="modal-mask" @click.self="closeHandoverModal">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-title">{{ showArchiveModal ? '复核归档' : '审核通过' }}</span>
          <button class="modal-close" @click="closeHandoverModal">×</button>
        </div>
        <div class="modal-body">
          <div class="alert alert-warning" style="margin-bottom: 16px;">
            进入下一步前必须填写交接信息，班次、交出人、接收人和确认时间缺一不可。
          </div>
          
          <div class="grid-2">
            <div class="form-item">
              <label class="form-label">班次 <span style="color: #f5222d;">*</span></label>
              <select v-model="handoverForm.shift" class="form-select">
                <option value="">请选择班次</option>
                <option v-for="s in SHIFT_OPTIONS" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label">确认时间 <span style="color: #f5222d;">*</span></label>
              <input v-model="handoverForm.confirm_time" type="datetime-local" class="form-input" />
            </div>
            <div class="form-item">
              <label class="form-label">交出人 <span style="color: #f5222d;">*</span></label>
              <input v-model="handoverForm.handover_by" class="form-input" placeholder="请输入交出人姓名" />
            </div>
            <div class="form-item">
              <label class="form-label">接收人 <span style="color: #f5222d;">*</span></label>
              <input v-model="handoverForm.takeover_by" class="form-input" placeholder="请输入接收人姓名" />
            </div>
          </div>
          
          <div class="form-item">
            <label class="form-label">交接内容</label>
            <textarea 
              v-model="handoverForm.handover_content" 
              class="form-textarea" 
              rows="3"
              placeholder="请填写交接注意事项等内容"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="closeHandoverModal">取消</button>
          <button 
            class="btn btn-success" 
            @click="handleApproveOrArchive" 
            :disabled="submitting || !canSubmitHandover"
          >
            {{ showArchiveModal ? '确认归档' : '确认通过' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showRejectModal" class="modal-mask" @click.self="showRejectModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-title">退回护理计划</span>
          <button class="modal-close" @click="showRejectModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">退回原因 <span style="color: #f5222d;">*</span></label>
            <textarea 
              v-model="rejectReason" 
              class="form-textarea" 
              rows="4"
              placeholder="请详细说明退回原因，方便后续补正"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showRejectModal = false">取消</button>
          <button 
            class="btn btn-danger" 
            @click="handleReject" 
            :disabled="submitting || !rejectReason.trim()"
          >
            确认退回
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <div v-else class="loading">加载中...</div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import { 
  STATUS_MAP, 
  ASSESSMENT_STATUS_MAP, 
  FAMILY_CONFIRM_STATUS_MAP,
  SHIFT_OPTIONS,
  type NursingPlan,
  type OperationLog,
  type HandoverRecord
} from '~/types'

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const authStore = useAuthStore()

const plan = ref<NursingPlan | null>(null)
const logs = ref<OperationLog[]>([])
const handovers = ref<HandoverRecord[]>([])
const loading = ref(true)
const submitting = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

const editingBasic = ref(false)
const editForm = reactive({
  elder_name: '',
  elder_gender: '',
  elder_age: 0,
  room_no: '',
  bed_no: '',
  admission_date: '',
  plan_content: '',
  plan_level: ''
})

const showAssessmentModal = ref(false)
const assessmentForm = reactive({
  status: 'pending',
  content: ''
})

const showFamilyModal = ref(false)
const familyForm = reactive({
  status: 'pending',
  by: '',
  remark: ''
})

const showSubmitModal = ref(false)
const showApproveModal = ref(false)
const showArchiveModal = ref(false)
const showRejectModal = ref(false)
const rejectReason = ref('')

const handoverForm = reactive({
  shift: '',
  handover_by: '',
  takeover_by: '',
  confirm_time: '',
  handover_content: ''
})

const canEdit = computed(() => {
  if (authStore.role !== 'registrar') return false
  return plan.value?.status === 'draft' || plan.value?.status === 'returned'
})

const canEditAssessment = computed(() => {
  return authStore.role === 'registrar' || authStore.role === 'auditor'
})

const canEditFamily = computed(() => {
  return authStore.role === 'registrar' || authStore.role === 'auditor'
})

const hasAction = computed(() => {
  if (!plan.value) return false
  const status = plan.value.status
  const role = authStore.role
  
  if ((status === 'draft' || status === 'returned') && role === 'registrar') return true
  if (status === 'pending_audit' && role === 'auditor') return true
  if (status === 'pending_review' && role === 'reviewer') return true
  return false
})

const submitBlockReasons = computed(() => {
  const reasons: string[] = []
  if (!plan.value) return reasons
  
  if (plan.value.assessment_status !== 'completed') {
    reasons.push('入住评估未完成')
  }
  if (plan.value.family_confirm_status !== 'confirmed') {
    reasons.push('家属未确认')
  }
  if (!plan.value.plan_content || plan.value.plan_content.trim() === '') {
    reasons.push('护理计划内容为空')
  }
  
  return reasons
})

const canSubmit = computed(() => {
  return submitBlockReasons.value.length === 0
})

const canSubmitHandover = computed(() => {
  return handoverForm.shift.trim() !== '' &&
         handoverForm.handover_by.trim() !== '' &&
         handoverForm.takeover_by.trim() !== '' &&
         handoverForm.confirm_time.trim() !== ''
})

function formatDateTime(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr.replace('T', ' ').substring(0, 16)
}

function goBack() {
  navigateTo('/plans')
}

function showMessage(msg: string, type: 'success' | 'error' = 'success') {
  message.value = msg
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 3000)
}

async function loadPlan() {
  const id = route.params.id as string
  if (!id) return
  
  try {
    const result = await $fetch(`http://localhost:8001/api/plans/${id}`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    }) as any
    
    if (result.success) {
      plan.value = result.data
    }
  } catch (e) {
    console.error('加载详情失败', e)
  } finally {
    loading.value = false
  }
}

async function loadLogs() {
  const id = route.params.id as string
  if (!id) return
  
  try {
    const result = await $fetch(`http://localhost:8001/api/plans/${id}/logs`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    }) as any
    
    if (result.success) {
      logs.value = result.data
    }
  } catch (e) {
    console.error('加载日志失败', e)
  }
}

async function loadHandovers() {
  const id = route.params.id as string
  if (!id) return
  
  try {
    const result = await $fetch(`http://localhost:8001/api/plans/${id}/handovers`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    }) as any
    
    if (result.success) {
      handovers.value = result.data
    }
  } catch (e) {
    console.error('加载交接记录失败', e)
  }
}

function startEdit() {
  if (!plan.value) return
  editingBasic.value = true
  editForm.elder_name = plan.value.elder_name
  editForm.elder_gender = plan.value.elder_gender
  editForm.elder_age = plan.value.elder_age
  editForm.room_no = plan.value.room_no
  editForm.bed_no = plan.value.bed_no
  editForm.admission_date = plan.value.admission_date || ''
  editForm.plan_content = plan.value.plan_content || ''
  editForm.plan_level = plan.value.plan_level || ''
}

function cancelEdit() {
  editingBasic.value = false
}

async function saveEdit() {
  if (!plan.value) return
  
  submitting.value = true
  try {
    const result = await $fetch(`http://localhost:8001/api/plans/${plan.value.id}`, {
      method: 'PUT',
      body: {
        elder_name: editForm.elder_name,
        elder_gender: editForm.elder_gender,
        elder_age: editForm.elder_age,
        room_no: editForm.room_no,
        bed_no: editForm.bed_no,
        admission_date: editForm.admission_date || null,
        plan_content: editForm.plan_content || null,
        plan_level: editForm.plan_level || null
      },
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    }) as any
    
    if (result.success) {
      plan.value = result.data
      editingBasic.value = false
      showMessage('更新成功')
      loadLogs()
    } else {
      showMessage(result.message || '更新失败', 'error')
    }
  } catch (e: any) {
    showMessage(e.data?.message || e.message || '更新失败', 'error')
  } finally {
    submitting.value = false
  }
}

async function saveAssessment() {
  if (!plan.value) return
  
  submitting.value = true
  try {
    const result = await $fetch(`http://localhost:8001/api/plans/${plan.value.id}/assessment`, {
      method: 'PUT',
      body: {
        assessment_status: assessmentForm.status,
        assessment_content: assessmentForm.content || null
      },
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    }) as any
    
    if (result.success) {
      plan.value = result.data
      showAssessmentModal.value = false
      showMessage('评估更新成功')
      loadLogs()
    } else {
      showMessage(result.message || '更新失败', 'error')
    }
  } catch (e: any) {
    showMessage(e.data?.message || e.message || '更新失败', 'error')
  } finally {
    submitting.value = false
  }
}

async function saveFamily() {
  if (!plan.value) return
  
  submitting.value = true
  try {
    const result = await $fetch(`http://localhost:8001/api/plans/${plan.value.id}/family-confirm`, {
      method: 'PUT',
      body: {
        family_confirm_status: familyForm.status,
        family_confirm_by: familyForm.by,
        family_confirm_remark: familyForm.remark || null
      },
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    }) as any
    
    if (result.success) {
      plan.value = result.data
      showFamilyModal.value = false
      showMessage('家属确认更新成功')
      loadLogs()
    } else {
      showMessage(result.message || '更新失败', 'error')
    }
  } catch (e: any) {
    showMessage(e.data?.message || e.message || '更新失败', 'error')
  } finally {
    submitting.value = false
  }
}

async function handleSubmit() {
  if (!plan.value) return
  
  submitting.value = true
  try {
    const action = plan.value.status === 'returned' ? 'resubmit' : 'submit'
    const result = await $fetch(`http://localhost:8001/api/plans/${plan.value.id}/transition`, {
      method: 'POST',
      body: { action },
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    }) as any
    
    if (result.success) {
      plan.value = result.data
      showSubmitModal.value = false
      showMessage(result.message || '提交成功')
      loadLogs()
      loadHandovers()
    } else {
      showMessage(result.message || '提交失败', 'error')
    }
  } catch (e: any) {
    showMessage(e.data?.message || e.message || '提交失败', 'error')
  } finally {
    submitting.value = false
  }
}

function closeHandoverModal() {
  showApproveModal.value = false
  showArchiveModal.value = false
}

function resetHandoverForm() {
  handoverForm.shift = ''
  handoverForm.handover_by = ''
  handoverForm.takeover_by = ''
  handoverForm.confirm_time = ''
  handoverForm.handover_content = ''
}

async function handleApproveOrArchive() {
  if (!plan.value) return
  
  submitting.value = true
  try {
    const action = showArchiveModal.value ? 'archive' : 'approve'
    
    const result = await $fetch(`http://localhost:8001/api/plans/${plan.value.id}/transition`, {
      method: 'POST',
      body: {
        action,
        handover: {
          shift: handoverForm.shift,
          handover_by: handoverForm.handover_by,
          takeover_by: handoverForm.takeover_by,
          confirm_time: handoverForm.confirm_time,
          handover_content: handoverForm.handover_content || null
        }
      },
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    }) as any
    
    if (result.success) {
      plan.value = result.data
      closeHandoverModal()
      resetHandoverForm()
      showMessage(result.message || '操作成功')
      loadLogs()
      loadHandovers()
    } else {
      showMessage(result.message || '操作失败', 'error')
    }
  } catch (e: any) {
    showMessage(e.data?.message || e.message || '操作失败', 'error')
  } finally {
    submitting.value = false
  }
}

async function handleReject() {
  if (!plan.value || !rejectReason.value.trim()) return
  
  submitting.value = true
  try {
    const result = await $fetch(`http://localhost:8001/api/plans/${plan.value.id}/transition`, {
      method: 'POST',
      body: {
        action: 'reject',
        reason: rejectReason.value
      },
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    }) as any
    
    if (result.success) {
      plan.value = result.data
      showRejectModal.value = false
      rejectReason.value = ''
      showMessage(result.message || '已退回')
      loadLogs()
    } else {
      showMessage(result.message || '操作失败', 'error')
    }
  } catch (e: any) {
    showMessage(e.data?.message || e.message || '操作失败', 'error')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (!authStore.isLoggedIn) {
    navigateTo('/login')
    return
  }
  
  loadPlan()
  loadLogs()
  loadHandovers()
})
</script>

<style scoped>
.assessment-pending {
  background: #fff7e6;
  color: #fa8c16;
}

.assessment-completed {
  background: #f6ffed;
  color: #52c41a;
}

.assessment-cancelled {
  background: #f0f0f0;
  color: #999;
}

.family-pending {
  background: #fff7e6;
  color: #fa8c16;
}

.family-confirmed {
  background: #f6ffed;
  color: #52c41a;
}

.family-rejected {
  background: #fff1f0;
  color: #f5222d;
}

.edit-form {
  padding-bottom: 8px;
}
</style>
