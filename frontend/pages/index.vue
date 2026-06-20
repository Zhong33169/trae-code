<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">📊 综合大屏 · 新闻线索中心</h2>
      <div class="text-muted text-sm">当前角色：<span class="badge-role" :class="`badge-${authStore.role}`">{{ authStore.user?.roleLabel }}</span>，数据每 30 秒自动刷新</div>
    </div>

    <div class="big-stat-grid">
      <div class="big-stat">
        <div class="label">线索单总数</div>
        <div class="num">{{ stats?.total || 0 }}</div>
      </div>
      <div class="big-stat l2">
        <div class="label">已归档</div>
        <div class="num">{{ stats?.archived || 0 }}</div>
      </div>
      <div class="big-stat l3">
        <div class="label">今日新增</div>
        <div class="num">{{ stats?.todayNew || 0 }}</div>
      </div>
      <div class="big-stat l4">
        <div class="label">异常（逾期/冲突）</div>
        <div class="num">{{ stats?.overdue || 0 }}</div>
      </div>
    </div>

    <div class="dashboard">
      <div class="panel">
        <div class="card">
          <div class="card-title">各状态线索单分布
            <button class="btn btn-sm" @click="refresh">🔄 刷新</button>
          </div>
          <div class="stat-grid">
            <div v-for="(cnt, name) in stats?.byStatus || {}" :key="name" class="stat-card"
              :class="statusStyle(name)">
              <div class="label">{{ name }}</div>
              <div class="value">{{ cnt }}</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">按角色维度待办</div>
          <div class="stat-grid">
            <div class="stat-card"><div class="label">📝 登记员待办</div><div class="value">{{ stats?.byRole?.['登记员待办'] || 0 }}</div></div>
            <div class="stat-card success"><div class="label">🔍 审核主管待办</div><div class="value">{{ stats?.byRole?.['审核主管待办'] || 0 }}</div></div>
            <div class="stat-card warning"><div class="label">📋 复核负责人待办</div><div class="value">{{ stats?.byRole?.['复核负责人待办'] || 0 }}</div></div>
            <div class="stat-card danger"><div class="label">⚠️ 申诉处理中</div><div class="value">{{ stats?.appealing || 0 }}</div></div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="card">
          <div class="card-title">
            最近线索单
            <NuxtLink to="/clues" class="btn btn-sm btn-primary">查看全部 →</NuxtLink>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>标题</th><th>状态</th><th>登记人</th><th>创建时间</th></tr></thead>
              <tbody>
                <tr v-for="item in recentList" :key="item.id" @click="goDetail(item.id)" style="cursor:pointer;">
                  <td style="max-width:260px;">
                    <div style="font-weight:500;">{{ item.title }}</div>
                    <div class="text-muted text-sm" style="margin-top:4px;">{{ (item.content || '').slice(0, 40) }}{{ (item.content || '').length > 40 ? '...' : '' }}</div>
                  </td>
                  <td><span class="tag" :class="`tag-${item.status}`">{{ item.statusLabel }}</span></td>
                  <td>{{ item.registrarName }}</td>
                  <td class="text-sm text-muted">{{ fmtTime(item.createdAt) }}</td>
                </tr>
                <tr v-if="!recentList.length"><td colspan="4" class="empty">暂无数据</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-title">办理边界说明（谁能办 · 谁只能看）</div>
          <div style="font-size:13px;line-height:1.9;color:var(--gray-700);">
            <p><span class="badge-role badge-registrar">登记员</span> 可：<b>创建线索单、补充证据、提交/补正重提、发起异常申诉</b>；仅可查看本人登记的单据。</p>
            <p><span class="badge-role badge-auditor">审核主管</span> 可：<b>核实分派、开始核实、标记缺证据、退回补正、完成核实提交复核</b>；可查看待分派/已分派给自己的单据。</p>
            <p><span class="badge-role badge-reviewer">复核负责人</span> 可：<b>复核归档、标记逾期、标记状态冲突、受理/驳回申诉</b>；可查看所有线索单，重点关注复核和申诉队列。</p>
            <p>流程：<b>线索爆料（登记员）→ 核实分派（审核主管）→ 回访归档（复核负责人）</b>，全程留痕。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const { get } = useApi()
const stats = ref<any>({})
const recentList = ref<any[]>([])

const refresh = async () => {
  try {
    stats.value = await get('/api/stats')
    const list = await get<any[]>('/api/clues')
    recentList.value = list.slice(0, 8)
  } catch (e: any) {
    if (e?.status === 403) {
      stats.value = {}
      recentList.value = []
    }
    console.error(e)
  }
}

const goDetail = (id: string) => navigateTo(`/clues/${id}`)

const statusStyle = (name: string) => {
  if (name.includes('归档')) return 'success'
  if (name.includes('逾期') || name.includes('冲突') || name.includes('退回') || name.includes('驳回')) return 'danger'
  if (name.includes('缺证据') || name.includes('申诉')) return 'warning'
  return ''
}

const fmtTime = (t: string) => t ? t.replace('T', ' ').slice(0, 16) : '-'

const onForbidden = () => { stats.value = {}; recentList.value = [] }
const onConflict = () => { refresh() }

onMounted(() => {
  refresh()
  if (typeof window !== 'undefined') {
    window.addEventListener('api:forbidden', onForbidden)
    window.addEventListener('api:conflict', onConflict)
  }
})
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('api:forbidden', onForbidden)
    window.removeEventListener('api:conflict', onConflict)
  }
})
</script>
