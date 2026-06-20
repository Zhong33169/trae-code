<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">📋 线索单管理</h2>
      <div>
        <span class="text-sm text-muted" style="margin-right:12px;">
          当前角色：<span class="badge-role" :class="`badge-${authStore.role}`">{{ authStore.roleLabel }}</span>
          <span style="margin-left:6px;">· {{ roleScopeTip }}</span>
        </span>
        <button v-if="authStore.isRegistrar" class="btn btn-primary" @click="navigateTo('/clues/new')">➕ 新建线索单</button>
        &nbsp;
        <button class="btn btn-sm" @click="loadList">🔄 刷新</button>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="form-row" style="flex:1;min-width:220px;">
          <input v-model="filters.keyword" class="form-input" placeholder="🔍 搜索标题/内容/来源" @input="loadList" />
        </div>
        <div class="form-row">
          <select v-model="filters.status" class="form-select" @change="loadList">
            <option value="">全部状态</option>
            <option v-for="s in statusList" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
        <div class="form-row">
          <select v-model="filters.role" class="form-select" @change="loadList">
            <option value="">按办理维度</option>
            <option value="registrar">📝 登记员相关</option>
            <option value="auditor">🔍 审核主管相关</option>
            <option value="reviewer">📋 复核负责人相关</option>
          </select>
        </div>
      </div>

      <div class="stat-grid" style="margin-top:4px;">
        <div v-for="s in statusOverview" :key="s.label" class="stat-card" :class="s.cls" @click="filters.status=s.value;loadList()" style="cursor:pointer;">
          <div class="label">{{ s.label }}</div>
          <div class="value">{{ s.cnt }}</div>
        </div>
      </div>

      <div class="table-wrap" style="margin-top:14px;">
        <table>
          <thead>
            <tr>
              <th>标题</th>
              <th>状态</th>
              <th>优先级</th>
              <th>登记人</th>
              <th>审核人</th>
              <th>最后处理</th>
              <th>创建时间</th>
              <th style="text-align:right;">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in list" :key="item.id">
              <td style="max-width:320px;">
                <div style="font-weight:500;">{{ item.title }}</div>
                <div class="text-muted text-sm" style="margin-top:3px;">{{ (item.content || '').slice(0, 50) }}{{ (item.content || '').length > 50 ? '...' : '' }}</div>
              </td>
              <td><span class="tag" :class="`tag-${item.status}`">{{ item.statusLabel }}</span></td>
              <td class="text-sm">{{ priorityLabel(item.priority) }}</td>
              <td class="text-sm">{{ item.registrarName }}</td>
              <td class="text-sm">{{ item.auditorName || '—' }}</td>
              <td>
                <div v-if="item.lastHandlerName" class="text-sm">
                  <div>{{ item.lastHandlerName }} · <span class="badge-role" :class="roleBadgeClsByLabel(item.lastHandlerName, item)">{{ lastRoleLabel(item) }}</span></div>
                  <div class="text-muted" style="margin-top:2px;">{{ item.lastResult || '—' }}</div>
                </div>
                <span v-else class="text-muted">—</span>
              </td>
              <td class="text-sm text-muted">{{ fmtTime(item.createdAt) }}</td>
              <td style="text-align:right;">
                <button class="btn btn-sm btn-primary" @click="navigateTo(`/clues/${item.id}`)">查看详情</button>
              </td>
            </tr>
            <tr v-if="!list.length">
              <td colspan="8" class="empty">暂无数据，可调整筛选条件或新建线索单</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const { get } = useApi()

const statusList = [
  { value: 'draft', label: '草稿' },
  { value: 'submitted', label: '待核实分派' },
  { value: 'resubmitted', label: '补正重提' },
  { value: 'assigned', label: '已分派' },
  { value: 'verifying', label: '核实中' },
  { value: 'lack_evidence', label: '缺证据' },
  { value: 'returned', label: '退回补正' },
  { value: 'overdue', label: '逾期' },
  { value: 'status_conflict', label: '状态冲突' },
  { value: 'appealed', label: '异常申诉中' },
  { value: 'appeal_accepted', label: '申诉已受理' },
  { value: 'appeal_rejected', label: '申诉已驳回' },
  { value: 'archived', label: '已归档' }
]

const filters = reactive({ keyword: '', status: '', role: '' })
const list = ref<any[]>([])
const stats = ref<any>({})

const loadList = async () => {
  try {
    const q = new URLSearchParams()
    if (filters.keyword) q.set('keyword', filters.keyword)
    if (filters.status) q.set('status', filters.status)
    if (filters.role) q.set('role', filters.role)
    list.value = await get<any[]>(`/api/clues${q.toString() ? '?' + q.toString() : ''}`)
    stats.value = await get<any>('/api/stats')
  } catch (e: any) {
    if (e?.status === 403) {
      list.value = []
      stats.value = {}
    }
    console.error(e)
  }
}

const statusOverview = computed(() => {
  const s = stats.value?.byStatus || {}
  return [
    { label: '待核实分派', value: 'submitted', cls: 'info', cnt: s['待核实分派'] || 0 },
    { label: '核实中', value: 'verifying', cls: '', cnt: s['核实中'] || 0 },
    { label: '退回补正', value: 'returned', cls: 'danger', cnt: s['退回补正'] || 0 },
    { label: '缺证据', value: 'lack_evidence', cls: 'warning', cnt: s['缺证据'] || 0 },
    { label: '申诉中', value: 'appealed', cls: 'warning', cnt: s['异常申诉中'] || 0 },
    { label: '逾期/冲突', value: 'overdue', cls: 'danger', cnt: (s['逾期'] || 0) + (s['状态冲突'] || 0) },
    { label: '已归档', value: 'archived', cls: 'success', cnt: s['已归档'] || 0 }
  ]
})

const priorityLabel = (p: string) => ({ high: '🔴 高', normal: '🟡 中', low: '🟢 低' }[p || 'normal'] || '🟡 中')
const fmtTime = (t: string) => t ? t.replace('T', ' ').slice(0, 16) : '-'

const roleBadgeClsByLabel = (_name: string, item: any) => {
  // 简化：根据当前状态推断最后处理人角色
  const cur = item.status
  if (['archived', 'overdue', 'status_conflict', 'appeal_accepted', 'appeal_rejected'].includes(cur)) return 'badge-reviewer'
  if (['assigned', 'verifying', 'lack_evidence', 'returned'].includes(cur)) return 'badge-auditor'
  return 'badge-registrar'
}
const lastRoleLabel = (item: any) => {
  const cur = item.status
  if (['archived', 'overdue', 'status_conflict', 'appeal_accepted', 'appeal_rejected'].includes(cur)) return '复核负责人'
  if (['assigned', 'verifying', 'lack_evidence', 'returned'].includes(cur)) return '审核主管'
  return '线索登记员'
}

const roleScopeTip = computed(() => {
  if (authStore.isRegistrar) return '仅查看您登记的线索单'
  if (authStore.isAuditor) return '查看分派给您的及待分派队列'
  if (authStore.isReviewer) return '查看全部线索单'
  return ''
})

onMounted(() => {
  loadList()
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadList()
  })
})
</script>
