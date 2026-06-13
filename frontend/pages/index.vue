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

      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
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
              <td colspan="11" class="text-center" style="padding: 32px; color: #9ca3af;">加载中...</td>
            </tr>
            <tr v-else-if="!list.length">
              <td colspan="11" class="text-center" style="padding: 32px; color: #9ca3af;">暂无数据</td>
            </tr>
            <tr v-else v-for="item in list" :key="item.id">
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import type { MembershipOrder, OrderStatus } from '~/types'
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

onMounted(() => {
  if (!auth.state.user) {
    router.push('/login')
    return
  }
  loadList()
  loadStats()
})
</script>
