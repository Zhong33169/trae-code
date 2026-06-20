<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { getCareRecord, updateCareRecordStatus, addMedication, createDischarge, confirmDischarge, uploadAttachment, reviewAttachment, supplementAttachment } from '../api/care'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const record = ref(null)
const loading = ref(true)
const activeTab = ref('basic')
const msg = ref('')
const msgType = ref('info')

const returnReason = ref('')
const showReturnDialog = ref(false)

const medForm = ref({ medicine_name: '', dosage: '', route: '', frequency: '', start_time: '', end_time: '', notes: '' })
const dischargeForm = ref({ discharge_date: '', discharge_summary: '', follow_up: '', condition_at_discharge: '' })
const uploadForm = ref({ category: 'other', is_required: '0', upload_type: 'initial', supplement_reason: '', file_name: '', file_type: '' })
const rejectReason = ref('')
const showRejectDialog = ref(false)
const rejectingAttId = ref(null)
const supplementReason = ref('')
const showSupplementDialog = ref(false)
const supplementingAttId = ref(null)

const statusMap = {
  initiated: '已发起', processing: '办理中', reviewing: '复核中',
  archived: '已归档', returned: '已退回', overdue: '超时'
}

const categoryMap = {
  admission_form: '入院登记表', consent_form: '住院同意书', lab_result: '化验报告',
  imaging: '影像资料', treatment_record: '治疗记录', other: '其他'
}

const uploadTypeMap = {
  initial: '初始上传', supplement: '补传', resubmit: '重新提交'
}

function showMsg(text, type = 'info') {
  msg.value = text
  msgType.value = type
  setTimeout(() => { msg.value = '' }, 4000)
}

async function loadRecord() {
  loading.value = true
  try {
    const res = await getCareRecord(route.params.id)
    record.value = res.data
  } catch (e) {
    showMsg('加载护理单详情失败', 'danger')
  }
  loading.value = false
}

async function changeStatus(newStatus, extra = {}) {
  try {
    await updateCareRecordStatus(record.value.id, { status: newStatus, ...extra })
    showMsg(`状态已更新为 ${statusMap[newStatus]}`, 'success')
    loadRecord()
  } catch (e) {
    showMsg(e.response?.data?.error || '状态更新失败', 'danger')
  }
}

function handleReturn() {
  if (!returnReason.value.trim()) {
    showMsg('请填写退回原因', 'warning')
    return
  }
  changeStatus('returned', { return_reason: returnReason.value })
  showReturnDialog.value = false
  returnReason.value = ''
}

async function handleAddMedication() {
  if (!medForm.value.medicine_name || !medForm.value.dosage || !medForm.value.start_time) {
    showMsg('请填写药品名称、剂量和开始时间', 'warning')
    return
  }
  try {
    await addMedication(record.value.id, medForm.value)
    showMsg('用药记录已添加', 'success')
    medForm.value = { medicine_name: '', dosage: '', route: '', frequency: '', start_time: '', end_time: '', notes: '' }
    loadRecord()
  } catch (e) {
    showMsg('添加用药记录失败', 'danger')
  }
}

async function handleCreateDischarge() {
  if (!dischargeForm.value.discharge_date || !dischargeForm.value.discharge_summary) {
    showMsg('请填写出院日期和出院小结', 'warning')
    return
  }
  try {
    await createDischarge(record.value.id, dischargeForm.value)
    showMsg('出院确认已创建', 'success')
    dischargeForm.value = { discharge_date: '', discharge_summary: '', follow_up: '', condition_at_discharge: '' }
    loadRecord()
  } catch (e) {
    showMsg('创建出院确认失败', 'danger')
  }
}

async function handleConfirmDischarge(dischId, status, reason) {
  try {
    await confirmDischarge(dischId, { status, reject_reason: reason })
    showMsg(status === 'confirmed' ? '出院已确认，护理单已归档' : '出院确认已驳回', status === 'confirmed' ? 'success' : 'warning')
    loadRecord()
  } catch (e) {
    showMsg('处理出院确认失败', 'danger')
  }
}

async function handleUpload() {
  if (!uploadForm.value.file_name) {
    showMsg('请填写文件名（演示模式）', 'warning')
    return
  }
  try {
    const formData = new FormData()
    formData.append('file_name', uploadForm.value.file_name)
    formData.append('file_type', uploadForm.value.file_type || '.pdf')
    formData.append('category', uploadForm.value.category)
    formData.append('is_required', uploadForm.value.is_required)
    formData.append('upload_type', uploadForm.value.upload_type)
    if (uploadForm.value.supplement_reason) {
      formData.append('supplement_reason', uploadForm.value.supplement_reason)
    }
    await uploadAttachment(record.value.id, formData)
    showMsg('附件已上传', 'success')
    uploadForm.value = { category: 'other', is_required: '0', upload_type: 'initial', supplement_reason: '', file_name: '', file_type: '' }
    loadRecord()
  } catch (e) {
    showMsg('上传附件失败', 'danger')
  }
}

async function handleReviewAttachment(attId, status) {
  if (status === 'rejected') {
    rejectingAttId.value = attId
    showRejectDialog.value = true
    return
  }
  try {
    await reviewAttachment(attId, { status })
    showMsg('附件审核通过', 'success')
    loadRecord()
  } catch (e) {
    showMsg('审核附件失败', 'danger')
  }
}

async function confirmReject() {
  if (!rejectReason.value.trim()) {
    showMsg('请填写驳回原因', 'warning')
    return
  }
  try {
    await reviewAttachment(rejectingAttId.value, { status: 'rejected', reject_reason: rejectReason.value })
    showMsg('附件已驳回', 'warning')
    showRejectDialog.value = false
    rejectReason.value = ''
    rejectingAttId.value = null
    loadRecord()
  } catch (e) {
    showMsg('驳回附件失败', 'danger')
  }
}

async function handleSupplementAttachment(attId) {
  supplementingAttId.value = attId
  showSupplementDialog.value = true
}

async function confirmSupplement() {
  if (!supplementReason.value.trim()) {
    showMsg('请填写补传原因', 'warning')
    return
  }
  try {
    await supplementAttachment(supplementingAttId.value, { supplement_reason: supplementReason.value })
    showMsg('附件已标记为补传', 'success')
    showSupplementDialog.value = false
    supplementReason.value = ''
    supplementingAttId.value = null
    loadRecord()
  } catch (e) {
    showMsg('标记补传失败', 'danger')
  }
}

function parseJSON(str) {
  try { return JSON.parse(str) } catch { return str }
}

const canAdvanceStatus = computed(() => {
  if (!record.value) return {}
  const s = record.value.status
  const r = userStore.role
  const result = {}
  if (s === 'initiated' && (r === 'doctor' || r === 'admin')) result.processing = true
  if (s === 'processing') {
    if (r === 'nurse' || r === 'admin') result.reviewing = true
    if (r === 'nurse' || r === 'admin' || r === 'doctor') result.returned = true
  }
  if (s === 'reviewing') {
    if (r === 'reviewer' || r === 'admin') result.archived = true
    if (r === 'reviewer' || r === 'admin') result.returned = true
  }
  if (s === 'returned' && (r === 'nurse' || r === 'doctor' || r === 'admin')) result.processing = true
  if (s === 'overdue' && (r === 'nurse' || r === 'doctor' || r === 'admin')) result.processing = true
  return result
})

onMounted(loadRecord)
</script>

<template>
  <div v-if="loading" class="empty-state">加载中...</div>
  <div v-else-if="record">
    <div class="page-title">
      <span>
        <button class="btn btn-sm btn-outline" @click="router.push('/care-records')" style="margin-right:8px">← 返回</button>
        护理单 #{{ record.id }} - {{ record.pet_name }}
      </span>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="status-badge" :class="`status-${record.status}`">{{ statusMap[record.status] }}</span>
        <span class="priority-badge" :class="`priority-${record.priority}`">{{ {normal:'普通',urgent:'紧急',critical:'危重'}[record.priority] }}</span>
      </div>
    </div>

    <div v-if="record.is_overdue || record.status === 'overdue'" class="alert alert-danger">
      ⚠️ 此护理单已超时！截止日期: {{ record.deadline }}
    </div>
    <div v-if="record.status === 'returned'" class="alert alert-danger">
      ⚠️ 此护理单已被退回。退回原因: {{ record.return_reason }}
    </div>

    <div v-if="msg" :class="`alert alert-${msgType}`">{{ msg }}</div>

    <div class="tabs">
      <div class="tab" :class="{ active: activeTab === 'basic' }" @click="activeTab = 'basic'">基本信息</div>
      <div class="tab" :class="{ active: activeTab === 'attachments' }" @click="activeTab = 'attachments'">
        附件管理
        <span v-if="record.attachments?.length" style="margin-left:4px;font-size:12px;color:#999">({{ record.attachments.length }})</span>
      </div>
      <div class="tab" :class="{ active: activeTab === 'medications' }" @click="activeTab = 'medications'">用药记录</div>
      <div class="tab" :class="{ active: activeTab === 'discharge' }" @click="activeTab = 'discharge'">出院确认</div>
      <div class="tab" :class="{ active: activeTab === 'audit' }" @click="activeTab = 'audit'">审计日志</div>
    </div>

    <div v-if="activeTab === 'basic'" class="card">
      <div class="card-header">
        <h3>住院护理单信息</h3>
        <div style="display:flex;gap:8px">
          <button v-if="canAdvanceStatus.processing" class="btn btn-sm btn-primary" @click="changeStatus('processing')">
            {{ record.status === 'initiated' ? '开始办理' : '重新办理' }}
          </button>
          <button v-if="canAdvanceStatus.reviewing" class="btn btn-sm btn-warning" @click="changeStatus('reviewing')">
            提交复核
          </button>
          <button v-if="canAdvanceStatus.archived" class="btn btn-sm btn-success" @click="changeStatus('archived')">
            确认归档
          </button>
          <button v-if="canAdvanceStatus.returned" class="btn btn-sm btn-danger" @click="showReturnDialog = true">
            退回
          </button>
        </div>
      </div>

      <div class="form-row">
        <div><strong>宠物名：</strong>{{ record.pet_name }}</div>
        <div><strong>品种：</strong>{{ record.species }} {{ record.breed }}</div>
        <div><strong>主人：</strong>{{ record.owner_name }} ({{ record.owner_phone }})</div>
        <div><strong>入院日期：</strong>{{ record.admission_date }}</div>
        <div><strong>诊断：</strong>{{ record.diagnosis }}</div>
        <div><strong>治疗方案：</strong>{{ record.treatment_plan }}</div>
        <div><strong>病房：</strong>{{ record.ward }} {{ record.bed_number }}</div>
        <div><strong>截止日期：</strong>{{ record.deadline || '未设定' }}</div>
      </div>

      <div style="margin-top:16px;padding-top:12px;border-top:1px solid #eee">
        <div class="form-row">
          <div><strong>负责医生：</strong>{{ record.doctor_name || '未指定' }}</div>
          <div><strong>护理护士：</strong>{{ record.nurse_name || '未指定' }}</div>
          <div><strong>复核人：</strong>{{ record.reviewer_name || '未指定' }}</div>
          <div><strong>创建时间：</strong>{{ record.created_at }}</div>
        </div>
      </div>

      <div style="margin-top:12px;font-size:12px;color:#999">
        当前角色可执行操作：
        <span v-if="userStore.canInitiate">发起</span>
        <span v-if="userStore.canProcess">办理</span>
        <span v-if="userStore.canReview">复核归档</span>
        <span v-if="userStore.role === 'admin'">全部</span>
      </div>
    </div>

    <div v-if="activeTab === 'attachments'" class="card">
      <div class="card-header">
        <h3>附件管理</h3>
      </div>

      <div v-if="record.attachments?.length" class="att-list">
        <div v-for="att in record.attachments" :key="att.id" class="att-item" :class="{ 'att-rejected': att.status === 'rejected' }">
          <div class="att-main">
            <div class="att-name">
              {{ att.file_name }}
              <span v-if="att.is_required" class="tag-required">必传</span>
              <span :class="`tag-${att.upload_type}`">{{ uploadTypeMap[att.upload_type] }}</span>
              <span :class="`att-status-${att.status}`">{{ {pending:'待审核',approved:'已通过',rejected:'已驳回'}[att.status] }}</span>
            </div>
            <div class="att-meta">
              类型: {{ categoryMap[att.category] || att.category }} |
              大小: {{ att.file_size ? (att.file_size / 1024).toFixed(1) + 'KB' : '-' }} |
              上传者: {{ att.uploader_name || '-' }} |
              上传时间: {{ att.created_at }}
            </div>
            <div v-if="att.reject_reason" class="att-reject-reason">
              驳回原因: {{ att.reject_reason }}
            </div>
            <div v-if="att.supplement_reason" class="att-supplement-reason">
              补传原因: {{ att.supplement_reason }}
            </div>
            <div v-if="att.replaced_attachment_id" class="attachment-replaced-info">
              此附件替换了附件 #{{ att.replaced_attachment_id }}
            </div>
            <div v-if="att.reviewed_at" style="font-size:11px;color:#999;margin-top:2px">
              审核时间: {{ att.reviewed_at }}
            </div>
          </div>
          <div class="att-actions">
            <template v-if="userStore.canReview && att.status === 'pending'">
              <button class="btn btn-sm btn-success" @click="handleReviewAttachment(att.id, 'approved')">通过</button>
              <button class="btn btn-sm btn-danger" @click="handleReviewAttachment(att.id, 'rejected')">驳回</button>
            </template>
            <template v-if="(userStore.canProcess || userStore.canInitiate) && att.status !== 'rejected' && att.upload_type === 'initial'">
              <button class="btn btn-sm btn-warning" @click="handleSupplementAttachment(att.id)">标记补传</button>
            </template>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">暂无附件</div>

      <div v-if="userStore.canProcess || userStore.canInitiate" style="margin-top:20px;padding-top:16px;border-top:1px solid #eee">
        <h4 style="font-size:14px;margin-bottom:12px">上传附件（演示模式，填写文件名即可）</h4>
        <div class="form-row">
          <div class="form-group">
            <label>文件名</label>
            <input v-model="uploadForm.file_name" placeholder="例：入院登记表.pdf" />
          </div>
          <div class="form-group">
            <label>文件类型</label>
            <input v-model="uploadForm.file_type" placeholder=".pdf" />
          </div>
          <div class="form-group">
            <label>附件类别</label>
            <select v-model="uploadForm.category">
              <option value="admission_form">入院登记表</option>
              <option value="consent_form">住院同意书</option>
              <option value="lab_result">化验报告</option>
              <option value="imaging">影像资料</option>
              <option value="treatment_record">治疗记录</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div class="form-group">
            <label>是否必传</label>
            <select v-model="uploadForm.is_required">
              <option value="0">非必传</option>
              <option value="1">必传</option>
            </select>
          </div>
          <div class="form-group">
            <label>上传类型</label>
            <select v-model="uploadForm.upload_type">
              <option value="initial">初始上传</option>
              <option value="supplement">补传</option>
              <option value="resubmit">重新提交</option>
            </select>
          </div>
          <div class="form-group" v-if="uploadForm.upload_type === 'supplement' || uploadForm.upload_type === 'resubmit'">
            <label>补传/重提原因</label>
            <input v-model="uploadForm.supplement_reason" placeholder="请说明补传原因" />
          </div>
        </div>
        <button class="btn btn-primary" @click="handleUpload">上传附件</button>
      </div>
    </div>

    <div v-if="activeTab === 'medications'" class="card">
      <div class="card-header">
        <h3>用药记录</h3>
      </div>

      <table v-if="record.medications?.length">
        <thead>
          <tr>
            <th>药品</th>
            <th>剂量</th>
            <th>给药途径</th>
            <th>频率</th>
            <th>开始时间</th>
            <th>结束时间</th>
            <th>执行人</th>
            <th>备注</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="med in record.medications" :key="med.id">
            <td><strong>{{ med.medicine_name }}</strong></td>
            <td>{{ med.dosage }}</td>
            <td>{{ med.route }}</td>
            <td>{{ med.frequency }}</td>
            <td>{{ med.start_time }}</td>
            <td>{{ med.end_time || '-' }}</td>
            <td>{{ med.administer_name || '-' }}</td>
            <td>{{ med.notes }}</td>
            <td>
              <span class="status-badge" :class="`status-${med.status === 'active' ? 'processing' : med.status === 'completed' ? 'archived' : 'returned'}`">
                {{ {active:'使用中',completed:'已完成',discontinued:'已停用'}[med.status] }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">暂无用药记录</div>

      <div v-if="userStore.canProcess && record.status !== 'archived'" style="margin-top:20px;padding-top:16px;border-top:1px solid #eee">
        <h4 style="font-size:14px;margin-bottom:12px">添加用药记录</h4>
        <div class="form-row">
          <div class="form-group">
            <label>药品名称 *</label>
            <input v-model="medForm.medicine_name" placeholder="例：阿莫西林" />
          </div>
          <div class="form-group">
            <label>剂量 *</label>
            <input v-model="medForm.dosage" placeholder="例：12.5mg/kg" />
          </div>
          <div class="form-group">
            <label>给药途径</label>
            <select v-model="medForm.route">
              <option value="">请选择</option>
              <option value="口服">口服</option>
              <option value="皮下注射">皮下注射</option>
              <option value="静脉滴注">静脉滴注</option>
              <option value="静脉推注">静脉推注</option>
              <option value="雾化吸入">雾化吸入</option>
              <option value="外用">外用</option>
            </select>
          </div>
          <div class="form-group">
            <label>频率</label>
            <input v-model="medForm.frequency" placeholder="例：每日2次" />
          </div>
          <div class="form-group">
            <label>开始时间 *</label>
            <input v-model="medForm.start_time" type="datetime-local" />
          </div>
          <div class="form-group">
            <label>结束时间</label>
            <input v-model="medForm.end_time" type="datetime-local" />
          </div>
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea v-model="medForm.notes" rows="2" placeholder="用药备注..."></textarea>
        </div>
        <button class="btn btn-primary" @click="handleAddMedication">添加用药记录</button>
      </div>
    </div>

    <div v-if="activeTab === 'discharge'" class="card">
      <div class="card-header">
        <h3>出院确认</h3>
      </div>

      <div v-if="record.discharges?.length">
        <div v-for="d in record.discharges" :key="d.id" class="discharge-item" style="margin-bottom:16px;padding:16px;background:#f8f9fa;border-radius:8px">
          <div class="form-row">
            <div><strong>出院日期：</strong>{{ d.discharge_date }}</div>
            <div><strong>状态：</strong>
              <span class="status-badge" :class="`status-${d.status === 'confirmed' ? 'archived' : d.status === 'rejected' ? 'returned' : 'processing'}`">
                {{ {pending:'待确认',confirmed:'已确认',rejected:'已驳回'}[d.status] }}
              </span>
            </div>
          </div>
          <div style="margin-top:8px"><strong>出院小结：</strong>{{ d.discharge_summary }}</div>
          <div v-if="d.follow_up" style="margin-top:4px"><strong>随访计划：</strong>{{ d.follow_up }}</div>
          <div v-if="d.condition_at_discharge" style="margin-top:4px"><strong>出院时状况：</strong>{{ d.condition_at_discharge }}</div>
          <div style="margin-top:4px;font-size:12px;color:#999">
            开具人: {{ d.discharger_name || '-' }} | 确认人: {{ d.confirmer_name || '-' }} | 确认时间: {{ d.confirmed_at || '-' }}
          </div>
          <div v-if="userStore.canReview && d.status === 'pending'" style="margin-top:12px;display:flex;gap:8px">
            <button class="btn btn-sm btn-success" @click="handleConfirmDischarge(d.id, 'confirmed')">确认出院</button>
            <button class="btn btn-sm btn-danger" @click="handleConfirmDischarge(d.id, 'rejected')">驳回</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">暂无出院确认记录</div>

      <div v-if="userStore.canInitiate && record.status !== 'archived'" style="margin-top:20px;padding-top:16px;border-top:1px solid #eee">
        <h4 style="font-size:14px;margin-bottom:12px">创建出院确认</h4>
        <div class="form-row">
          <div class="form-group">
            <label>出院日期 *</label>
            <input v-model="dischargeForm.discharge_date" type="date" />
          </div>
          <div class="form-group">
            <label>出院时状况</label>
            <input v-model="dischargeForm.condition_at_discharge" placeholder="例：良好" />
          </div>
        </div>
        <div class="form-group">
          <label>出院小结 *</label>
          <textarea v-model="dischargeForm.discharge_summary" rows="3" placeholder="出院小结..."></textarea>
        </div>
        <div class="form-group">
          <label>随访计划</label>
          <textarea v-model="dischargeForm.follow_up" rows="2" placeholder="随访计划..."></textarea>
        </div>
        <button class="btn btn-primary" @click="handleCreateDischarge">创建出院确认</button>
      </div>
    </div>

    <div v-if="activeTab === 'audit'" class="card">
      <div class="card-header">
        <h3>审计日志</h3>
      </div>

      <div v-if="record.audit_logs?.length" class="audit-timeline">
        <div v-for="log in record.audit_logs" :key="log.id" class="audit-item" :class="`action-${log.action}`">
          <div class="audit-time">{{ log.created_at }}</div>
          <div class="audit-actor">
            [{{ log.actor_role }}] {{ log.actor_name }} — {{ log.action }}
          </div>
          <div class="audit-detail">{{ log.detail }}</div>
          <div v-if="log.reason" class="audit-reason">原因: {{ log.reason }}</div>
          <div v-if="log.old_value || log.new_value" style="margin-top:4px;font-size:11px;color:#999">
            <span v-if="log.old_value">变更前: {{ log.old_value }}</span>
            <span v-if="log.old_value && log.new_value"> → </span>
            <span v-if="log.new_value">变更后: {{ log.new_value }}</span>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">暂无审计记录</div>
    </div>

    <div v-if="showReturnDialog" class="dialog-overlay" @click.self="showReturnDialog = false">
      <div class="dialog-box">
        <h3>退回护理单</h3>
        <div class="form-group">
          <label>退回原因 *</label>
          <textarea v-model="returnReason" rows="3" placeholder="请详细说明退回原因..."></textarea>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-outline" @click="showReturnDialog = false">取消</button>
          <button class="btn btn-danger" @click="handleReturn">确认退回</button>
        </div>
      </div>
    </div>

    <div v-if="showRejectDialog" class="dialog-overlay" @click.self="showRejectDialog = false">
      <div class="dialog-box">
        <h3>驳回附件</h3>
        <div class="form-group">
          <label>驳回原因 *</label>
          <textarea v-model="rejectReason" rows="3" placeholder="请详细说明驳回原因..."></textarea>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-outline" @click="showRejectDialog = false">取消</button>
          <button class="btn btn-danger" @click="confirmReject">确认驳回</button>
        </div>
      </div>
    </div>

    <div v-if="showSupplementDialog" class="dialog-overlay" @click.self="showSupplementDialog = false">
      <div class="dialog-box">
        <h3>标记附件为补传</h3>
        <div class="form-group">
          <label>补传原因 *</label>
          <textarea v-model="supplementReason" rows="3" placeholder="请说明补传原因..."></textarea>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-outline" @click="showSupplementDialog = false">取消</button>
          <button class="btn btn-warning" @click="confirmSupplement">确认补传</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.att-list { display: flex; flex-direction: column; gap: 8px; }
.att-item {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 12px; border: 1px solid #eee; border-radius: 6px; transition: all 0.2s;
}
.att-item:hover { border-color: #ddd; background: #fafbfc; }
.att-item.att-rejected { border-color: #f9d0ce; background: #fef7f7; }
.att-main { flex: 1; }
.att-name { font-weight: 500; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.att-meta { font-size: 12px; color: #999; margin-top: 4px; }
.att-reject-reason { font-size: 12px; color: #c5221f; margin-top: 4px; padding: 4px 8px; background: #fce8e6; border-radius: 4px; }
.att-supplement-reason { font-size: 12px; color: #137333; margin-top: 4px; padding: 4px 8px; background: #e6f4ea; border-radius: 4px; }
.att-actions { display: flex; gap: 4px; flex-shrink: 0; margin-left: 12px; }

.dialog-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;
  z-index: 200;
}
.dialog-box {
  background: white; border-radius: 12px; padding: 24px; width: 480px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}
.dialog-box h3 { margin-bottom: 16px; color: #1a237e; }
</style>
