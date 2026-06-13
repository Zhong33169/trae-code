<template>
  <div class="page" v-if="order">
    <div class="flex-between mb-4">
      <div class="flex gap-2" style="align-items: center;">
        <button class="btn btn-sm" @click="router.back()">← 返回列表</button>
        <h2 class="card-title" style="margin: 0;">会员入会单详情</h2>
      </div>
      <div class="flex gap-2">
        <span
          class="badge"
          :class="statusBadgeClass(order.status)"
          style="font-size: 14px; padding: 4px 14px;"
        >{{ STATUS_LABELS[order.status] }}</span>
        <span v-if="order.is_overdue" class="badge badge-red" style="font-size: 14px; padding: 4px 14px;">超时</span>
      </div>
    </div>

    <div v-if="order.reject_reason" class="alert alert-warning">
      <strong>退回原因：</strong>{{ order.reject_reason }}
    </div>
    <div v-if="order.is_overdue" class="alert alert-danger">
      <strong>超时提醒：</strong>该入会单补正材料已超时，请尽快联系会员处理或作其他处理。
    </div>

    <div v-if="latestAuditLog" class="card latest-action-card">
      <div class="flex-between" style="align-items: flex-start;">
        <div>
          <div class="card-title" style="margin-bottom: 8px;">🕐 最近处理结果</div>
          <div class="latest-action-info">
            <span class="badge" :class="latestLogBadgeClass">{{ actionLabel(latestAuditLog.action) }}</span>
            <span class="text-muted text-sm" style="margin-left: 12px;">
              审计编号：<span class="font-bold" style="color: #374151;">#{{ latestAuditLog.id }}</span>
            </span>
            <span class="text-muted text-sm" style="margin-left: 12px;">
              {{ formatDate(latestAuditLog.created_at) }}
            </span>
          </div>
          <div class="latest-action-detail">
            <span class="font-bold">{{ latestAuditLog.operator_name || '未知操作人' }}</span>
            <span v-if="latestAuditLog.operator_role" class="role-tag" :class="roleTagClass(latestAuditLog.operator_role)">
              {{ ROLE_LABELS[latestAuditLog.operator_role] || latestAuditLog.operator_role }}
            </span>
            <span v-if="latestAuditLog.from_status && latestAuditLog.to_status" class="text-muted text-sm" style="margin-left: 8px;">
              · {{ STATUS_LABELS[latestAuditLog.from_status] }} →
              <span class="font-bold">{{ STATUS_LABELS[latestAuditLog.to_status] }}</span>
            </span>
          </div>
          <div v-if="latestAuditLog.remark" class="latest-action-remark">
            {{ latestAuditLog.remark }}
          </div>
          <div v-if="latestAuditLog.failure_reason" class="latest-action-failure">
            <strong>失败/退回原因：</strong>{{ latestAuditLog.failure_reason }}
          </div>
        </div>
        <div style="text-align: right;">
          <div class="text-muted text-sm">合同确认</div>
          <span v-if="order.contract_confirmed" class="badge badge-green">已确认</span>
          <span v-else class="badge badge-gray">未确认</span>
          <div style="margin-top: 8px;" class="text-muted text-sm">卡权益</div>
          <span v-if="order.card_activated" class="badge badge-green">已启用</span>
          <span v-else class="badge badge-gray">未启用</span>
        </div>
      </div>
    </div>

    <div class="grid-4">
      <div class="card">
        <div class="card-title">📋 基本信息</div>
        <div class="form-group">
          <div class="text-muted text-sm">入会单号</div>
          <div class="font-bold text-lg">{{ order.order_no }}</div>
        </div>
        <div class="form-group">
          <div class="text-muted text-sm">会员姓名</div>
          <div class="font-bold">{{ order.member_name }}</div>
        </div>
        <div class="form-group">
          <div class="text-muted text-sm">手机号</div>
          <div>{{ order.member_phone || '-' }}</div>
        </div>
        <div class="form-group">
          <div class="text-muted text-sm">身份证号</div>
          <div>{{ order.member_id_no || '-' }}</div>
        </div>
        <div class="form-group">
          <div class="text-muted text-sm">创建时间</div>
          <div>{{ formatDate(order.created_at) }}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">💳 会籍信息</div>
        <div class="form-group">
          <div class="text-muted text-sm">会员类型</div>
          <div class="font-bold">{{ order.membership_type }}</div>
        </div>
        <div class="form-group">
          <div class="text-muted text-sm">会员时长</div>
          <div>{{ order.membership_duration }} 天</div>
        </div>
        <div class="form-group">
          <div class="text-muted text-sm">费用金额</div>
          <div class="font-bold text-lg" style="color: #dc2626;">¥ {{ order.amount }}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📝 合同确认</div>
        <div style="text-align: center; padding: 16px 0;">
          <div
            style="width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; font-size: 28px;"
            :style="order.contract_confirmed ? 'background: #d1fae5; color: #059669;' : 'background: #fee2e2; color: #dc2626;'"
          >
            {{ order.contract_confirmed ? '✓' : '✗' }}
          </div>
          <div class="font-bold" :class="order.contract_confirmed ? 'text-success' : 'text-danger'">
            {{ order.contract_confirmed ? '合同已确认签署' : '合同未确认' }}
          </div>
          <div class="text-muted text-sm mt-4" style="margin-top: 8px;">
            由审核主管在办理审核通过时确认
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🏋️ 卡权益启用</div>
        <div style="text-align: center; padding: 16px 0;">
          <div
            style="width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; font-size: 28px;"
            :style="order.card_activated ? 'background: #d1fae5; color: #059669;' : 'background: #fee2e2; color: #dc2626;'"
          >
            {{ order.card_activated ? '✓' : '✗' }}
          </div>
          <div class="font-bold" :class="order.card_activated ? 'text-success' : 'text-danger'">
            {{ order.card_activated ? '卡权益已启用' : '卡权益未启用' }}
          </div>
          <div class="text-muted text-sm" style="margin-top: 8px;">
            由复核负责人在归档时启用
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex-between">
        <div class="card-title" style="margin-bottom: 0;">
          📎 附件材料
          <span class="tag ml-4">
            已提供 {{ providedCount }} / {{ order.required_attachments.length }}
          </span>
          <span v-if="providedCount < order.required_attachments.length" class="tag" style="background: #fef2f2; color: #991b1b;">
            附件不齐全
          </span>
        </div>
        <div>
          <button
            v-if="canUpload"
            class="btn btn-primary btn-sm"
            @click="showUploadModal = true"
          >+ 上传附件</button>
        </div>
      </div>

      <div class="divider"></div>

      <div class="grid-2">
        <div
          v-for="req in order.required_attachments"
          :key="req.id"
          class="required-attachment"
          :class="reqClass(req)"
        >
          <div class="flex-between">
            <div class="flex gap-2" style="align-items: center;">
              <span style="font-size: 18px;">
                {{ attachmentIcon(req.attachment_type) }}
              </span>
              <div>
                <div class="font-bold">{{ req.attachment_name }}</div>
                <div class="text-sm text-muted">
                  类型：{{ ATTACHMENT_LABELS[req.attachment_type] }}
                </div>
              </div>
            </div>
            <div>
              <span
                v-if="req.is_provided"
                class="badge badge-green"
              >已提供</span>
              <span
                v-else-if="req.reject_reason"
                class="badge badge-orange"
              >被退回</span>
              <span v-else class="badge badge-red">缺失</span>
            </div>
          </div>

          <div v-if="req.missing_reason" class="mt-4" style="margin-top: 8px;">
            <div class="text-sm text-warning" style="font-weight: 500;">缺失说明：</div>
            <div class="text-sm">{{ req.missing_reason }}</div>
          </div>
          <div v-if="req.reject_reason" class="mt-4 reject-history" style="margin-top: 8px;">
            <div class="text-sm text-danger" style="font-weight: 500; margin-bottom: 4px;">
              退回历史（共 {{ formatRejectReasonLines(req.reject_reason).length }} 条）
            </div>
            <div class="reject-history-list">
              <div
                v-for="(line, idx) in formatRejectReasonLines(req.reject_reason)"
                :key="idx"
                class="reject-history-item"
              >
                <span class="reject-dot"></span>
                <span class="text-sm">{{ line }}</span>
              </div>
            </div>
          </div>

          <div v-if="findAttachmentByReq(req.id)" class="attachment-item" style="margin-top: 10px;">
            <div class="attachment-icon">{{ attachmentIcon(req.attachment_type) }}</div>
            <div class="attachment-info">
              <div class="attachment-name">{{ findAttachmentByReq(req.id)!.file_name }}</div>
              <div class="attachment-meta">
                上传于 {{ formatDate(findAttachmentByReq(req.id)!.uploaded_at) }}
                <span v-if="findAttachmentByReq(req.id)!.file_size">
                  · {{ formatSize(findAttachmentByReq(req.id)!.file_size!) }}
                </span>
              </div>
            </div>
            <button
              v-if="canUpload"
              class="btn btn-sm btn-danger"
              @click="handleDeleteAttachment(findAttachmentByReq(req.id)!.id)"
            >删除</button>
          </div>

          <div
            v-if="!req.is_provided && canUpload"
            class="mt-4"
            style="margin-top: 10px;"
          >
            <button
              class="btn btn-sm btn-primary"
              @click="openUploadFor(req)"
            >补正上传</button>
          </div>
        </div>
      </div>

      <div v-if="!order.required_attachments.length" class="empty">
        暂无附件要求
      </div>
    </div>

    <div class="card">
      <div class="card-title">⚙️ 业务处理</div>

      <div class="alert alert-info" v-if="!hasAnyAction">
        当前角色（{{ ROLE_LABELS[auth.state.user!.role] }}）在该单据状态下没有可执行的操作。
        请切换角色或选择其他入会单。
      </div>

      <div v-if="actionError" class="alert alert-danger">{{ actionError }}</div>

      <div class="grid-2" style="gap: 20px;">
        <div v-if="canSubmit">
          <div class="font-bold mb-4" style="margin-bottom: 8px;">登记员操作：提交审核</div>
          <div class="form-group">
            <label class="form-label">提交备注（可选）</label>
            <textarea v-model="submitRemark" class="form-textarea" placeholder="请输入提交备注，如：材料已齐全，请审核"></textarea>
          </div>
          <div v-if="providedCount < order.required_attachments.length && order.status === 'materials_missing'" class="alert alert-warning">
            请先补齐所有缺失附件后再提交。
          </div>
          <button
            class="btn btn-primary"
            :disabled="actionLoading || (providedCount < order.required_attachments.length && order.status === 'materials_missing')"
            @click="handleSubmit"
          >
            {{ order.status === 'materials_missing' ? '补正后重新提交审核' : '提交入会单进入审核' }}
          </button>
        </div>

        <div v-if="canApprove">
          <div class="font-bold mb-4" style="margin-bottom: 8px;">审核主管操作：办理通过</div>
          <div class="form-group">
            <label class="form-label">审核备注（可选）</label>
            <textarea v-model="approveRemark" class="form-textarea" placeholder="请输入审核备注"></textarea>
          </div>
          <div class="alert alert-success" style="margin-bottom: 8px;">
            通过后将自动确认合同，流转至复核负责人进行复核归档。
          </div>
          <button
            class="btn btn-success"
            :disabled="actionLoading"
            @click="handleApprove"
          >✓ 审核通过并确认合同</button>
        </div>

        <div v-if="canRequestSupplement">
          <div class="font-bold mb-4" style="margin-bottom: 8px;">审核主管操作：退回补正</div>
          <div class="form-group">
            <label class="form-label">选择需补正的附件并填写原因</label>
            <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px;">
              <div
                v-for="req in order.required_attachments"
                :key="req.id"
                class="supplement-item"
                :class="{ active: isSupplementSelected(req.id) }"
              >
                <div class="flex gap-2" style="align-items: flex-start; padding: 4px 0;">
                  <input
                    type="checkbox"
                    :value="req.id"
                    v-model="supplementIds"
                    style="margin-top: 4px;"
                  />
                  <div style="flex: 1;">
                    <div class="flex-between" style="align-items: center;">
                      <span class="font-bold">{{ req.attachment_name }}</span>
                      <span v-if="!req.is_provided" class="badge badge-red">已缺失</span>
                      <span v-else class="badge badge-green">已提供</span>
                    </div>
                    <div v-if="req.reject_reason" class="text-sm text-muted" style="margin-top: 4px;">
                      历史退回：{{ firstLineOfReason(req.reject_reason) }}
                    </div>
                    <div v-if="isSupplementSelected(req.id)" style="margin-top: 8px;">
                      <textarea
                        v-model="supplementReasons[req.id]"
                        class="form-textarea"
                        :placeholder="`请填写【${req.attachment_name}】的退回原因`"
                        rows="2"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">整体备注（可选）</label>
            <textarea v-model="supplementRemark" class="form-textarea" placeholder="请填写整体退回说明或补正要求"></textarea>
          </div>
          <div class="alert alert-warning" style="margin-bottom: 8px;">
            退回后登记员需补齐附件才能重新提交进入审核队列。每附件的退回原因将累加至历史记录，永久保留。
          </div>
          <button
            class="btn btn-warning"
            :disabled="actionLoading || !supplementIds.length"
            @click="handleRequestSupplement"
          >⚠ 退回补正</button>
        </div>

        <div v-if="canReject">
          <div class="font-bold mb-4" style="margin-bottom: 8px;">审核主管操作：驳回申请</div>
          <div class="form-group">
            <label class="form-label">驳回原因 <span class="text-danger">*</span></label>
            <textarea v-model="rejectReason" class="form-textarea" placeholder="请详细说明驳回原因，将进入审计日志"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">备注（可选）</label>
            <textarea v-model="rejectRemark" class="form-textarea"></textarea>
          </div>
          <div class="alert alert-danger" style="margin-bottom: 8px;">
            驳回后入会单将标记为"已驳回"状态，不可再处理。驳回原因会永久保留在审计日志中。
          </div>
          <button
            class="btn btn-danger"
            :disabled="actionLoading || !rejectReason.trim()"
            @click="handleReject"
          >✗ 驳回入会申请</button>
        </div>

        <div v-if="canReview">
          <div class="font-bold mb-4" style="margin-bottom: 8px;">复核负责人操作：复核</div>
          <div class="form-group">
            <label class="form-label">复核备注（可选）</label>
            <textarea v-model="reviewRemark" class="form-textarea" placeholder="请输入复核意见"></textarea>
          </div>
          <div class="alert alert-info" style="margin-bottom: 8px;">
            复核通过后可进行归档操作，并启用会员卡权益。
          </div>
          <button
            class="btn btn-primary"
            :disabled="actionLoading"
            @click="handleReview"
          >✓ 复核通过</button>
        </div>

        <div v-if="canArchive">
          <div class="font-bold mb-4" style="margin-bottom: 8px;">复核负责人操作：归档</div>
          <div class="form-group">
            <label class="form-label">归档备注（可选）</label>
            <textarea v-model="archiveRemark" class="form-textarea" placeholder="请输入归档备注"></textarea>
          </div>
          <div class="alert alert-success" style="margin-bottom: 8px;">
            归档将自动启用会员卡权益，入会单流程完成。
          </div>
          <button
            class="btn btn-success"
            :disabled="actionLoading"
            @click="handleArchive"
          >📦 归档并启用卡权益</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        📜 审计日志
        <span class="tag ml-4">共 {{ order.audit_logs.length }} 条记录</span>
      </div>
      <div class="timeline">
        <div
          v-for="log in sortedAuditLogs"
          :key="log.id"
          class="timeline-item"
          :class="[
            log.failure_reason ? 'failure' : '',
            (log.action === 'approve' || log.action === 'review' || log.action === 'archive') ? 'success' : ''
          ]"
        >
          <div class="timeline-time">{{ formatDate(log.created_at) }}</div>
          <div class="timeline-title">
            <span class="font-bold">{{ log.operator_name || '未知操作人' }}</span>
            <span v-if="log.operator_role" class="role-tag" :class="roleTagClass(log.operator_role)">
              {{ ROLE_LABELS[log.operator_role] || log.operator_role }}
            </span>
            <span class="text-muted text-sm"> · {{ actionLabel(log.action) }}</span>
            <span v-if="log.from_status && log.to_status" class="text-muted text-sm">
              · {{ STATUS_LABELS[log.from_status] }} → <span class="font-bold">{{ STATUS_LABELS[log.to_status] }}</span>
            </span>
          </div>
          <div v-if="log.remark" class="timeline-desc">备注：{{ log.remark }}</div>
          <div v-if="log.failure_reason" class="timeline-failure">
            <strong>失败/退回原因：</strong>{{ log.failure_reason }}
          </div>
        </div>
      </div>
      <div v-if="!order.audit_logs.length" class="empty">
        暂无审计记录
      </div>
    </div>

    <div v-if="showUploadModal" class="modal-mask" @click.self="showUploadModal = false">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">
            {{ prefillReq ? `补正上传：${prefillReq.attachment_name}` : '上传附件' }}
          </div>
          <button class="modal-close" @click="closeUploadModal">×</button>
        </div>
        <div>
          <div class="form-group">
            <label class="form-label">附件类型</label>
            <select v-model="uploadForm.file_type" class="form-select" :disabled="!!prefillReq">
              <option v-for="(label, key) in ATTACHMENT_LABELS" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">对应必需附件项</label>
            <select v-model="uploadForm.required_attachment_id" class="form-select" :disabled="!!prefillReq">
              <option :value="null">不绑定（作为补充材料）</option>
              <option
                v-for="req in order.required_attachments"
                :key="req.id"
                :value="req.id"
              >
                {{ req.attachment_name }}
                {{ req.is_provided ? '(已提供)' : '(缺失)' }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">文件名称</label>
            <input v-model="uploadForm.file_name" class="form-input" placeholder="如：张三_身份证.pdf" />
          </div>
          <div class="form-group">
            <label class="form-label">模拟上传文件</label>
            <div style="padding: 12px; border: 2px dashed #d1d5db; border-radius: 6px; text-align: center; color: #6b7280;">
              <div style="font-size: 28px; margin-bottom: 4px;">📄</div>
              <div>演示环境：点击下方按钮模拟上传成功</div>
              <div class="text-sm" style="margin-top: 4px;">（真实环境会在这里处理文件上传）</div>
            </div>
          </div>
          <div v-if="uploadError" class="alert alert-danger">{{ uploadError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="closeUploadModal">取消</button>
          <button class="btn btn-primary" :disabled="uploadLoading" @click="handleUpload">
            {{ uploadLoading ? '上传中...' : '确认上传' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="page">
    <div class="card">
      <div class="empty">
        {{ loading ? '加载中...' : '入会单不存在' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import type { MembershipOrder, RequiredAttachment, OrderStatus, AttachmentType } from '~/types'
import { STATUS_LABELS, ROLE_LABELS, ATTACHMENT_LABELS } from '~/types'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const orders = useOrders()

const order = ref<MembershipOrder | null>(null)
const loading = ref(false)

const showUploadModal = ref(false)
const prefillReq = ref<RequiredAttachment | null>(null)
const uploadLoading = ref(false)
const uploadError = ref('')
const uploadForm = reactive({
  file_type: 'id_card' as AttachmentType,
  required_attachment_id: null as number | null,
  file_name: ''
})

const actionLoading = ref(false)
const actionError = ref('')
const submitRemark = ref('')
const approveRemark = ref('')
const supplementIds = ref<number[]>([])
const supplementReasons = reactive<Record<number, string>>({})
const supplementRemark = ref('')
const rejectReason = ref('')
const rejectRemark = ref('')
const reviewRemark = ref('')
const archiveRemark = ref('')

const providedCount = computed(() => {
  if (!order.value) return 0
  return order.value.required_attachments.filter(r => r.is_provided).length
})

const sortedAuditLogs = computed(() => {
  if (!order.value) return []
  return [...order.value.audit_logs].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
})

const latestAuditLog = computed(() => {
  if (!sortedAuditLogs.value.length) return null
  return sortedAuditLogs.value[0]
})

const latestLogBadgeClass = computed(() => {
  if (!latestAuditLog.value) return 'badge-gray'
  const action = latestAuditLog.value.action
  if (['approve', 'review', 'archive', 'activate_card', 'confirm_contract'].includes(action)) {
    return 'badge-green'
  }
  if (['request_supplement', 'reject', 'mark_overdue'].includes(action)) {
    return 'badge-red'
  }
  if (['submit', 'resubmit', 'upload_attachment', 'create'].includes(action)) {
    return 'badge-blue'
  }
  return 'badge-gray'
})

const canSubmit = computed(() => {
  if (!auth.isRegistrar.value || !order.value) return false
  return ['draft', 'materials_missing'].includes(order.value.status)
})

const canApprove = computed(() => {
  if (!auth.isSupervisor.value || !order.value) return false
  return ['pending_review', 'resubmitted'].includes(order.value.status)
})

const canRequestSupplement = computed(() => {
  if (!auth.isSupervisor.value || !order.value) return false
  return ['pending_review', 'resubmitted'].includes(order.value.status)
})

const canReject = computed(() => {
  if (!auth.isSupervisor.value || !order.value) return false
  return ['pending_review', 'resubmitted'].includes(order.value.status)
})

const canReview = computed(() => {
  if (!auth.isReviewer.value || !order.value) return false
  return order.value.status === 'approved_review'
})

const canArchive = computed(() => {
  if (!auth.isReviewer.value || !order.value) return false
  return order.value.status === 'reviewed'
})

const canUpload = computed(() => {
  if (!auth.isRegistrar.value || !order.value) return false
  return ['draft', 'materials_missing'].includes(order.value.status)
})

const hasAnyAction = computed(() => {
  return canSubmit.value || canApprove.value || canRequestSupplement.value
    || canReject.value || canReview.value || canArchive.value || canUpload.value
})

function formatDate(s: string) {
  if (!s) return ''
  const d = new Date(s)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
  return Math.round(bytes / 1024 / 1024 * 10) / 10 + ' MB'
}

function attachmentIcon(type: AttachmentType) {
  const map: Record<AttachmentType, string> = {
    id_card: '🪪',
    photo: '🖼️',
    health_cert: '🏥',
    contract: '📝',
    other: '📎'
  }
  return map[type] || '📄'
}

function statusBadgeClass(status: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    draft: 'badge-gray',
    pending_review: 'badge-yellow',
    materials_missing: 'badge-red',
    resubmitted: 'badge-purple',
    approved_review: 'badge-blue',
    rejected: 'badge-red',
    reviewed: 'badge-green',
    archived: 'badge-gray'
  }
  return map[status] || 'badge-gray'
}

function roleTagClass(role: string) {
  const map: Record<string, string> = {
    registrar: 'role-tag-registrar',
    supervisor: 'role-tag-supervisor',
    reviewer: 'role-tag-reviewer'
  }
  return map[role] || ''
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    create: '创建入会单',
    submit: '提交审核',
    resubmit: '补正后重新提交',
    approve: '审核通过',
    reject: '驳回申请',
    request_supplement: '退回补正',
    upload_attachment: '上传附件',
    delete_attachment: '删除附件',
    confirm_contract: '确认合同',
    activate_card: '启用卡权益',
    archive: '归档完成',
    review: '复核通过',
    mark_overdue: '标记超时'
  }
  return map[action] || action
}

function reqClass(req: RequiredAttachment) {
  if (req.reject_reason) return 'rejected'
  if (req.is_provided) return 'provided'
  return 'missing'
}

function isSupplementSelected(reqId: number) {
  return supplementIds.value.includes(reqId)
}

function firstLineOfReason(reason: string | null) {
  if (!reason) return ''
  return reason.split('\n')[0]
}

function formatRejectReasonLines(reason: string | null): string[] {
  if (!reason) return []
  return reason.split('\n').filter(line => line.trim())
}

function findAttachmentByReq(reqId: number | null) {
  if (!reqId || !order.value) return null
  return order.value.attachments.find(a => a.required_attachment_id === reqId) || null
}

function openUploadFor(req: RequiredAttachment) {
  prefillReq.value = req
  uploadForm.file_type = req.attachment_type
  uploadForm.required_attachment_id = req.id
  uploadForm.file_name = `${order.value?.member_name || '会员'}_${req.attachment_name}`
  uploadError.value = ''
  showUploadModal.value = true
}

function closeUploadModal() {
  showUploadModal.value = false
  prefillReq.value = null
  uploadForm.file_type = 'id_card'
  uploadForm.required_attachment_id = null
  uploadForm.file_name = ''
  uploadError.value = ''
}

async function loadDetail() {
  loading.value = true
  try {
    const id = Number(route.params.id)
    order.value = await orders.fetchDetail(id)
  } finally {
    loading.value = false
  }
}

async function handleUpload() {
  if (!uploadForm.file_name.trim()) {
    uploadError.value = '请输入文件名称'
    return
  }
  uploadLoading.value = true
  uploadError.value = ''
  try {
    const res = await orders.uploadAttachment(order.value!.id, {
      required_attachment_id: uploadForm.required_attachment_id || undefined,
      file_type: uploadForm.file_type,
      file_name: uploadForm.file_name,
      file_size: 102400 + Math.floor(Math.random() * 300000),
      operator_id: auth.state.user?.id
    })
    order.value = res.order
    closeUploadModal()
  } catch (e: any) {
    uploadError.value = e?.data?.detail || '上传失败'
  } finally {
    uploadLoading.value = false
  }
}

async function handleDeleteAttachment(attachmentId: number) {
  if (!confirm('确定要删除该附件吗？删除后需要重新上传。')) return
  try {
    const res = await orders.deleteAttachment(order.value!.id, attachmentId, auth.state.user?.id)
    order.value = res.order
  } catch (e: any) {
    alert(e?.data?.detail || '删除失败')
  }
}

async function handleSubmit() {
  actionLoading.value = true
  actionError.value = ''
  try {
    const res = await orders.submitOrder(order.value!.id, submitRemark.value, auth.state.user?.id)
    order.value = res
    submitRemark.value = ''
  } catch (e: any) {
    actionError.value = e?.data?.detail || '提交失败'
  } finally {
    actionLoading.value = false
  }
}

async function handleApprove() {
  actionLoading.value = true
  actionError.value = ''
  try {
    const res = await orders.approveOrder(order.value!.id, approveRemark.value)
    order.value = res
    approveRemark.value = ''
  } catch (e: any) {
    actionError.value = e?.data?.detail || '审核失败'
  } finally {
    actionLoading.value = false
  }
}

async function handleRequestSupplement() {
  if (!supplementIds.value.length) {
    actionError.value = '请选择需要补正的附件项'
    return
  }
  const items = supplementIds.value.map(id => ({
    required_attachment_id: id,
    reject_reason: supplementReasons[id]?.trim() || undefined
  }))
  actionLoading.value = true
  actionError.value = ''
  try {
    const res = await orders.requestSupplement(
      order.value!.id,
      items,
      supplementRemark.value
    )
    order.value = res
    supplementIds.value = []
    Object.keys(supplementReasons).forEach(key => {
      supplementReasons[Number(key)] = ''
    })
    supplementRemark.value = ''
  } catch (e: any) {
    actionError.value = e?.data?.detail || '退回失败'
  } finally {
    actionLoading.value = false
  }
}

async function handleReject() {
  if (!rejectReason.value.trim()) {
    actionError.value = '请填写驳回原因'
    return
  }
  if (!confirm('确定要驳回该入会申请吗？驳回后不可恢复。')) return
  actionLoading.value = true
  actionError.value = ''
  try {
    const res = await orders.rejectOrder(
      order.value!.id,
      rejectReason.value,
      rejectRemark.value
    )
    order.value = res
    rejectReason.value = ''
    rejectRemark.value = ''
  } catch (e: any) {
    actionError.value = e?.data?.detail || '驳回失败'
  } finally {
    actionLoading.value = false
  }
}

async function handleReview() {
  actionLoading.value = true
  actionError.value = ''
  try {
    const res = await orders.reviewOrder(order.value!.id, reviewRemark.value)
    order.value = res
    reviewRemark.value = ''
  } catch (e: any) {
    actionError.value = e?.data?.detail || '复核失败'
  } finally {
    actionLoading.value = false
  }
}

async function handleArchive() {
  actionLoading.value = true
  actionError.value = ''
  try {
    const res = await orders.archiveOrder(order.value!.id, archiveRemark.value)
    order.value = res
    archiveRemark.value = ''
  } catch (e: any) {
    actionError.value = e?.data?.detail || '归档失败'
  } finally {
    actionLoading.value = false
  }
}

onMounted(() => {
  if (!auth.state.user) {
    router.push('/login')
    return
  }
  loadDetail()
})
</script>
