<template>
  <div class="page-container">
    <div class="page-header" style="display:flex; align-items:center; justify-content:space-between;">
      <div style="display:flex; align-items:center; gap:14px;">
        <el-button type="primary" text @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>返回列表
        </el-button>
        <div>
          <div style="font-size:20px; font-weight:bold;">
            {{ material?.case_no }} — {{ material?.case_name }}
          </div>
          <div style="margin-top:4px;">
            <el-tag :type="statusTagType(material?.status)" size="large">{{ statusLabel(material?.status) }}</el-tag>
            <el-tag v-if="material?.is_overdue" type="danger" size="large" effect="dark" style="margin-left:8px;">
              <el-icon><Clock /></el-icon>超期 {{ material?.overdue_hours }}h
            </el-tag>
            <el-tag :type="priorityType(material?.priority)" size="large" style="margin-left:8px;">
              {{ priorityLabel(material?.priority) }}优先级
            </el-tag>
            <span style="color:#909399; margin-left:12px; font-size:13px;">
              类型：{{ caseTypeLabel(material?.case_type) }} · 管辖：{{ material?.court_name || '-' }}
            </span>
          </div>
        </div>
      </div>
      <div>
        <template v-if="(material?.status === 'registered' || material?.status === 'returned') && userStore.can('review')">
          <el-button type="primary" size="large" @click="takeReview">
            <el-icon><EditPen /></el-icon>领取审核（审核主管）
          </el-button>
        </template>
        <template v-if="material?.status === 'review_passed' && userStore.can('verify')">
          <el-button type="success" size="large" @click="takeVerify">
            <el-icon><DocumentChecked /></el-icon>领取复核（复核负责人）
          </el-button>
        </template>
        <template v-if="material?.status === 'reviewing' && userStore.can('review')">
          <el-button type="success" size="large" @click="openReview(true)">
            <el-icon><CircleCheck /></el-icon>审核通过
          </el-button>
          <el-button type="danger" size="large" style="margin-left:8px;" @click="openReview(false)">
            <el-icon><RefreshLeft /></el-icon>退回补正
          </el-button>
        </template>
        <template v-if="material?.status === 'verifying' && userStore.can('verify')">
          <el-button type="success" size="large" @click="openVerify(true)">
            <el-icon><CircleCheck /></el-icon>复核通过
          </el-button>
          <el-button type="success" plain size="large" style="margin-left:8px;" @click="openVerify(true, true)">
            <el-icon><FolderChecked /></el-icon>通过并归档
          </el-button>
          <el-button type="danger" size="large" style="margin-left:8px;" @click="openVerify(false)">
            <el-icon><RefreshLeft /></el-icon>复核不通过
          </el-button>
        </template>
        <template v-if="material?.status === 'verified' && userStore.can('archive')">
          <el-button type="info" size="large" @click="archive">
            <el-icon><FolderChecked /></el-icon>完成归档
          </el-button>
        </template>
        <template v-if="material?.status === 'returned' && userStore.can('register')">
          <el-button type="warning" size="large" @click="resubmit">
            <el-icon><Promotion /></el-icon>补齐附件后重新提交
          </el-button>
        </template>
      </div>
    </div>

    <el-alert v-if="material?.reject_reason" :title="'退回原因：' + material.reject_reason" type="error"
              show-icon style="margin:0 24px 16px;" :closable="false" />
    <el-alert v-if="material?.audit_remark && material?.status !== 'returned'"
              :title="'审计/备注：' + material.audit_remark" type="info"
              show-icon style="margin:0 24px 16px;" :closable="false" />

    <el-row :gutter="16" style="padding:0 24px;">
      <el-col :span="16">
        <el-card shadow="never" style="margin-bottom:16px;">
          <template #header><b>一、案件基础信息</b></template>
          <el-descriptions :column="2" border size="default">
            <el-descriptions-item label="案号">{{ material?.case_no }}</el-descriptions-item>
            <el-descriptions-item label="案件名称">{{ material?.case_name }}</el-descriptions-item>
            <el-descriptions-item label="原告">{{ material?.plaintiff || '-' }}</el-descriptions-item>
            <el-descriptions-item label="被告">{{ material?.defendant || '-' }}</el-descriptions-item>
            <el-descriptions-item label="管辖法院/机构">{{ material?.court_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="案件类型">{{ caseTypeLabel(material?.case_type) }}</el-descriptions-item>
            <el-descriptions-item label="优先级">{{ priorityLabel(material?.priority) }}</el-descriptions-item>
            <el-descriptions-item label="截止时间">
              <span :style="{ color: material?.is_overdue ? '#f56c6c' : '' }">
                {{ formatTime(material?.deadline) }}
              </span>
              <span v-if="material?.is_overdue" style="color:#f56c6c; margin-left:8px;">
                （已超期 {{ material?.overdue_hours }} 小时）
              </span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never" style="margin-bottom:16px;">
          <template #header>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <b>二、诉讼材料附件管理</b>
              <div>
                <el-tag type="success" size="small" style="margin-right:8px;">
                  必填满足：{{ requiredSatisfied }}/{{ requiredTotal }}
                </el-tag>
                <el-tag type="danger" size="small" style="margin-right:8px;" v-if="rejectedWithoutReplacement.length > 0">
                  缺替代件：{{ rejectedWithoutReplacement.length }}
                </el-tag>
                <el-tag type="warning" size="small" style="margin-right:16px;" v-if="rejectedWithReplacement.length > 0">
                  已补正（驳回原件保留）：{{ rejectedWithReplacement.length }}
                </el-tag>
                <el-button size="small" type="primary"
                           :disabled="!canAddAttachment" @click="openAddAttachment">
                  <el-icon><Plus /></el-icon>添加附件
                </el-button>
              </div>
            </div>
          </template>

          <el-alert v-if="!attachmentReady && material?.status !== 'archived'"
                    type="warning" show-icon :closable="false" style="margin-bottom:12px;">
            <template #title>
              <div>
                <b>附件未齐备</b>（必填 {{ requiredTotal }} 项，已满足 {{ requiredSatisfied }} 项）
                <div v-if="rejectedWithoutReplacement.length > 0" style="margin-top:6px;">
                  <span style="color:#c0392b;">仍缺替代件的被驳回附件：</span>
                  <span v-for="(item, i) in rejectedWithoutReplacement" :key="item.id">
                    <b>{{ item.file_name }}</b>
                    <span style="color:#909399; font-size:12px;">（{{ item.reject_reason }}）</span>
                    <span v-if="i < rejectedWithoutReplacement.length - 1">；</span>
                  </span>
                </div>
                <div style="margin-top:4px; color:#606266; font-size:12px;">
                  补齐方式：添加新的有效附件作为替代件，被驳回原件保留用于审计追溯。满足所有必填项后可重新提交。
                </div>
              </div>
            </template>
          </el-alert>

          <el-alert v-if="attachmentReady && rejectedWithReplacement.length > 0 && material?.status !== 'archived'"
                    type="success" show-icon :closable="false" style="margin-bottom:12px;">
            <template #title>
              <div>
                <b>附件已齐备</b>（必填 {{ requiredTotal }} 项均已满足）
                <span style="color:#67c23a;"> — 可重新提交 / 通过审核 / 批量处理</span>
                <div style="margin-top:4px; font-size:12px; color:#606266;">
                  其中 {{ rejectedWithReplacement.length }} 项被驳回原件已由有效替代件满足，原件保留用于审计追溯。
                </div>
              </div>
            </template>
          </el-alert>

          <div v-for="group in attachmentGroups" :key="group.key" style="margin-bottom:12px;">
            <div style="font-size:13px; font-weight:bold; margin-bottom:6px; padding:4px 8px; background:#f5f7fa; border-radius:4px;">
              <el-icon style="vertical-align:-2px;"><Paperclip /></el-icon>
              {{ group.label }}
              <el-tag v-if="group.items.length > 0" size="small" style="margin-left:6px;">{{ group.items.length }}</el-tag>
            </div>
            <el-table :data="group.items" border stripe size="small">
              <el-table-column label="文件名" min-width="220">
                <template #default="{ row }">
                  <span>{{ row.file_name }}</span>
                  <el-tag v-if="row.is_required" type="danger" size="small" effect="plain" style="margin-left:6px;">必填</el-tag>
                  <el-tag v-else type="info" size="small" effect="plain" style="margin-left:6px;">可选</el-tag>
                  <el-tag v-if="row.replaces_attachment_id" type="warning" size="small" effect="plain" style="margin-left:6px;">
                    替代「{{ row.replaces_file_name || row.replaces_attachment_id }}」
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="大小" width="90">
                <template #default="{ row }">{{ formatSize(row.file_size) }}</template>
              </el-table-column>
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <el-tag :type="row.status === 'valid' ? 'success' : 'danger'" size="small">
                    {{ row.status === 'valid' ? '有效' : '被驳回' }}
                  </el-tag>
                  <el-tag v-if="row.status === 'rejected' && hasReplacement(row)" type="success" size="small" effect="plain" style="margin-left:4px;">
                    已补正
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="上传/驳回信息" min-width="260">
                <template #default="{ row }">
                  <div style="font-size:12px;">
                    <div>
                      <span style="color:#909399;">上传：</span>
                      {{ row.uploaded_by_name || row.uploaded_by }}
                      {{ formatTime(row.uploaded_at) }}
                    </div>
                    <div v-if="row.status === 'rejected'" style="margin-top:4px; padding:4px 8px; background:#fef0f0; border:1px solid #fbc4c4; border-radius:3px;">
                      <el-tag type="danger" size="small">{{ row.rejected_by_name || row.rejected_by }}</el-tag>
                      <span style="color:#c0392b; margin-left:6px;">{{ row.reject_reason }}</span>
                      <div style="color:#909399; margin-top:2px;">{{ formatTime(row.rejected_at) }}</div>
                    </div>
                    <div v-if="hasReplacement(row)" style="margin-top:4px; padding:4px 8px; background:#f0f9eb; border:1px solid #c2e7b0; border-radius:3px;">
                      <el-icon style="color:#67c23a; vertical-align:-2px;"><CircleCheck /></el-icon>
                      <span style="color:#67c23a;">已由有效替代件满足：</span>
                      <span v-for="rp in getReplacements(row)" :key="rp.id" style="color:#606266;">
                        {{ rp.file_name }}（{{ rp.uploaded_by_name }} {{ formatTime(rp.uploaded_at) }}）
                      </span>
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="200" fixed="right">
                <template #default="{ row }">
                  <template v-if="row.status === 'rejected' && userStore.can('reject_attachment')">
                    <el-button size="small" type="success" plain @click="validateAttachment(row.id)">恢复有效</el-button>
                  </template>
                  <template v-if="row.status === 'rejected' && !hasReplacement(row) && canAddAttachment">
                    <el-button size="small" type="warning" plain @click="openAddReplacement(row)">上传替代件</el-button>
                  </template>
                  <template v-if="row.status === 'valid' && userStore.can('reject_attachment') && material?.status === 'reviewing'">
                    <el-button size="small" type="danger" plain @click="openRejectAtt(row)">驳回</el-button>
                  </template>
                  <template v-if="(material?.status === 'registered' || material?.status === 'returned') && row.status !== 'rejected' && !isReplacementOfRejected(row)">
                    <el-popconfirm title="确认删除该附件？" @confirm="deleteAttachment(row.id)">
                      <template #reference>
                        <el-button size="small" type="danger" plain>删除</el-button>
                      </template>
                    </el-popconfirm>
                  </template>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>

        <el-card shadow="never" style="margin-bottom:16px;">
          <template #header><b>三、处理流程 / 状态流转</b></template>
          <el-steps :active="stepIndex" direction="vertical" finish-status="success">
            <el-step title="登记发起" :description="stepDescription(0)">
              <template #icon><el-icon :size="18"><Edit /></el-icon></template>
            </el-step>
            <el-step title="审核主管办理" :description="stepDescription(1)">
              <template #icon><el-icon :size="18"><UserChecked /></el-icon></template>
            </el-step>
            <el-step title="复核负责人复核" :description="stepDescription(2)">
              <template #icon><el-icon :size="18"><Stamp /></el-icon></template>
            </el-step>
            <el-step title="归档完成" :description="stepDescription(3)">
              <template #icon><el-icon :size="18"><FolderChecked /></el-icon></template>
            </el-step>
          </el-steps>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never" style="margin-bottom:16px;">
          <template #header><b>状态流转历史</b></template>
          <el-timeline>
            <el-timeline-item
              v-for="log in material?.status_logs || []"
              :key="log.id"
              :timestamp="formatTime(log.created_at)"
              :type="logColor(log)"
              :hollow="false"
              size="default"
            >
              <div style="font-size:13px;">
                <div>
                  <b>{{ log.operator_name }}</b>
                  <el-tag size="small" style="margin-left:6px;">{{ actionLabel(log.action) }}</el-tag>
                </div>
                <div style="color:#606266; margin-top:2px; font-size:12px;">
                  {{ log.from_status ? statusLabel(log.from_status) : '（发起）' }}
                  → <b>{{ statusLabel(log.to_status) }}</b>
                </div>
                <div v-if="log.remark" style="margin-top:4px; padding:6px 8px; background:#f5f7fa; border-radius:4px; font-size:12px;">
                  <el-icon style="vertical-align:-2px;"><ChatDotRound /></el-icon>
                  {{ log.remark }}
                </div>
              </div>
            </el-timeline-item>
          </el-timeline>
        </el-card>

        <el-card shadow="never">
          <template #header><b>关键人员</b></template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="登记员">{{ material?.registered_by_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="审核主管">{{ material?.reviewed_by_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="复核负责人">{{ material?.verified_by_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="归档人">{{ material?.archived_by_name || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="reviewDialog" :title="reviewForm.pass ? '审核通过' : '退回补正（填写原因）'" width="560px">
      <el-form :model="reviewForm" label-width="100px">
        <el-form-item label="审计备注">
          <el-input v-model="reviewForm.audit_remark" type="textarea" :rows="2" placeholder="记录审核意见，会留在审计日志" />
        </el-form-item>
        <el-form-item label="退回原因" v-if="!reviewForm.pass">
          <el-input v-model="reviewForm.reject_reason" type="textarea" :rows="4"
                    placeholder="必填，说明要求补正的内容。例如：缺少工程结算对账单原件，见附件驳回。" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!reviewForm.pass && !reviewForm.reject_reason?.trim()" @click="confirmReview">
          确认提交
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="verifyDialog" :title="verifyTitle" width="560px">
      <el-form :model="verifyForm" label-width="100px">
        <el-form-item label="审计备注">
          <el-input v-model="verifyForm.audit_remark" type="textarea" :rows="2"
                    placeholder="记录复核/归档意见，将作为审计备注保存在材料单上" />
        </el-form-item>
        <el-form-item label="退回原因" v-if="!verifyForm.pass">
          <el-input v-model="verifyForm.reject_reason" type="textarea" :rows="4" placeholder="必填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="verifyDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!verifyForm.pass && !verifyForm.reject_reason?.trim()" @click="confirmVerify">
          确认提交
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="addAttDialog" :title="attForm.replaces_attachment_id ? '添加替代件附件' : '添加附件'" width="560px">
      <el-form :model="attForm" label-width="120px">
        <el-form-item label="文件名"><el-input v-model="attForm.file_name" placeholder="例：起诉状.pdf" /></el-form-item>
        <el-form-item label="类型"><el-input v-model="attForm.file_type" placeholder="例：application/pdf" /></el-form-item>
        <el-form-item label="大小(KB)"><el-input-number v-model="attForm.file_size" :min="1" :max="999999" /></el-form-item>
        <el-form-item label="是否必填"><el-switch v-model="attForm.is_required" /></el-form-item>
        <el-form-item label="替代被驳回附件">
          <el-select v-model="attForm.replaces_attachment_id" clearable placeholder="如为替代件请选择被驳回的原附件" style="width:100%;">
            <el-option v-for="a in rejectedAttachments" :key="a.id" :label="a.file_name + '（' + (a.reject_reason || '无原因') + '）'" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-alert v-if="attForm.replaces_attachment_id" type="success" :closable="false" show-icon style="margin-top:8px;">
          此附件将替代被驳回的「{{ getAttachmentName(attForm.replaces_attachment_id) }}」，提交后该必填项将被视为满足。被驳回原件保留用于审计追溯。
        </el-alert>
        <el-alert v-else type="info" :closable="false" show-icon style="margin-top:8px;">
          此处使用演示用的元数据登记（无真实文件上传），真实项目可替换为 OSS 上传。
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="addAttDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!attForm.file_name?.trim()" @click="confirmAddAtt">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rejectAttDialog" title="驳回附件" width="520px">
      <div style="margin-bottom:12px;">
        附件：<b>{{ rejectAttFile }}</b>
      </div>
      <el-form label-width="100px">
        <el-form-item label="驳回原因">
          <el-input v-model="rejectAttReason" type="textarea" :rows="4"
                    placeholder="必填，说明为什么驳回该附件（例如：仅提交复印件无原件、缺少银行盖章等）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectAttDialog = false">取消</el-button>
        <el-button type="danger" :disabled="!rejectAttReason?.trim()" @click="confirmRejectAtt">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'
import api from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const userStore = useUserStore()
const material = ref(null)

const reviewDialog = ref(false)
const reviewForm = reactive({ pass: true, reject_reason: '', audit_remark: '' })

const verifyDialog = ref(false)
const verifyForm = reactive({ pass: true, reject_reason: '', audit_remark: '', archive: false })

const addAttDialog = ref(false)
const attForm = reactive({ file_name: '', file_type: 'application/pdf', file_size: 1024, is_required: true, replaces_attachment_id: null })

const rejectAttDialog = ref(false)
const rejectAttId = ref('')
const rejectAttFile = ref('')
const rejectAttReason = ref('')

const id = computed(() => route.params.id)

const allAttachments = computed(() => material.value?.attachments || [])

const requiredTotal = computed(() =>
  allAttachments.value.filter((a) => a.is_required).length
)
const requiredSatisfied = computed(() =>
  allAttachments.value.filter((a) => a.is_required && (a.status === 'valid' || hasReplacement(a))).length
)
const rejectedWithReplacement = computed(() =>
  allAttachments.value.filter((a) => a.status === 'rejected' && a.is_required && hasReplacement(a))
)
const rejectedWithoutReplacement = computed(() =>
  allAttachments.value.filter((a) => a.status === 'rejected' && a.is_required && !hasReplacement(a))
)
const rejectedAttachments = computed(() =>
  allAttachments.value.filter((a) => a.status === 'rejected')
)
const attachmentReady = computed(() => requiredTotal.value === 0 || requiredSatisfied.value >= requiredTotal.value)

const attachmentGroups = computed(() => {
  const originals = allAttachments.value.filter((a) => !a.replaces_attachment_id)
  const replacements = allAttachments.value.filter((a) => a.replaces_attachment_id)
  const rejectedOriginals = originals.filter((a) => a.status === 'rejected')
  const validOriginals = originals.filter((a) => a.status === 'valid')
  return [
    { key: 'rejected', label: '被驳回原件（保留）', items: rejectedOriginals },
    { key: 'replacement', label: '替代件', items: replacements },
    { key: 'valid', label: '有效原件', items: validOriginals },
  ].filter((g) => g.items.length > 0)
})

function hasReplacement(att) {
  return allAttachments.value.some((a) => a.replaces_attachment_id === att.id && a.status === 'valid')
}
function getReplacements(att) {
  return allAttachments.value.filter((a) => a.replaces_attachment_id === att.id && a.status === 'valid')
}
function isReplacementOfRejected(att) {
  if (!att.replaces_attachment_id) return false
  const original = allAttachments.value.find((a) => a.id === att.replaces_attachment_id)
  return original && original.status === 'rejected'
}
function getAttachmentName(aid) {
  const a = allAttachments.value.find((x) => x.id === aid)
  return a ? a.file_name : aid
}

const canAddAttachment = computed(() =>
  userStore.can('manage_attachment') &&
  ['registered', 'returned', 'reviewing'].includes(material.value?.status)
)

const stepIndex = computed(() => {
  const s = material.value?.status
  if (['archived'].includes(s)) return 4
  if (['verifying', 'verified'].includes(s)) return 3
  if (['reviewing', 'review_passed', 'returned'].includes(s)) return 2
  return 1
})

function stepDescription(idx) {
  const m = material.value
  if (!m) return '-'
  const fmt = (name, time) => name ? `${name} · ${formatTime(time)}` : '待处理'
  switch (idx) {
    case 0: return fmt(m.registered_by_name, m.registered_at)
    case 1:
      if (m.status === 'returned') return `已退回 · ${fmt(m.reviewed_by_name, m.reviewed_at)}`
      return fmt(m.reviewed_by_name, m.reviewed_at)
    case 2: return fmt(m.verified_by_name, m.verified_at)
    case 3: return fmt(m.archived_by_name, m.archived_at)
  }
}

function logColor(log) {
  if (log.to_status === 'returned') return 'danger'
  if (log.to_status === 'archived') return 'success'
  if (log.to_status === 'verified' || log.to_status === 'review_passed') return 'success'
  return 'primary'
}

function statusLabel(s) {
  if (!s) return '-'
  return {
    registered: '待审核', reviewing: '审核中', review_passed: '待复核',
    returned: '退回补正', verifying: '复核中', verified: '待归档', archived: '已归档',
  }[s] || s
}
function statusTagType(s) {
  return {
    registered: 'warning', reviewing: 'primary', review_passed: 'success',
    returned: 'danger', verifying: 'warning', verified: 'success', archived: 'info',
  }[s] || 'info'
}
function priorityLabel(p) {
  return { urgent: '紧急', high: '高', normal: '普通', low: '低' }[p] || (p || '-')
}
function priorityType(p) {
  return { urgent: 'danger', high: 'warning', normal: 'info', low: 'success' }[p] || 'info'
}
function caseTypeLabel(t) {
  return {
    civil: '民事案件', commercial: '商事案件', labor: '劳动争议',
    ip: '知识产权', insurance: '保险纠纷', criminal: '刑事案件', admin: '行政案件',
  }[t] || (t || '-')
}
function actionLabel(a) {
  return {
    register: '登记发起', start_review: '领取审核', pass_review: '审核通过',
    return_material: '退回补正', resubmit: '补正重提', start_verify: '领取复核',
    pass_verify: '复核通过', reject_verify: '复核不通过', archive: '归档完成',
  }[a] || a
}
function formatTime(t) {
  if (!t) return '-'
  try {
    const d = new Date(t)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return t }
}
function formatSize(b) {
  b = Number(b) || 0
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1024 / 1024).toFixed(2) + ' MB'
}

async function load() {
  const res = await api.get(`/materials/${id.value}`)
  if (res.data.success) material.value = res.data.data
}

async function takeReview() {
  const res = await api.post(`/materials/${id.value}/take_review`, { operator_id: userStore.user.id })
  if (res.data.success) { ElMessage.success('已领取审核任务'); load() }
}
async function takeVerify() {
  const res = await api.post(`/materials/${id.value}/take_verify`, { operator_id: userStore.user.id })
  if (res.data.success) { ElMessage.success('已领取复核任务'); load() }
}
async function archive() {
  await ElMessageBox.confirm('归档后不可再修改，确认？', '归档确认', { type: 'warning' }).catch(() => {})
  const res = await api.post(`/materials/${id.value}/archive`, { operator_id: userStore.user.id })
  if (res.data.success) { ElMessage.success('已归档'); load() }
}
async function resubmit() {
  if (!attachmentReady.value) {
    const missing = rejectedWithoutReplacement.value.map((a) => a.file_name).join('、')
    ElMessage.error(`附件未齐备（必填 ${requiredTotal.value} 项，已满足 ${requiredSatisfied.value} 项），仍缺替代件：${missing}，请先补齐再提交`)
    return
  }
  const res = await api.post(`/materials/${id.value}/resubmit`, { operator_id: userStore.user.id })
  if (res.data.success) { ElMessage.success('已重新提交审核'); load() }
}

function openReview(pass) {
  reviewForm.pass = pass
  reviewForm.reject_reason = ''
  reviewForm.audit_remark = material.value?.audit_remark || ''
  reviewDialog.value = true
}
async function confirmReview() {
  if (!reviewForm.pass && !reviewForm.reject_reason?.trim()) return
  const res = await api.post(`/materials/${id.value}/review`, {
    operator_id: userStore.user.id,
    pass: reviewForm.pass,
    reject_reason: reviewForm.reject_reason || undefined,
    audit_remark: reviewForm.audit_remark || undefined,
  })
  if (res.data.success) {
    ElMessage.success(reviewForm.pass ? '审核通过' : '已退回补正')
    reviewDialog.value = false
    load()
  }
}

function openVerify(pass, withArchive = false) {
  verifyForm.pass = pass
  verifyForm.reject_reason = ''
  verifyForm.audit_remark = material.value?.audit_remark || ''
  verifyForm.archive = withArchive
  verifyDialog.value = true
}
const verifyTitle = computed(() => {
  if (verifyForm.pass && verifyForm.archive) return '复核通过并完成归档'
  if (verifyForm.pass) return '复核通过'
  return '复核不通过（退回）'
})
async function confirmVerify() {
  const res = await api.post(`/materials/${id.value}/verify`, {
    operator_id: userStore.user.id,
    pass: verifyForm.pass,
    reject_reason: verifyForm.reject_reason || undefined,
    audit_remark: verifyForm.audit_remark || undefined,
    archive: verifyForm.archive,
  })
  if (res.data.success) {
    ElMessage.success(verifyForm.pass ? (verifyForm.archive ? '复核通过并已归档' : '复核通过') : '已退回')
    verifyDialog.value = false
    load()
  }
}

function openAddAttachment() {
  attForm.file_name = ''
  attForm.file_type = 'application/pdf'
  attForm.file_size = 1024
  attForm.is_required = true
  attForm.replaces_attachment_id = null
  addAttDialog.value = true
}
function openAddReplacement(row) {
  attForm.file_name = ''
  attForm.file_type = 'application/pdf'
  attForm.file_size = 1024
  attForm.is_required = true
  attForm.replaces_attachment_id = row.id
  addAttDialog.value = true
}
async function confirmAddAtt() {
  const payload = {
    file_name: attForm.file_name,
    file_type: attForm.file_type,
    file_size: attForm.file_size * 1024,
    is_required: attForm.is_required,
    operator_id: userStore.user.id,
  }
  if (attForm.replaces_attachment_id) {
    payload.replaces_attachment_id = attForm.replaces_attachment_id
  }
  const res = await api.post(`/materials/${id.value}/attachments`, payload)
  if (res.data.success) {
    ElMessage.success(attForm.replaces_attachment_id ? '替代件附件已添加' : '附件已添加')
    addAttDialog.value = false
    load()
  }
}
async function deleteAttachment(aid) {
  const res = await api.delete(`/materials/${id.value}/attachments/${aid}?operator_id=${userStore.user.id}`)
  if (res.data.success) { ElMessage.success('已删除'); load() }
}
function openRejectAtt(row) {
  rejectAttId.value = row.id
  rejectAttFile.value = row.file_name
  rejectAttReason.value = ''
  rejectAttDialog.value = true
}
async function confirmRejectAtt() {
  const res = await api.post(`/materials/${id.value}/attachments/${rejectAttId.value}/reject`, {
    reject_reason: rejectAttReason.value,
    operator_id: userStore.user.id,
  })
  if (res.data.success) {
    ElMessage.success('已驳回该附件')
    rejectAttDialog.value = false
    load()
  }
}
async function validateAttachment(aid) {
  const res = await api.post(`/materials/${id.value}/attachments/${aid}/validate`, { operator_id: userStore.user.id })
  if (res.data.success) { ElMessage.success('已恢复为有效'); load() }
}

onMounted(load)
</script>
