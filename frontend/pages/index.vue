<template>
  <div class="page">
    <div class="card">
      <div class="flex-between mb-4">
        <h2 class="card-title" style="margin-bottom: 0;">会员入会单管理</h2>
        <div class="flex gap-2">
          <button class="btn" @click="resetFilters">重置筛选</button>
          <button
            v-if="auth.isRegistrar.value"
            class="btn btn-primary"
            @click="showCreateModal = true"
          >+ 新建入会单</button>
        </div>
      </div>

      <div class="stats">
        <div class="stat-card warning">
          <div class="stat-label">待审核办理</div>
          <div class="stat-value">{{ stats.pending }}</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">附件缺失待补正</div>
          <div class="stat-value">{{ stats.missing }}</div>
        </div>
        <div class="stat-card info">
          <div class="stat-label">待复核归档</div>
          <div class="stat-value">{{ stats.review }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">已归档</div>
          <div class="stat-value">{{ stats.archived }}</div>
        </div>
      </div>

      <div class="filters">
        <div class="filter-item">
          <label>单据状态</label>
          <select v-model="filters.status" class="form-select">
            <option value="">全部状态</option>
            <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div class="filter-item">
          <label>异常类型</label>
          <select v-model="filters.is_overdue_str" class="form-select">
            <option value="">全部</option>
            <option value="normal">正常单据</option>
            <option value="overdue">超时未处理</option>
            <option value="missing">附件缺失</option>
            <option value="rejected">已驳回</option>
          </select>
        </div>
        <div class="filter-item">
          <label>关键词搜索</label>
          <input
            v-model="filters.keyword"
            class="form-input"
            placeholder="会员姓名 / 手机号 / 单号"
          />
        </div>
        <div class="filter-item">
          <button class="btn btn-primary" @click="loadList">查询</button>
        </div>
      </div>

      <div v-if="selectedIds.length > 0" class="batch-bar">
        <div class="batch-info">
          已选择 <span class="font-bold text-primary">{{ selectedIds.length }}</span> 条
          <button class="btn btn-sm" @click="clearSelection">取消选择</button>
        </div>
        <div class="flex gap-2" style="flex-wrap: wrap;">
          <button
            v-if="auth.isRegistrar.value && canBatchSubmit"
            class="btn btn-sm btn-primary"
            :disabled="batchLoading"
            @click="handleBatchSubmit"
          >📤 批量提交</button>
          <button
            v-if="auth.isSupervisor.value && canBatchApprove"
            class="btn btn-sm btn-success"
            :disabled="batchLoading"
            @click="handleBatchApprove"
          >✅ 批量审核通过</button>
          <button
            v-if="auth.isSupervisor.value && canBatchApprove"
            class="btn btn-sm btn-warning"
            :disabled="batchLoading"
            @click="showBatchSupplementModal = true"
          >📝 批量退回补正</button>
          <button
            v-if="auth.isSupervisor.value && canBatchApprove"
            class="btn btn-sm btn-danger"
            :disabled="batchLoading"
            @click="showBatchRejectModal = true"
          >❌ 批量驳回</button>
          <button
            v-if="auth.isReviewer.value && canBatchReview"
            class="btn btn-sm btn-primary"
            :disabled="batchLoading"
            @click="handleBatchReview"
          >🔍 批量复核</button>
          <button
            v-if="auth.isReviewer.value && canBatchArchive"
            class="btn btn-sm btn-success"
            :disabled="batchLoading"
            @click="handleBatchArchive"
          >📦 批量归档</button>
        </div>
      </div>

      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th style="width: 40px;">
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  @change="toggleSelectAll"
                  :disabled="loading || !list.length"
                />
              </th>
              <th>入会单号</th>
              <th>会员姓名</th>
              <th>手机号</th>
              <th>会员类型</th>
              <th>金额(元)</th>
              <th>附件</th>
              <th>合同</th>
              <th>卡权益</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="12" class="text-center" style="padding: 32px; color: #9ca3af;">加载中...</td>
            </tr>
            <tr v-else-if="!list.length">
              <td colspan="12" class="text-center" style="padding: 32px; color: #9ca3af;">暂无数据</td>
            </tr>
            <tr v-else v-for="item in list" :key="item.id" :class="{ 'row-selected': isSelected(item.id) }">
              <td>
                <input
                  type="checkbox"
                  :checked="isSelected(item.id)"
                  @change="toggleSelect(item.id)"
                />
              </td>
              <td>
                <a class="font-bold" style="color: #2563eb; cursor: pointer;" @click="goDetail(item.id)">
                  {{ item.order_no }}
                </a>
              </td>
              <td class="font-bold">{{ item.member_name }}</td>
              <td>{{ item.member_phone || '-' }}</td>
              <td>{{ item.membership_type }} · {{ item.membership_duration }}天</td>
              <td>¥{{ item.amount }}</td>
              <td>
                <span :class="providedCount(item) === 4 ? 'text-success' : 'text-danger'" class="font-bold">
                  {{ providedCount(item) }}/4
                </span>
              </td>
              <td>
                <span v-if="item.contract_confirmed" class="badge badge-green">已确认</span>
                <span v-else class="badge badge-gray">未确认</span>
              </td>
              <td>
                <span v-if="item.card_activated" class="badge badge-green">已启用</span>
                <span v-else class="badge badge-gray">未启用</span>
              </td>
              <td>
                <div class="flex gap-2" style="flex-wrap: wrap;">
                  <span
                    class="badge"
                    :class="statusBadgeClass(item.status)"
                  >{{ STATUS_LABELS[item.status] }}</span>
                  <span v-if="item.is_overdue" class="badge badge-red">超时</span>
                </div>
              </td>
              <td class="text-muted text-sm">{{ formatDate(item.created_at) }}</td>
              <td>
                <button class="btn btn-sm btn-primary" @click="goDetail(item.id)">详情处理</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="text-muted text-sm mt-4" style="text-align: right;">
        共 {{ total }} 条记录
      </div>
    </div>

    <div v-if="showCreateModal" class="modal-mask" @click.self="showCreateModal = false">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">新建会员入会单</div>
          <button class="modal-close" @click="showCreateModal = false">×</button>
        </div>
        <div>
          <div class="form-group">
            <label class="form-label">会员姓名 <span class="text-danger">*</span></label>
            <input v-model="createForm.member_name" class="form-input" placeholder="请输入会员姓名" />
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">手机号</label>
              <input v-model="createForm.member_phone" class="form-input" placeholder="请输入手机号" />
            </div>
            <div class="form-group">
              <label class="form-label">身份证号</label>
              <input v-model="createForm.member_id_no" class="form-input" placeholder="请输入身份证号" />
            </div>
          </div>
          <div class="grid-3">
            <div class="form-group">
              <label class="form-label">会员类型 <span class="text-danger">*</span></label>
              <select v-model="createForm.membership_type" class="form-select">
                <option value="月卡">月卡</option>
                <option value="季卡">季卡</option>
                <option value="半年卡">半年卡</option>
                <option value="年卡">年卡</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">时长(天) <span class="text-danger">*</span></label>
              <input v-model.number="createForm.membership_duration" type="number" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">金额(元) <span class="text-danger">*</span></label>
              <input v-model.number="createForm.amount" type="number" class="form-input" />
            </div>
          </div>
          <div class="alert alert-info">
            注意：创建后请进入详情页上传附件（身份证、照片、健康证明、合同）并提交审核。
          </div>
          <div v-if="createError" class="alert alert-danger">{{ createError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showCreateModal = false">取消</button>
          <button class="btn btn-primary" :disabled="createLoading" @click="handleCreate">
            {{ createLoading ? '创建中...' : '创建入会单' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 批量结果弹窗 -->
    <div v-if="showBatchResultModal" class="modal-mask" @click.self="showBatchResultModal = false">
      <div class="modal modal-lg">
        <div class="modal-header">
          <div class="modal-title">
            批量处理结果
            <span class="ml-2" style="font-size: 14px; font-weight: normal;">
              共 {{ batchResult?.total }} 条 ·
              <span class="text-success">成功 {{ batchResult?.success_count }}</span> ·
              <span class="text-danger">失败 {{ batchResult?.fail_count }}</span>
            </span>
          </div>
          <button class="modal-close" @click="handleCloseBatchResult">×</button>
        </div>
        <div style="max-height: 500px; overflow-y: auto;">
          <table class="batch-result-table">
            <thead>
              <tr>
                <th>状态</th>
                <th>入会单号</th>
                <th>会员姓名</th>
                <th>当前状态</th>
                <th>合同</th>
                <th>卡权益</th>
                <th>审计编号</th>
                <th>原因</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in batchResult?.results" :key="r.order_id" :class="r.success ? 'row-success' : 'row-fail'">
                <td>
                  <span v-if="r.success" class="text-success font-bold">✅ 成功</span>
                  <span v-else class="text-danger font-bold">❌ 失败</span>
                </td>
                <td class="font-bold">{{ r.order_no || '-' }}</td>
                <td>{{ r.member_name || '-' }}</td>
                <td>
                  <span class="badge" :class="statusBadgeClass(r.status as any)">{{ r.status ? STATUS_LABELS[r.status as OrderStatus] || r.status : '-' }}</span>
                </td>
                <td>
                  <span v-if="r.contract_confirmed" class="badge badge-green">已确认</span>
                  <span v-else class="badge badge-gray">未确认</span>
                </td>
                <td>
                  <span v-if="r.card_activated" class="badge badge-green">已启用</span>
                  <span v-else class="badge badge-gray">未启用</span>
                </td>
                <td class="text-muted">{{ r.audit_log_id || '-' }}</td>
                <td style="max-width: 300px;">
                  <span v-if="r.reject_reason" class="text-danger" style="font-size: 12px;">{{ r.reject_reason }}</span>
                  <span v-else class="text-muted">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="handleCloseBatchResult">确定</button>
        </div>
      </div>
    </div>

    <!-- 批量驳回弹窗 -->
    <div v-if="showBatchRejectModal" class="modal-mask" @click.self="showBatchRejectModal = false">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">批量驳回（{{ selectedIds.length }} 条）</div>
          <button class="modal-close" @click="showBatchRejectModal = false">×</button>
        </div>
        <div>
          <div class="alert alert-warning">
            选中的 {{ selectedIds.length }} 条入会单将被批量驳回，且不可恢复，请确认。
          </div>
          <div class="form-group">
            <label class="form-label">驳回原因 <span class="text-danger">*</span></label>
            <textarea
              v-model="batchRejectReason"
              class="form-textarea"
              rows="4"
              placeholder="请输入统一的驳回原因..."
            ></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">备注</label>
            <input v-model="batchRejectRemark" class="form-input" placeholder="可选" />
          </div>
          <div v-if="batchError" class="alert alert-danger">{{ batchError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showBatchRejectModal = false">取消</button>
          <button class="btn btn-danger" :disabled="batchLoading" @click="handleBatchReject">
            {{ batchLoading ? '处理中...' : '确认驳回' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 批量退回补正弹窗（简化版 - 统一原因） -->
    <div v-if="showBatchSupplementModal" class="modal-mask" @click.self="showBatchSupplementModal = false">
      <div class="modal modal-lg">
        <div class="modal-header">
          <div class="modal-title">批量退回补正（{{ selectedOrders.length }} 条）</div>
          <button class="modal-close" @click="showBatchSupplementModal = false">×</button>
        </div>
        <div style="max-height: 500px; overflow-y: auto;">
          <div class="alert alert-info">
            请为每笔入会单选择需退回的附件并填写补正原因。
          </div>
          <div v-for="order in selectedOrders" :key="order.id" class="batch-supplement-order">
            <div class="batch-supplement-order-title">
              <span class="font-bold">{{ order.order_no }}</span>
              <span class="text-muted">· {{ order.member_name }}</span>
              <span class="badge" :class="statusBadgeClass(order.status)" style="margin-left: auto;">{{ STATUS_LABELS[order.status] }}</span>
            </div>
            <div class="batch-supplement-items">
              <div
                v-for="req in order.required_attachments"
                :key="req.id"
                class="supplement-item"
                :class="{ active: isBatchSupplementSelected(order.id, req.id) }"
              >
                <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; width: 100%;">
                  <input
                    type="checkbox"
                    :checked="isBatchSupplementSelected(order.id, req.id)"
                    @change="toggleBatchSupplementItem(order.id, req.id)"
                    style="margin-top: 4px;"
                  />
                  <div style="flex: 1;">
                    <div class="font-bold" style="font-size: 13px;">
                      {{ req.attachment_name }}
                      <span v-if="req.is_provided" class="text-success" style="font-size: 12px; font-weight: normal;">（已提供）</span>
                      <span v-else class="text-danger" style="font-size: 12px; font-weight: normal;">（缺失）</span>
                    </div>
                    <div v-if="req.reject_reason" class="text-danger" style="font-size: 12px; margin-top: 4px;">
                      历史退回：{{ firstLineOfReason(req.reject_reason) }}
                    </div>
                    <div v-if="isBatchSupplementSelected(order.id, req.id)" style="margin-top: 8px;">
                      <input
                        v-model="batchSupplementReasons[`${order.id}_${req.id}`]"
                        class="form-input"
                        placeholder="请输入退回原因（如：照片模糊，请重新提交）"
                        style="font-size: 13px;"
                      />
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
          <div v-if="batchError" class="alert alert-danger mt-3">{{ batchError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showBatchSupplementModal = false">取消</button>
          <button class="btn btn-warning" :disabled="batchLoading" @click="handleBatchSupplement">
            {{ batchLoading ? '处理中...' : '确认退回补正' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import type { MembershipOrder, OrderStatus, BatchResponse, BatchItemResult } from '~/types'
import { STATUS_LABELS } from '~/types'

const auth = useAuth()
const orders = useOrders()
const router = useRouter()

const list = ref<MembershipOrder[]>([])
const total = ref(0)
const loading = ref(false)

const filters = reactive({
  status: '' as OrderStatus | '',
  is_overdue_str: '' as '' | 'normal' | 'overdue' | 'missing' | 'rejected',
  keyword: ''
})

const stats = reactive({
  pending: 0,
  missing: 0,
  review: 0,
  archived: 0
})

const selectedIds = ref<number[]>([])

const batchLoading = ref(false)
const batchError = ref('')
const batchResult = ref<BatchResponse | null>(null)
const showBatchResultModal = ref(false)
const showBatchRejectModal = ref(false)
const showBatchSupplementModal = ref(false)
const batchRejectReason = ref('')
const batchRejectRemark = ref('')
const batchSupplementReasons = reactive<Record<string, string>>({})
const batchSupplementItems = reactive<Record<string, boolean>>({})

const isAllSelected = computed(() => {
  if (!list.value.length) return false
  return list.value.every(item => selectedIds.value.includes(item.id))
})

const selectedOrders = computed(() => {
  return list.value.filter(item => selectedIds.value.includes(item.id))
})

const canBatchSubmit = computed(() => {
  return selectedOrders.value.some(o =>
    o.status === 'draft' || o.status === 'materials_missing'
  )
})

const canBatchApprove = computed(() => {
  return selectedOrders.value.some(o =>
    o.status === 'pending_review' || o.status === 'resubmitted'
  )
})

const canBatchReview = computed(() => {
  return selectedOrders.value.some(o => o.status === 'approved_review')
})

const canBatchArchive = computed(() => {
  return selectedOrders.value.some(o => o.status === 'reviewed')
})

const showCreateModal = ref(false)
const createLoading = ref(false)
const createError = ref('')
const createForm = reactive({
  member_name: '',
  member_phone: '',
  member_id_no: '',
  membership_type: '年卡',
  membership_duration: 365,
  amount: 2880
})

function providedCount(item: MembershipOrder) {
  return item.required_attachments.filter(r => r.is_provided).length
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

function formatDate(s: string) {
  if (!s) return ''
  const d = new Date(s)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function loadStats() {
  try {
    const [pend, miss, rev, arch] = await Promise.all([
      orders.fetchList({ status: 'pending_review' as any }),
      orders.fetchList({ status: 'materials_missing' as any }),
      orders.fetchList({ status: 'approved_review' as any }),
      orders.fetchList({ status: 'archived' as any }),
    ])
    stats.pending = pend.total
    stats.missing = miss.total
    stats.review = rev.total
    stats.archived = arch.total
  } catch (e) {}
}

async function loadList() {
  loading.value = true
  try {
    const params: any = {
      status: filters.status || undefined,
      keyword: filters.keyword || undefined
    }
    if (filters.is_overdue_str === 'overdue') {
      params.is_overdue = true
    } else if (filters.is_overdue_str === 'missing') {
      params.status = 'materials_missing'
    } else if (filters.is_overdue_str === 'rejected') {
      params.status = 'rejected'
    }
    const res = await orders.fetchList(params)
    list.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.status = ''
  filters.is_overdue_str = ''
  filters.keyword = ''
  loadList()
}

function goDetail(id: number) {
  router.push(`/orders/${id}`)
}

async function handleCreate() {
  if (!createForm.member_name) {
    createError.value = '请输入会员姓名'
    return
  }
  if (!createForm.membership_duration || createForm.membership_duration <= 0) {
    createError.value = '请输入有效的会员时长'
    return
  }
  if (!createForm.amount || createForm.amount <= 0) {
    createError.value = '请输入有效的金额'
    return
  }
  createLoading.value = true
  createError.value = ''
  try {
    const data = { ...createForm }
    if (!data.member_phone) delete (data as any).member_phone
    if (!data.member_id_no) delete (data as any).member_id_no
    const order = await orders.createOrder(data)
    showCreateModal.value = false
    loadList()
    loadStats()
    goDetail(order.id)
  } catch (e: any) {
    createError.value = e?.data?.detail || '创建失败'
  } finally {
    createLoading.value = false
  }
}

function isSelected(id: number) {
  return selectedIds.value.includes(id)
}

function toggleSelect(id: number) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(id)
  }
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = list.value.map(item => item.id)
  }
}

function clearSelection() {
  selectedIds.value = []
}

function firstLineOfReason(reason: string | null) {
  if (!reason) return ''
  return reason.split('\n')[0]
}

function isBatchSupplementSelected(orderId: number, reqId: number) {
  return !!batchSupplementItems[`${orderId}_${reqId}`]
}

function toggleBatchSupplementItem(orderId: number, reqId: number) {
  const key = `${orderId}_${reqId}`
  batchSupplementItems[key] = !batchSupplementItems[key]
  if (!batchSupplementItems[key]) {
    delete batchSupplementReasons[key]
  }
}

async function handleBatchSubmit() {
  batchLoading.value = true
  batchError.value = ''
  try {
    const res = await orders.batchSubmit(selectedIds.value)
    batchResult.value = res
    showBatchResultModal.value = true
  } catch (e: any) {
    batchError.value = e?.data?.detail || '批量提交失败'
  } finally {
    batchLoading.value = false
  }
}

async function handleBatchApprove() {
  batchLoading.value = true
  batchError.value = ''
  try {
    const res = await orders.batchApprove(selectedIds.value)
    batchResult.value = res
    showBatchResultModal.value = true
  } catch (e: any) {
    batchError.value = e?.data?.detail || '批量审核失败'
  } finally {
    batchLoading.value = false
  }
}

async function handleBatchReject() {
  if (!batchRejectReason.value.trim()) {
    batchError.value = '请填写驳回原因'
    return
  }
  batchLoading.value = true
  batchError.value = ''
  try {
    const res = await orders.batchReject(selectedIds.value, batchRejectReason.value, batchRejectRemark.value)
    batchResult.value = res
    showBatchRejectModal.value = false
    showBatchResultModal.value = true
  } catch (e: any) {
    batchError.value = e?.data?.detail || '批量驳回失败'
  } finally {
    batchLoading.value = false
  }
}

async function handleBatchSupplement() {
  const ordersData: any[] = []
  for (const order of selectedOrders.value) {
    const items: any[] = []
    for (const req of order.required_attachments) {
      const key = `${order.id}_${req.id}`
      if (batchSupplementItems[key]) {
        items.push({
          required_attachment_id: req.id,
          reject_reason: batchSupplementReasons[key]?.trim() || undefined
        })
      }
    }
    if (items.length > 0) {
      ordersData.push({ order_id: order.id, items })
    }
  }
  if (ordersData.length === 0) {
    batchError.value = '请至少为一笔订单选择需退回的附件'
    return
  }
  batchLoading.value = true
  batchError.value = ''
  try {
    const res = await orders.batchRequestSupplement(ordersData)
    batchResult.value = res
    showBatchSupplementModal.value = false
    showBatchResultModal.value = true
  } catch (e: any) {
    batchError.value = e?.data?.detail || '批量退回补正失败'
  } finally {
    batchLoading.value = false
  }
}

async function handleBatchReview() {
  batchLoading.value = true
  batchError.value = ''
  try {
    const res = await orders.batchReview(selectedIds.value)
    batchResult.value = res
    showBatchResultModal.value = true
  } catch (e: any) {
    batchError.value = e?.data?.detail || '批量复核失败'
  } finally {
    batchLoading.value = false
  }
}

async function handleBatchArchive() {
  batchLoading.value = true
  batchError.value = ''
  try {
    const res = await orders.batchArchive(selectedIds.value)
    batchResult.value = res
    showBatchResultModal.value = true
  } catch (e: any) {
    batchError.value = e?.data?.detail || '批量归档失败'
  } finally {
    batchLoading.value = false
  }
}

function handleCloseBatchResult() {
  showBatchResultModal.value = false
  batchResult.value = null
  clearSelection()
  loadList()
  loadStats()
}

onMounted(() => {
  if (!auth.state.user) {
    router.push('/login')
    return
  }
  loadList()
  loadStats()
})
</script>
