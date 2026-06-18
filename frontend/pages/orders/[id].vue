<template>
  <div v-if="!order" class="text-center py-20 text-gray-400">
    <UButton variant="ghost" to="/">← 返回订单列表</UButton>
    <p class="mt-4">加载中或订单不存在...</p>
  </div>

  <div v-else class="space-y-4">
    <div class="flex items-center justify-between">
      <UButton variant="ghost" to="/">← 返回订单列表</UButton>
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-500">版本号: v{{ order.version }}</span>
        <span :class="['status-badge text-base px-4 py-1', StatusColorClass[order.status]]">
          {{ order.status_display }}
        </span>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <!-- 左：订单基本信息 -->
      <div class="col-span-2 space-y-4">
        <div class="bg-white rounded-lg border border-gray-200 p-5">
          <h2 class="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            📋 订单信息
            <span class="text-sm font-normal text-gray-400">{{ order.order_no }}</span>
            <UButton
              v-if="canEdit"
              size="xs"
              variant="ghost"
              color="blue"
              class="ml-auto"
              @click="editMode = !editMode"
            >
              {{ editMode ? '取消编辑' : '✏️ 编辑' }}
            </UButton>
          </h2>

          <div v-if="!editMode" class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <InfoRow label="客户名称" :value="order.customer_name" />
            <InfoRow label="目的国" :value="order.country" />
            <InfoRow label="产品名称" :value="order.product_name" />
            <InfoRow label="数量" :value="`${order.quantity} ${order.unit}`" />
            <InfoRow label="订单金额" :value="`${order.currency} ${Number(order.amount).toLocaleString()}`" />
            <InfoRow label="创建时间" :value="order.created_at" />
            <InfoRow label="创建人(业务员)" :value="order.created_by_name" />
            <InfoRow label="单证处理人" :value="order.doc_handler_name || '-'" />
            <InfoRow label="确认人(经理)" :value="order.confirm_handler_name || '-'" />
            <InfoRow label="提交时间" :value="order.submitted_at || '-'" />
            <InfoRow label="单证处理时间" :value="order.doc_processed_at || '-'" />
            <InfoRow label="确认完成时间" :value="order.confirmed_at || '-'" />
            <div class="col-span-2">
              <div class="text-gray-500 mb-1">业务员备注</div>
              <div class="text-gray-800">{{ order.sales_remark || '-' }}</div>
            </div>
            <div v-if="order.doc_remark" class="col-span-2">
              <div class="text-gray-500 mb-1">单证主管备注</div>
              <div class="text-gray-800">{{ order.doc_remark }}</div>
            </div>
            <div v-if="order.confirm_remark" class="col-span-2">
              <div class="text-gray-500 mb-1">业务经理备注</div>
              <div class="text-gray-800">{{ order.confirm_remark }}</div>
            </div>
            <div v-if="order.exception_remark" class="col-span-2">
              <div class="text-red-500 mb-1">⚠️ 异常说明</div>
              <div class="text-red-700 bg-red-50 p-2 rounded">{{ order.exception_remark }}</div>
            </div>
          </div>

          <div v-else class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <label class="block text-gray-500 mb-1">客户名称 *</label>
              <UInput v-model="editForm.customer_name" size="sm" />
            </div>
            <div>
              <label class="block text-gray-500 mb-1">目的国 *</label>
              <UInput v-model="editForm.country" size="sm" />
            </div>
            <div>
              <label class="block text-gray-500 mb-1">产品名称 *</label>
              <UInput v-model="editForm.product_name" size="sm" />
            </div>
            <div>
              <label class="block text-gray-500 mb-1">数量 *</label>
              <UInput v-model.number="editForm.quantity" size="sm" type="number" />
            </div>
            <div>
              <label class="block text-gray-500 mb-1">单位</label>
              <UInput v-model="editForm.unit" size="sm" />
            </div>
            <div>
              <label class="block text-gray-500 mb-1">金额(USD) *</label>
              <UInput v-model.number="editForm.amount" size="sm" type="number" />
            </div>
            <div class="col-span-2">
              <label class="block text-gray-500 mb-1">业务员备注</label>
              <UTextarea v-model="editForm.sales_remark" size="sm" rows="2" />
            </div>
            <div v-if="editError" class="col-span-2 p-2 bg-red-50 text-red-600 rounded text-xs">
              ❌ {{ editError }}
            </div>
            <div class="col-span-2 flex gap-2">
              <UButton size="sm" color="blue" @click="doEdit" :loading="editLoading">保存修改</UButton>
              <UButton size="sm" variant="ghost" @click="editMode = false">取消</UButton>
            </div>
          </div>
        </div>

        <!-- 证据 -->
        <div class="bg-white rounded-lg border border-gray-200 p-5">
          <h2 class="text-base font-bold text-gray-800 mb-4">📎 订单证据（三类齐全方可提交/确认）</h2>
          <div class="grid grid-cols-3 gap-4">
            <div
              v-for="etype in ['inquiry', 'quotation', 'contract']"
              :key="etype"
              class="border rounded-lg p-4"
              :class="hasEvidenceType(etype) ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'"
            >
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <span
                    :class="['w-3 h-3 rounded-full', hasEvidenceType(etype) ? 'bg-green-500' : 'bg-gray-300']"
                  />
                  <span class="font-medium text-sm">{{ EvidenceTypeLabels[etype] }}</span>
                </div>
                <UButton
                  v-if="canAddEvidence"
                  size="2xs"
                  variant="soft"
                  @click="openEvidenceModal(etype)"
                >
                  + 上传
                </UButton>
              </div>
              <div v-if="!hasEvidenceType(etype)" class="text-xs text-gray-400 py-4 text-center">
                暂无{{ EvidenceTypeLabels[etype] }}
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="ev in getEvidences(etype)"
                  :key="ev.id"
                  class="bg-white rounded p-2 border border-gray-100 text-xs flex items-center justify-between"
                >
                  <a :href="ev.file_url" target="_blank" class="text-blue-600 hover:underline truncate">
                    📄 {{ ev.file_name }}
                  </a>
                  <div class="flex gap-1 items-center">
                    <span class="text-gray-400">{{ ev.uploader_name }}</span>
                    <UButton
                      v-if="canDeleteEvidence(ev)"
                      size="2xs"
                      variant="ghost"
                      color="red"
                      @click="deleteEvidence(ev)"
                    >
                      🗑
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 操作区 -->
        <div class="bg-white rounded-lg border border-gray-200 p-5">
          <h2 class="text-base font-bold text-gray-800 mb-4">⚡ 办理操作</h2>

          <div v-if="canDoNothing" class="text-sm text-gray-500 py-4 text-center">
            当前角色无权在此状态下操作该订单
          </div>

          <!-- 业务员：提交单证 -->
          <div id="order-action-area" v-if="canSalesSubmit" class="space-y-3">
            <div class="text-sm text-gray-600 mb-2">
              您是 <b>{{ store.currentUser?.display_name }}</b>（外贸业务员），订单已就绪，可提交给单证主管处理
            </div>
            <div v-if="!evidenceReady" class="text-sm text-amber-600 bg-amber-50 p-3 rounded border border-amber-100">
              ⚠️ 缺少必要证据：{{ missingEvidenceList.join('、') }}，请先补齐
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">备注</label>
              <UTextarea v-model="actionRemark" rows="2" placeholder="选填" />
            </div>
            <div class="flex gap-2">
              <UButton
                color="blue"
                :disabled="!evidenceReady"
                :loading="actionLoading"
                @click="doSubmitToDoc"
              >
                ✅ 提交单证处理
              </UButton>
            </div>
            <div v-if="actionError" class="p-2 bg-red-50 text-red-600 rounded text-sm">
              ❌ {{ actionError }}
            </div>
          </div>

          <!-- 单证主管操作区 -->
          <div id="order-action-area" v-if="canDocApprove || canDocReject || canDocException" class="space-y-3">
            <div class="text-sm text-gray-600 mb-2">
              您是 <b>{{ store.currentUser?.display_name }}</b>（单证主管），请复核单证
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">
                备注 <span v-if="canDocReject || canDocException" class="text-red-500">（退回/异常必填）</span>
              </label>
              <UTextarea v-model="actionRemark" rows="2" placeholder="请填写复核意见" />
            </div>
            <div class="flex gap-2">
              <UButton v-if="canDocApprove" color="green" :loading="actionLoading" @click="doDocApprove">
                ✅ 复核通过，提交经理确认
              </UButton>
              <UButton v-if="canDocReject" color="amber" :loading="actionLoading" @click="doDocReject">
                🔙 退回业务员补正
              </UButton>
              <UButton v-if="canDocException" color="red" :loading="actionLoading" @click="doDocException">
                ⚠️ 标记异常
              </UButton>
            </div>
            <div v-if="actionError" class="p-2 bg-red-50 text-red-600 rounded text-sm">
              ❌ {{ actionError }}
            </div>
          </div>

          <!-- 经理操作区 -->
          <div id="order-action-area" v-if="canManagerApprove || canManagerReject || canManagerException" class="space-y-3">
            <div class="text-sm text-gray-600 mb-2">
              您是 <b>{{ store.currentUser?.display_name }}</b>（业务经理），请确认订单
            </div>
            <div v-if="!evidenceReady && canManagerApprove" class="text-sm text-amber-600 bg-amber-50 p-3 rounded border border-amber-100">
              ⚠️ 缺少必要证据：{{ missingEvidenceList.join('、') }}
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">
                备注 <span v-if="canManagerReject || canManagerException" class="text-red-500">（退回/异常必填）</span>
              </label>
              <UTextarea v-model="actionRemark" rows="2" placeholder="请填写确认意见" />
            </div>
            <div class="flex gap-2">
              <UButton
                v-if="canManagerApprove"
                color="green"
                :disabled="!evidenceReady"
                :loading="actionLoading"
                @click="doManagerApprove"
              >
                ✅ 确认通过，订单完成
              </UButton>
              <UButton v-if="canManagerReject" color="amber" :loading="actionLoading" @click="doManagerReject">
                🔙 退回单证补正
              </UButton>
              <UButton v-if="canManagerException" color="red" :loading="actionLoading" @click="doManagerException">
                ⚠️ 标记异常
              </UButton>
            </div>
            <div v-if="actionError" class="p-2 bg-red-50 text-red-600 rounded text-sm">
              ❌ {{ actionError }}
            </div>
          </div>
        </div>

        <!-- 批量操作历史（补正追踪） -->
        <div class="bg-white rounded-lg border border-gray-200 p-5">
          <h2 class="text-base font-bold text-gray-800 mb-4">🔄 批量操作历史（补正追踪）</h2>
          <div v-if="batchItems.length === 0" class="text-sm text-gray-400 py-6 text-center">
            暂无批量操作记录
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="(item, idx) in batchItems"
              :key="idx"
              class="border rounded-lg p-3"
              :class="{
                'border-red-200 bg-red-50/30': item.item_status === 'failed' && item.resolved_status === 'unresolved',
                'border-amber-200 bg-amber-50/30': item.item_status === 'retry' && item.resolved_status === 'unresolved',
                'border-green-200 bg-green-50/30': item.item_status === 'success' || item.resolved_status === 'resubmitted',
                'border-blue-200 bg-blue-50/30': item.resolved_status === 'corrected',
              }"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    :class="[
                      'inline-block px-2 py-0.5 rounded text-[11px] font-medium',
                      item.item_status === 'success' ? 'bg-green-100 text-green-700' : '',
                      item.item_status === 'failed' ? 'bg-red-100 text-red-700' : '',
                      item.item_status === 'retry' ? 'bg-amber-100 text-amber-700' : '',
                    ]"
                  >
                    {{ item.item_status === 'success' ? '成功' : item.item_status === 'failed' ? '失败' : '需重试' }}
                  </span>
                  <span
                    v-if="item.item_status !== 'success'"
                    :class="[
                      'inline-block px-2 py-0.5 rounded text-[11px] font-medium',
                      ResolvedStatusColors[item.resolved_status]
                    ]"
                  >
                    {{ item.resolved_status_display }}
                  </span>
                  <span
                    class="inline-block px-2 py-0.5 rounded text-[11px] bg-gray-100 text-gray-600 font-medium"
                  >
                    {{ item.action_display || item.action }}
                  </span>
                  <span class="text-xs text-gray-500">提交版本: v{{ item.submitted_version }}</span>
                </div>
                <UButton
                  v-if="item.can_handle"
                  size="xs"
                  color="blue"
                  variant="soft"
                  @click="scrollToAction"
                >
                  立即办理
                </UButton>
              </div>

              <div v-if="item.batch_no || item.processed_at" class="text-xs text-gray-400 mb-1">
                <span v-if="item.batch_no">批次: {{ item.batch_no }}</span>
                <span v-if="item.batch_no && item.processed_at"> · </span>
                <span v-if="item.processed_at">{{ item.processed_at }}</span>
              </div>

              <div v-if="item.error_code" class="text-sm font-medium text-gray-700">
                {{ item.error_code }}
              </div>
              <div v-if="item.error_message" class="text-sm text-gray-600 mt-0.5">
                {{ item.error_message }}
              </div>
              <div v-if="item.suggestion && item.resolved_status === 'unresolved'" class="text-sm text-blue-600 mt-1">
                💡 {{ item.suggestion }}
              </div>

              <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                <span v-if="item.responsible_role">
                  责任岗位: <span class="text-gray-700">{{ getRoleLabel(item.responsible_role) }}</span>
                </span>
                <span v-if="item.resolved_batch_no">
                  解决批次: <span class="text-green-700">{{ item.resolved_batch_no }}</span>
                </span>
                <span v-if="item.resolved_at">
                  解决时间: <span class="text-gray-700">{{ item.resolved_at }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 历史记录 -->
        <div class="bg-white rounded-lg border border-gray-200 p-5">
          <h2 class="text-base font-bold text-gray-800 mb-4">📜 操作历史</h2>
          <div class="space-y-3">
            <div v-for="h in histories" :key="h.id" class="flex gap-3 text-sm">
              <div class="flex flex-col items-center">
                <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-medium">
                  {{ h.operator_name.slice(0, 1) }}
                </div>
                <div class="w-px flex-1 bg-gray-200 mt-1" />
              </div>
              <div class="flex-1 pb-3">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-800">{{ h.operator_name }}</span>
                  <span class="text-gray-500">·</span>
                  <span class="text-gray-600">{{ h.action }}</span>
                </div>
                <div v-if="h.to_status" class="text-xs text-gray-500 mt-0.5">
                  {{ h.from_status_display ? h.from_status_display + ' → ' : '' }}<span class="text-blue-600 font-medium">{{ h.to_status_display }}</span>
                </div>
                <div v-if="h.remark" class="text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded">
                  {{ h.remark }}
                </div>
                <div class="text-xs text-gray-400 mt-1">{{ h.created_at }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右：流程进度 -->
      <div class="space-y-4">
        <div class="bg-white rounded-lg border border-gray-200 p-5">
          <h2 class="text-base font-bold text-gray-800 mb-4">🔄 流程进度</h2>
          <div class="space-y-4">
            <FlowStep
              title="1. 业务员创建订单"
              :subtitle="order.created_by_name"
              :status="step1Status"
              :time="order.created_at"
            />
            <FlowStep
              title="2. 业务员上传证据并提交"
              subtitle="客户询盘 + 报价确认 + 订单签订"
              :status="step2Status"
              :time="order.submitted_at"
            />
            <FlowStep
              title="3. 单证主管复核"
              :subtitle="order.doc_handler_name || '待处理'"
              :status="step3Status"
              :time="order.doc_processed_at"
            />
            <FlowStep
              title="4. 业务经理确认"
              :subtitle="order.confirm_handler_name || '待确认'"
              :status="step4Status"
              :time="order.confirmed_at"
              :last="true"
            />
          </div>
        </div>

        <div class="bg-white rounded-lg border border-gray-200 p-5">
          <h2 class="text-base font-bold text-gray-800 mb-3">ℹ️ 提示</h2>
          <ul class="text-xs text-gray-600 space-y-2 list-disc pl-4">
            <li>每个角色只能执行自己权限内的操作，不可跳过流程</li>
            <li>版本号用于防止并发冲突，操作时会校验版本</li>
            <li>三类证据齐全后方可提交单证或经理最终确认</li>
            <li>标记异常和退回必须填写说明</li>
            <li>如遇到错误，请查看具体错误码和原因</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 上传证据弹窗 -->
    <UModal v-model="openEvidence" :ui="{ width: 'w-full max-w-lg' }">
      <div class="p-6">
        <h2 class="text-lg font-bold mb-4">📎 上传证据 - {{ EvidenceTypeLabels[currentEvidenceType] }}</h2>
        <div class="space-y-3">
          <div>
            <label class="block text-sm text-gray-600 mb-1">文件名称 *</label>
            <UInput v-model="evidenceForm.file_name" placeholder="例如：客户询盘邮件.pdf" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1">文件链接/URL *</label>
            <UInput v-model="evidenceForm.file_url" placeholder="https://..." />
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1">备注</label>
            <UTextarea v-model="evidenceForm.remark" rows="2" />
          </div>
        </div>
        <div v-if="evidenceError" class="mt-3 p-2 bg-red-50 text-red-600 rounded text-sm">
          ❌ {{ evidenceError }}
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <UButton variant="ghost" @click="openEvidence = false">取消</UButton>
          <UButton color="blue" @click="doAddEvidence" :loading="evidenceLoading">
            上传
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAppStore } from '~/stores/app'
import type { TradeOrder, Evidence, OrderHistory, BatchItemResult } from '~/types'
import { StatusColorClass, EvidenceTypeLabels, RoleLabels, ResolvedStatusColors } from '~/types'

const route = useRoute()
const store = useAppStore()
const { currentUser } = storeToRefs(store)

const order = ref<TradeOrder | null>(null)
const histories = ref<OrderHistory[]>([])
const batchItems = ref<BatchItemResult[]>([])

const editMode = ref(false)
const editLoading = ref(false)
const editError = ref('')
const editForm = ref<any>({})

const actionRemark = ref('')
const actionLoading = ref(false)
const actionError = ref('')

const openEvidence = ref(false)
const currentEvidenceType = ref('inquiry')
const evidenceLoading = ref(false)
const evidenceError = ref('')
const evidenceForm = ref({ file_name: '', file_url: '', remark: '' })

const orderId = computed(() => Number(route.params.id))

const canEdit = computed(() => {
  if (!order.value || !currentUser.value) return false
  if (!store.isSales) return false
  if (order.value.created_by_id !== currentUser.value.id) return false
  return ['draft', 'doc_correction'].includes(order.value.status)
})

const canAddEvidence = computed(() => canEdit.value)

const canDoNothing = computed(() => {
  return !canSalesSubmit.value && !canDocApprove.value && !canDocReject.value && !canDocException.value
    && !canManagerApprove.value && !canManagerReject.value && !canManagerException.value
})

const canSalesSubmit = computed(() => {
  if (!order.value || !currentUser.value || !store.isSales) return false
  if (order.value.created_by_id !== currentUser.value.id) return false
  return ['draft', 'doc_correction'].includes(order.value.status)
})

const canDocApprove = computed(() => {
  if (!order.value || !store.isDoc) return false
  return ['pending_doc', 'doc_processing', 'confirm_correction'].includes(order.value.status)
})
const canDocReject = computed(() => {
  if (!order.value || !store.isDoc) return false
  return ['pending_doc', 'doc_processing'].includes(order.value.status)
})
const canDocException = computed(() => canDocReject.value)

const canManagerApprove = computed(() => {
  if (!order.value || !store.isManager) return false
  return ['pending_confirm', 'confirm_exception'].includes(order.value.status)
})
const canManagerReject = computed(() => {
  if (!order.value || !store.isManager) return false
  return order.value.status === 'pending_confirm'
})
const canManagerException = computed(() => canManagerReject.value)

const evidenceReady = computed(() => {
  if (!order.value) return false
  return hasEvidenceType('inquiry') && hasEvidenceType('quotation') && hasEvidenceType('contract')
})
const missingEvidenceList = computed(() => {
  if (!order.value) return []
  const missing = []
  if (!hasEvidenceType('inquiry')) missing.push('客户询盘')
  if (!hasEvidenceType('quotation')) missing.push('报价确认')
  if (!hasEvidenceType('contract')) missing.push('订单签订')
  return missing
})

const step1Status = computed(() => order.value ? 'done' : 'pending')
const step2Status = computed(() => {
  if (!order.value) return 'pending'
  if (['draft'].includes(order.value.status)) return evidenceReady.value ? 'ready' : 'current'
  return 'done'
})
const step3Status = computed(() => {
  if (!order.value) return 'pending'
  if (['pending_doc', 'doc_processing', 'doc_exception', 'doc_correction', 'confirm_correction'].includes(order.value.status)) return 'current'
  if (['pending_confirm', 'confirm_exception', 'completed'].includes(order.value.status)) return 'done'
  return 'pending'
})
const step4Status = computed(() => {
  if (!order.value) return 'pending'
  if (order.value.status === 'completed') return 'done'
  if (['pending_confirm', 'confirm_exception'].includes(order.value.status)) return 'current'
  return 'pending'
})

function hasEvidenceType(type: string) {
  return !!order.value && order.value.evidences.some(e => e.evidence_type === type)
}
function getEvidences(type: string) {
  return order.value ? order.value.evidences.filter(e => e.evidence_type === type) : []
}

function canDeleteEvidence(ev: Evidence) {
  if (!order.value || !currentUser.value) return false
  if (ev.uploader_id !== currentUser.value.id) return false
  return ['draft', 'doc_correction'].includes(order.value.status)
}

function getRoleLabel(role: string) {
  if (role === 'operator') return '操作人'
  if (role === 'admin') return '系统管理员'
  return RoleLabels[role] || role
}

function scrollToAction() {
  const el = document.getElementById('order-action-area')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

async function loadData() {
  try {
    order.value = await store.getOrder(orderId.value)
    histories.value = await store.getHistories(orderId.value)
    batchItems.value = await store.getOrderBatchItems(orderId.value)
  } catch (e: any) {
    alert(e.message)
  }
}

async function doEdit() {
  if (!order.value) return
  editError.value = ''
  try {
    editLoading.value = true
    order.value = await store.updateOrder(order.value.id, {
      ...editForm.value,
      version: order.value.version,
    })
    editMode.value = false
    histories.value = await store.getHistories(order.value.id)
  } catch (e: any) {
    editError.value = e.message
  } finally {
    editLoading.value = false
  }
}

function openEvidenceModal(type: string) {
  currentEvidenceType.value = type
  evidenceForm.value = { file_name: '', file_url: '', remark: '' }
  evidenceError.value = ''
  openEvidence.value = true
}

async function doAddEvidence() {
  if (!order.value) return
  evidenceError.value = ''
  if (!evidenceForm.value.file_name || !evidenceForm.value.file_url) {
    evidenceError.value = '请填写文件名和链接'
    return
  }
  try {
    evidenceLoading.value = true
    await store.addEvidence(order.value.id, {
      evidence_type: currentEvidenceType.value,
      file_name: evidenceForm.value.file_name,
      file_url: evidenceForm.value.file_url,
      remark: evidenceForm.value.remark,
    })
    order.value = await store.getOrder(order.value.id)
    histories.value = await store.getHistories(order.value.id)
    openEvidence.value = false
  } catch (e: any) {
    evidenceError.value = e.message
  } finally {
    evidenceLoading.value = false
  }
}

async function deleteEvidence(ev: Evidence) {
  if (!confirm(`确定删除证据 "${ev.file_name}" 吗？`)) return
  try {
    await store.deleteEvidence(ev.id)
    if (order.value) {
      order.value = await store.getOrder(order.value.id)
      histories.value = await store.getHistories(order.value.id)
    }
  } catch (e: any) {
    alert(e.message)
  }
}

function clearActionState(keepRemark = false) {
  actionError.value = ''
  if (!keepRemark) {
    actionRemark.value = ''
  }
}

async function doSubmitToDoc() {
  if (!order.value) return
  const remark = actionRemark.value
  clearActionState()
  try {
    actionLoading.value = true
    order.value = await store.submitToDoc(order.value.id, order.value.version, remark)
    histories.value = await store.getHistories(order.value.id)
  } catch (e: any) {
    actionError.value = e.message
  } finally {
    actionLoading.value = false
  }
}

async function doDocApprove() {
  if (!order.value) return
  const remark = actionRemark.value
  clearActionState()
  try {
    actionLoading.value = true
    order.value = await store.docAction(order.value.id, 'approve', order.value.version, remark)
    histories.value = await store.getHistories(order.value.id)
  } catch (e: any) {
    actionError.value = e.message
  } finally {
    actionLoading.value = false
  }
}
async function doDocReject() {
  if (!order.value) return
  const remark = actionRemark.value
  if (!remark.trim()) {
    actionError.value = '退回必须填写补正说明'
    return
  }
  clearActionState()
  try {
    actionLoading.value = true
    order.value = await store.docAction(order.value.id, 'reject', order.value.version, remark)
    histories.value = await store.getHistories(order.value.id)
  } catch (e: any) {
    actionError.value = e.message
  } finally {
    actionLoading.value = false
  }
}
async function doDocException() {
  if (!order.value) return
  const remark = actionRemark.value
  if (!remark.trim()) {
    actionError.value = '标记异常必须填写说明'
    return
  }
  clearActionState()
  try {
    actionLoading.value = true
    order.value = await store.docAction(order.value.id, 'mark-exception', order.value.version, remark)
    histories.value = await store.getHistories(order.value.id)
  } catch (e: any) {
    actionError.value = e.message
  } finally {
    actionLoading.value = false
  }
}

async function doManagerApprove() {
  if (!order.value) return
  const remark = actionRemark.value
  clearActionState()
  try {
    actionLoading.value = true
    order.value = await store.confirmAction(order.value.id, 'approve', order.value.version, remark)
    histories.value = await store.getHistories(order.value.id)
  } catch (e: any) {
    actionError.value = e.message
  } finally {
    actionLoading.value = false
  }
}
async function doManagerReject() {
  if (!order.value) return
  const remark = actionRemark.value
  if (!remark.trim()) {
    actionError.value = '退回必须填写补正说明'
    return
  }
  clearActionState()
  try {
    actionLoading.value = true
    order.value = await store.confirmAction(order.value.id, 'reject', order.value.version, remark)
    histories.value = await store.getHistories(order.value.id)
  } catch (e: any) {
    actionError.value = e.message
  } finally {
    actionLoading.value = false
  }
}
async function doManagerException() {
  if (!order.value) return
  const remark = actionRemark.value
  if (!remark.trim()) {
    actionError.value = '标记异常必须填写说明'
    return
  }
  clearActionState()
  try {
    actionLoading.value = true
    order.value = await store.confirmAction(order.value.id, 'mark-exception', order.value.version, remark)
    histories.value = await store.getHistories(order.value.id)
  } catch (e: any) {
    actionError.value = e.message
  } finally {
    actionLoading.value = false
  }
}

watch(editMode, (v) => {
  if (v && order.value) {
    editForm.value = {
      customer_name: order.value.customer_name,
      country: order.value.country,
      product_name: order.value.product_name,
      quantity: order.value.quantity,
      unit: order.value.unit,
      amount: order.value.amount,
      sales_remark: order.value.sales_remark,
    }
  }
})

onMounted(loadData)
</script>
