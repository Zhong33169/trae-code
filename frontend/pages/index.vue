<template>
  <div v-if="!store.currentUser" class="flex items-center justify-center py-20">
    <div class="text-center text-gray-500">
      <p class="text-lg mb-2">👤 请先在右上角选择登录角色</p>
      <p class="text-sm">演示账号见 README</p>
    </div>
  </div>

  <div v-else class="flex gap-4">
    <!-- 左侧主区：订单队列 -->
    <div class="flex-1 flex flex-col gap-4 min-w-0">
      <!-- 工具栏 -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600">状态筛选:</label>
          <USelect
            v-model="statusFilter"
            :options="statusOptions"
            size="sm"
            class="w-48"
            clearable
            placeholder="全部状态"
          />
        </div>
        <UInput
          v-model="keyword"
          size="sm"
          placeholder="搜索订单号/客户/产品"
          icon="i-heroicons-magnifying-glass-20-solid"
          class="w-64"
        />
        <UButton size="sm" variant="soft" @click="applyFilter">
          🔍 筛选
        </UButton>
        <UButton size="sm" variant="ghost" @click="resetFilter">
          重置
        </UButton>

        <div class="flex-1" />

        <UButton
          v-if="store.isSales"
          size="sm"
          color="green"
          icon="i-heroicons-plus-20-solid"
          @click="openCreateModal = true"
        >
          新建订单
        </UButton>

        <UButton
          :disabled="store.selectedOrderIds.length === 0"
          size="sm"
          color="blue"
          @click="openBatchModal = true"
        >
          批量操作 ({{ store.selectedOrderIds.length }})
        </UButton>

        <UButton size="sm" variant="ghost" @click="store.loadOrders()">
          ↻ 刷新
        </UButton>
      </div>

      <!-- 订单列表 -->
      <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-3 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    :checked="allSelected"
                    :indeterminate="someSelected"
                    @change="toggleSelectAll"
                    class="w-4 h-4"
                  />
                </th>
                <th class="px-3 py-3 text-left font-medium text-gray-600">订单编号</th>
                <th class="px-3 py-3 text-left font-medium text-gray-600">客户/目的国</th>
                <th class="px-3 py-3 text-left font-medium text-gray-600">产品</th>
                <th class="px-3 py-3 text-right font-medium text-gray-600">数量/金额</th>
                <th class="px-3 py-3 text-left font-medium text-gray-600">状态</th>
                <th class="px-3 py-3 text-left font-medium text-gray-600">证据</th>
                <th class="px-3 py-3 text-left font-medium text-gray-600">创建人</th>
                <th class="px-3 py-3 text-center font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="order in pagedOrders"
                :key="order.id"
                class="hover:bg-blue-50 cursor-pointer transition-colors"
                :class="{ 'bg-blue-50': detailOrderId === order.id, 'bg-gray-50': store.selectedOrderIds.includes(order.id) }"
                @click="showOrderEvidence(order)"
              >
                <td class="px-3 py-3" @click.stop>
                  <input
                    type="checkbox"
                    :checked="store.selectedOrderIds.includes(order.id)"
                    @change="toggleSelect(order.id)"
                    class="w-4 h-4"
                  />
                </td>
                <td class="px-3 py-3 font-mono text-xs font-medium text-gray-900">{{ order.order_no }}</td>
                <td class="px-3 py-3">
                  <div class="font-medium text-gray-800">{{ order.customer_name }}</div>
                  <div class="text-xs text-gray-500">{{ order.country }}</div>
                </td>
                <td class="px-3 py-3 text-gray-700">{{ order.product_name }}</td>
                <td class="px-3 py-3 text-right">
                  <div>{{ order.quantity }} {{ order.unit }}</div>
                  <div class="text-xs text-gray-500">{{ order.currency }} {{ Number(order.amount).toLocaleString() }}</div>
                </td>
                <td class="px-3 py-3">
                  <span :class="['status-badge', StatusColorClass[order.status]]">{{ order.status_display }}</span>
                </td>
                <td class="px-3 py-3">
                  <div class="flex gap-1">
                    <span
                      v-for="tag in evidenceTags(order)"
                      :key="tag.type"
                      :title="tag.label"
                      :class="[
                        'inline-block w-5 h-5 rounded text-center leading-5 text-[10px] font-medium',
                        tag.ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                      ]"
                    >
                      {{ tag.letter }}
                    </span>
                  </div>
                </td>
                <td class="px-3 py-3 text-xs text-gray-600">{{ order.created_by_name }}</td>
                <td class="px-3 py-3 text-center">
                  <button
                    @click.stop="showDetail(order)"
                    class="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    办理 →
                  </button>
                </td>
              </tr>
              <tr v-if="store.orders.length === 0">
                <td colspan="9" class="px-3 py-16 text-center text-gray-400">
                  暂无订单数据
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="store.orders.length > pageSize" class="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
          <div class="text-sm text-gray-500">共 {{ store.orders.length }} 条</div>
          <div class="flex gap-1">
            <UButton
              size="xs"
              variant="soft"
              :disabled="page === 1"
              @click="page = Math.max(1, page - 1)"
            >
              上一页
            </UButton>
            <span class="px-3 text-sm text-gray-600 self-center">{{ page }} / {{ totalPages }}</span>
            <UButton
              size="xs"
              variant="soft"
              :disabled="page >= totalPages"
              @click="page = Math.min(totalPages, page + 1)"
            >
              下一页
            </UButton>
          </div>
        </div>
      </div>

      <!-- 最近批处理记录 -->
      <div v-if="store.batchHistory.length > 0" class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">📋 最近批处理记录</h3>
        <div class="space-y-2 max-h-64 overflow-y-auto">
          <div
            v-for="b in store.batchHistory.slice(0, 5)"
            :key="b.id"
            class="border border-gray-100 rounded p-3 text-sm hover:bg-gray-50"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="font-medium text-gray-800">{{ b.batch_no }} - {{ b.action_display }}</span>
              <span class="text-xs text-gray-400">{{ b.created_at }}</span>
            </div>
            <div class="flex gap-3 text-xs">
              <span>操作人: {{ b.operator_name }}</span>
              <span>成功: <b class="text-green-600">{{ b.success_count }}</b></span>
              <span>失败: <b class="text-red-600">{{ b.failed_count }}</b></span>
              <span>需重试: <b class="text-amber-600">{{ b.retry_count }}</b></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧：证据 + 详情快速预览 -->
    <div class="w-[420px] flex-shrink-0 flex flex-col gap-4">
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between">
          📎 订单证据
          <span v-if="selectedOrder" class="text-xs text-gray-400">{{ selectedOrder.order_no }}</span>
        </h3>

        <div v-if="!selectedOrder" class="text-sm text-gray-400 text-center py-8">
          👈 请在左侧点击订单查看证据
        </div>

        <div v-else class="space-y-4">
          <div v-for="etype in ['inquiry', 'quotation', 'contract']" :key="etype">
            <div class="flex items-center gap-2 mb-2">
              <span
                :class="[
                  'w-2 h-2 rounded-full',
                  hasEvidenceType(selectedOrder, etype) ? 'bg-green-500' : 'bg-gray-300'
                ]"
              />
              <span class="text-sm font-medium text-gray-700">{{ EvidenceTypeLabels[etype] }}</span>
              <UButton
                v-if="canAddEvidence"
                size="2xs"
                variant="ghost"
                @click="openEvidenceModal(etype)"
              >
                + 上传
              </UButton>
            </div>
            <div v-if="getEvidences(selectedOrder, etype).length === 0" class="text-xs text-gray-400 pl-4">
              暂无{{ EvidenceTypeLabels[etype] }}
            </div>
            <div v-else class="space-y-1 pl-4">
              <div
                v-for="ev in getEvidences(selectedOrder, etype)"
                :key="ev.id"
                class="flex items-center justify-between bg-gray-50 rounded px-2 py-1.5 text-xs"
              >
                <a :href="ev.file_url" target="_blank" class="text-blue-600 hover:underline truncate">
                  📄 {{ ev.file_name }}
                </a>
                <div class="flex items-center gap-1 flex-shrink-0">
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

          <div v-if="selectedOrder.exception_remark" class="mt-3 p-3 bg-red-50 rounded border border-red-100">
            <div class="text-xs font-semibold text-red-700 mb-1">⚠️ 异常说明</div>
            <div class="text-xs text-red-600">{{ selectedOrder.exception_remark }}</div>
          </div>

          <div class="flex gap-2 pt-2 border-t border-gray-100">
            <UButton size="sm" class="flex-1" @click="showDetail(selectedOrder)">
              办理详情 →
            </UButton>
          </div>
        </div>
      </div>

      <!-- 状态流转说明 -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">🔄 流程说明</h3>
        <div class="space-y-2 text-xs text-gray-600">
          <div>1️⃣ <b>业务员</b> 创建订单 → 上传3类证据 → 提交单证</div>
          <div>2️⃣ <b>单证主管</b> 复核通过 / 退回补正 / 标记异常 → 提交经理</div>
          <div>3️⃣ <b>业务经理</b> 确认通过 / 退回补正 / 标记异常 → 完成</div>
          <div class="pt-2 text-gray-400 border-t border-gray-100">
            每一步不能跳过，后续角色不能替前序角色操作
          </div>
        </div>
      </div>
    </div>

    <!-- 新建订单弹窗 -->
    <UModal v-model="openCreateModal" :ui="{ width: 'w-full max-w-2xl' }">
      <div class="p-6">
        <h2 class="text-lg font-bold mb-4">📝 新建外贸订单</h2>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-gray-600 mb-1">订单编号（可自动生成）</label>
            <UInput v-model="createForm.order_no" placeholder="留空自动生成" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1">客户名称 *</label>
            <UInput v-model="createForm.customer_name" placeholder="必填" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1">目的国 *</label>
            <UInput v-model="createForm.country" placeholder="必填" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1">产品名称 *</label>
            <UInput v-model="createForm.product_name" placeholder="必填" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1">数量 *</label>
            <UInput v-model.number="createForm.quantity" type="number" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1">单位</label>
            <UInput v-model="createForm.unit" placeholder="PCS" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1">金额(USD) *</label>
            <UInput v-model.number="createForm.amount" type="number" />
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1">币种</label>
            <UInput v-model="createForm.currency" placeholder="USD" />
          </div>
          <div class="col-span-2">
            <label class="block text-sm text-gray-600 mb-1">业务员备注</label>
            <UTextarea v-model="createForm.sales_remark" rows="2" />
          </div>
        </div>

        <div v-if="createError" class="mt-3 p-2 bg-red-50 text-red-600 rounded text-sm">
          ❌ {{ createError }}
        </div>

        <div class="flex justify-end gap-2 mt-6">
          <UButton variant="ghost" @click="openCreateModal = false">取消</UButton>
          <UButton color="green" @click="doCreate" :loading="creating">
            创建订单
          </UButton>
        </div>
      </div>
    </UModal>

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

    <!-- 批量操作弹窗 -->
    <UModal v-model="openBatchModal" :ui="{ width: 'w-full max-w-4xl' }">
      <div class="p-6">
        <h2 class="text-lg font-bold mb-4">⚡ 批量变更复核 ({{ store.selectedOrderIds.length }} 条)</h2>

        <div v-if="!batchResult">
          <div class="space-y-4">
            <div>
              <label class="block text-sm text-gray-600 mb-1">选择操作 *</label>
              <USelect
                v-model="batchForm.action"
                :options="batchActionOptions"
                size="md"
                class="w-full"
                placeholder="请选择要执行的批量操作"
                @change="batchForm.remark = ''"
              />
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">
                备注说明
                <span v-if="isRemarkRequired" class="text-red-500 ml-1">* (当前操作必须填写)</span>
                <span v-else class="text-gray-400 ml-1">(退回/标记异常时建议填写)</span>
              </label>
              <UTextarea v-model="batchForm.remark" rows="2" :placeholder="isRemarkRequired ? '请填写备注说明（必填）' : '退回/标记异常时建议填写说明'" />
              <div v-if="isRemarkRequired && !batchForm.remark.trim() && batchForm.action" class="text-red-500 text-xs mt-1">
                ⚠️ 该操作必须填写备注说明
              </div>
            </div>

            <div class="bg-gray-50 rounded border border-gray-200 p-3">
              <div class="text-xs text-gray-500 mb-2">将对以下 {{ store.selectedOrderIds.length }} 条订单执行操作：</div>
              <div class="max-h-64 overflow-y-auto">
                <table class="w-full text-xs">
                  <thead class="bg-gray-100 sticky top-0">
                    <tr>
                      <th class="px-2 py-1.5 text-left">订单号</th>
                      <th class="px-2 py-1.5 text-left">客户</th>
                      <th class="px-2 py-1.5 text-left">当前状态</th>
                      <th class="px-2 py-1.5 text-center">版本号</th>
                      <th class="px-2 py-1.5 text-left">证据</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="oid in store.selectedOrderIds" :key="oid" class="hover:bg-white">
                      <template v-if="getOrderById(oid)">
                        <td class="px-2 py-1.5 font-mono">{{ getOrderById(oid)!.order_no }}</td>
                        <td class="px-2 py-1.5">{{ getOrderById(oid)!.customer_name }}</td>
                        <td class="px-2 py-1.5">
                          <span :class="['status-badge', StatusColorClass[getOrderById(oid)!.status]]" style="padding: 1px 6px; font-size: 11px;">
                            {{ getOrderById(oid)!.status_display }}
                          </span>
                        </td>
                        <td class="px-2 py-1.5 text-center font-mono text-gray-600">v{{ getOrderById(oid)!.version }}</td>
                        <td class="px-2 py-1.5">
                          <div class="flex gap-0.5">
                            <span
                              v-for="tag in evidenceTags(getOrderById(oid)!)"
                              :key="tag.type"
                              :class="[
                                'inline-block w-4 h-4 rounded text-center leading-4 text-[9px] font-medium',
                                tag.ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                              ]"
                            >
                              {{ tag.letter }}
                            </span>
                          </div>
                        </td>
                      </template>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-if="batchError" class="p-2 bg-red-50 text-red-600 rounded text-sm">
              ❌ {{ batchError }}
            </div>

            <div class="flex justify-end gap-2">
              <UButton variant="ghost" @click="openBatchModal = false">取消</UButton>
              <UButton color="blue" :disabled="!canSubmitBatch" @click="doBatch" :loading="batchLoading">
                执行批量操作
              </UButton>
            </div>
          </div>
        </div>

        <!-- 批量结果展示 -->
        <div v-else>
          <div class="grid grid-cols-4 gap-3 mb-4">
            <div class="bg-gray-50 rounded p-3 text-center">
              <div class="text-2xl font-bold text-gray-700">{{ batchResult.total_count }}</div>
              <div class="text-xs text-gray-500">总条数</div>
            </div>
            <div class="bg-green-50 rounded p-3 text-center">
              <div class="text-2xl font-bold text-green-600">{{ batchResult.success_count }}</div>
              <div class="text-xs text-green-600">✅ 成功</div>
            </div>
            <div class="bg-red-50 rounded p-3 text-center">
              <div class="text-2xl font-bold text-red-600">{{ batchResult.failed_count }}</div>
              <div class="text-xs text-red-600">❌ 失败</div>
            </div>
            <div class="bg-amber-50 rounded p-3 text-center">
              <div class="text-2xl font-bold text-amber-600">{{ batchResult.retry_count }}</div>
              <div class="text-xs text-amber-600">🔄 需重试</div>
            </div>
          </div>

          <div class="border border-gray-200 rounded overflow-hidden">
            <table class="w-full text-xs">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left">订单号</th>
                  <th class="px-3 py-2 text-center">提交版本</th>
                  <th class="px-3 py-2 text-left">结果</th>
                  <th class="px-3 py-2 text-left">错误码</th>
                  <th class="px-3 py-2 text-left">说明</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="item in batchResult.items" :key="item.order_id">
                  <td class="px-3 py-2 font-mono">{{ item.order_no }}</td>
                  <td class="px-3 py-2 text-center font-mono text-gray-500">{{ getOrderById(item.order_id)?.version || '-' }}</td>
                  <td class="px-3 py-2">
                    <span
                      :class="[
                        'inline-block px-2 py-0.5 rounded text-[11px] font-medium',
                        item.item_status === 'success' ? 'item-success' : '',
                        item.item_status === 'failed' ? 'item-failed' : '',
                        item.item_status === 'retry' ? 'item-retry' : '',
                      ]"
                    >
                      {{ item.item_status === 'success' ? '成功' : item.item_status === 'failed' ? '失败' : '需重试' }}
                    </span>
                  </td>
                  <td class="px-3 py-2 font-mono text-gray-500">{{ item.error_code || '-' }}</td>
                  <td class="px-3 py-2 text-gray-600">{{ item.error_message || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="flex justify-end gap-2 mt-4">
            <UButton variant="ghost" @click="closeBatchModal">关闭</UButton>
            <UButton @click="resetBatchAndRetry" color="blue">
              继续批量操作
            </UButton>
          </div>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAppStore } from '~/stores/app'
import type { TradeOrder, Evidence } from '~/types'
import { StatusColorClass, EvidenceTypeLabels } from '~/types'

const store = useAppStore()
const { orders, selectedOrderIds, batchHistory } = storeToRefs(store)
const router = useRouter()

const statusFilter = ref<string | null>(null)
const keyword = ref('')
const page = ref(1)
const pageSize = 10
const detailOrderId = ref<number | null>(null)
const selectedOrder = ref<TradeOrder | null>(null)

const openCreateModal = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = ref({
  order_no: '', customer_name: '', country: '', product_name: '',
  quantity: 0, unit: 'PCS', amount: 0, currency: 'USD', sales_remark: ''
})

const openEvidence = ref(false)
const currentEvidenceType = ref('inquiry')
const evidenceLoading = ref(false)
const evidenceError = ref('')
const evidenceForm = ref({ file_name: '', file_url: '', remark: '' })

const openBatchModal = ref(false)
const batchLoading = ref(false)
const batchError = ref('')
const batchResult = ref<any>(null)
const batchForm = ref({ action: '', remark: '' })

const statusOptions = computed(() => [
  { label: '草稿', value: 'draft' },
  { label: '待单证处理', value: 'pending_doc' },
  { label: '单证处理中', value: 'doc_processing' },
  { label: '单证异常', value: 'doc_exception' },
  { label: '待业务员补正', value: 'doc_correction' },
  { label: '待业务经理确认', value: 'pending_confirm' },
  { label: '确认异常', value: 'confirm_exception' },
  { label: '待单证补正', value: 'confirm_correction' },
  { label: '已完成', value: 'completed' },
  { label: '已退回', value: 'rejected' },
])

const batchActionOptions = computed(() => {
  if (store.isSales) {
    return [
      { label: '提交单证处理', value: 'submit_to_doc' },
    ]
  }
  if (store.isDoc) {
    return [
      { label: '单证复核通过', value: 'approve_doc' },
      { label: '退回业务员补正', value: 'reject_doc' },
      { label: '单证标记异常', value: 'mark_exception_doc' },
      { label: '提交经理确认', value: 'submit_to_confirm' },
    ]
  }
  if (store.isManager) {
    return [
      { label: '经理确认通过', value: 'approve_confirm' },
      { label: '退回单证补正', value: 'reject_confirm' },
      { label: '确认标记异常', value: 'mark_exception_confirm' },
    ]
  }
  return []
})

const totalPages = computed(() => Math.max(1, Math.ceil(store.orders.length / pageSize)))
const pagedOrders = computed(() => {
  const start = (page.value - 1) * pageSize
  return store.orders.slice(start, start + pageSize)
})

const allSelected = computed(() => store.orders.length > 0 && store.orders.every(o => selectedOrderIds.value.includes(o.id)))
const someSelected = computed(() => selectedOrderIds.value.length > 0 && !allSelected.value)

const REMARK_REQUIRED_ACTIONS = ['reject_doc', 'mark_exception_doc', 'reject_confirm', 'mark_exception_confirm']

const isRemarkRequired = computed(() => {
  return REMARK_REQUIRED_ACTIONS.includes(batchForm.value.action)
})

const canSubmitBatch = computed(() => {
  if (!batchForm.value.action) return false
  if (selectedOrderIds.value.length === 0) return false
  if (isRemarkRequired.value && !batchForm.value.remark.trim()) return false
  return true
})

const canAddEvidence = computed(() => {
  if (!selectedOrder.value || !store.currentUser) return false
  if (store.isSales) return selectedOrder.value.created_by_id === store.currentUser.id && ['draft', 'doc_correction'].includes(selectedOrder.value.status)
  return false
})

function canDeleteEvidence(ev: Evidence) {
  if (!store.currentUser) return false
  if (!selectedOrder.value) return false
  if (ev.uploader_id !== store.currentUser.id) return false
  return ['draft', 'doc_correction'].includes(selectedOrder.value.status)
}

function applyFilter() {
  page.value = 1
  store.loadOrders(statusFilter.value || undefined, keyword.value || undefined)
}
function resetFilter() {
  statusFilter.value = null
  keyword.value = ''
  page.value = 1
  store.loadOrders()
}

function showOrderEvidence(order: TradeOrder) {
  selectedOrder.value = order
  detailOrderId.value = order.id
}

function showDetail(order: TradeOrder) {
  selectedOrder.value = order
  detailOrderId.value = order.id
  router.push(`/orders/${order.id}`)
}

function evidenceTags(order: TradeOrder) {
  return [
    { type: 'inquiry', letter: '询', label: '客户询盘', ok: hasEvidenceType(order, 'inquiry') },
    { type: 'quotation', letter: '报', label: '报价确认', ok: hasEvidenceType(order, 'quotation') },
    { type: 'contract', letter: '签', label: '订单签订', ok: hasEvidenceType(order, 'contract') },
  ]
}

function hasEvidenceType(order: TradeOrder, type: string) {
  return order.evidences.some(e => e.evidence_type === type)
}
function getEvidences(order: TradeOrder, type: string) {
  return order.evidences.filter(e => e.evidence_type === type)
}

function toggleSelect(id: number) {
  const idx = selectedOrderIds.value.indexOf(id)
  if (idx >= 0) selectedOrderIds.value.splice(idx, 1)
  else selectedOrderIds.value.push(id)
  store.setSelectedOrderIds([...selectedOrderIds.value])
}
function toggleSelectAll(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  if (checked) store.setSelectedOrderIds(store.orders.map(o => o.id))
  else store.setSelectedOrderIds([])
}

function getOrderById(id: number) {
  return store.orders.find(o => o.id === id)
}

async function doCreate() {
  createError.value = ''
  if (!createForm.value.customer_name || !createForm.value.country || !createForm.value.product_name) {
    createError.value = '请填写必填项'
    return
  }
  try {
    creating.value = true
    await store.createOrder({
      ...createForm.value,
      order_no: createForm.value.order_no || undefined,
    })
    openCreateModal.value = false
    createForm.value = { order_no: '', customer_name: '', country: '', product_name: '', quantity: 0, unit: 'PCS', amount: 0, currency: 'USD', sales_remark: '' }
  } catch (e: any) {
    createError.value = e.message
  } finally {
    creating.value = false
  }
}

function openEvidenceModal(type: string) {
  currentEvidenceType.value = type
  evidenceForm.value = { file_name: '', file_url: '', remark: '' }
  evidenceError.value = ''
  openEvidence.value = true
}

async function doAddEvidence() {
  evidenceError.value = ''
  if (!evidenceForm.value.file_name || !evidenceForm.value.file_url) {
    evidenceError.value = '请填写文件名和链接'
    return
  }
  if (!selectedOrder.value) return
  try {
    evidenceLoading.value = true
    await store.addEvidence(selectedOrder.value.id, {
      evidence_type: currentEvidenceType.value,
      file_name: evidenceForm.value.file_name,
      file_url: evidenceForm.value.file_url,
      remark: evidenceForm.value.remark,
    })
    selectedOrder.value = await store.getOrder(selectedOrder.value.id)
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
    if (selectedOrder.value) {
      selectedOrder.value = await store.getOrder(selectedOrder.value.id)
    }
  } catch (e: any) {
    alert(e.message)
  }
}

async function doBatch() {
  batchError.value = ''
  if (!batchForm.value.action) {
    batchError.value = '请选择批量操作'
    return
  }
  if (selectedOrderIds.value.length === 0) {
    batchError.value = '请先选择订单'
    return
  }
  if (isRemarkRequired.value && !batchForm.value.remark.trim()) {
    batchError.value = '该操作必须填写备注说明'
    return
  }

  const orderItems = selectedOrderIds.value
    .map(id => {
      const order = getOrderById(id)
      if (!order) return null
      return { order_id: order.id, version: order.version }
    })
    .filter(Boolean) as { order_id: number; version: number }[]

  try {
    batchLoading.value = true
    batchResult.value = await store.batchOperation(
      batchForm.value.action,
      orderItems,
      batchForm.value.remark
    )

    if (selectedOrder.value) {
      selectedOrder.value = await store.getOrder(selectedOrder.value.id)
    }
  } catch (e: any) {
    batchError.value = e.message
  } finally {
    batchLoading.value = false
  }
}

function closeBatchModal() {
  openBatchModal.value = false
  batchResult.value = null
  batchForm.value = { action: '', remark: '' }
}
function resetBatchAndRetry() {
  batchResult.value = null
  batchForm.value = { action: '', remark: '' }
}

watch(selectedOrderIds, (ids) => {
  if (ids.length > 0 && selectedOrder.value && !ids.includes(selectedOrder.value.id)) {
    // keep selection
  }
}, { deep: true })

watch(() => store.orders, () => {
  if (selectedOrder.value) {
    const updated = store.orders.find(o => o.id === selectedOrder.value!.id)
    if (updated) {
      selectedOrder.value = updated
    }
  }
}, { deep: true })
</script>
