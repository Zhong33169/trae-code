<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">
        <button class="btn btn-sm" @click="navigateTo('/clues')">← 返回列表</button>
        &nbsp; 线索单详情
        <span class="tag" :class="`tag-${data?.status}`" style="margin-left:10px;">{{ data?.statusLabel }}</span>
        <span class="text-muted text-sm" style="margin-left:8px;">版本 v{{ data?.version }}</span>
      </h2>
    </div>

    <div v-if="!data" class="card empty">加载中...</div>

    <div v-else>
      <div class="card">
        <div class="detail-section">
          <h3>📌 基本信息</h3>
          <div class="detail-grid">
            <div class="item"><div class="k">线索单编号</div><div class="v">{{ data.id }}</div></div>
            <div class="item"><div class="k">优先级</div><div class="v">{{ priorityLabel(data.priority) }}</div></div>
            <div class="item" style="grid-column: span 2;"><div class="k">线索标题</div><div class="v" style="font-size:15px;">{{ data.title }}</div></div>
            <div class="item" style="grid-column: span 2;"><div class="k">线索内容</div><div class="v" style="white-space:pre-wrap;line-height:1.7;">{{ data.content }}</div></div>
            <div class="item"><div class="k">信息来源</div><div class="v">{{ data.source || '—' }}</div></div>
            <div class="item"><div class="k">发生地点</div><div class="v">{{ data.location || '—' }}</div></div>
            <div class="item"><div class="k">联系人</div><div class="v">{{ data.contactPerson || '—' }}</div></div>
            <div class="item"><div class="k">联系电话</div><div class="v">{{ data.contactPhone || '—' }}</div></div>
            <div class="item"><div class="k">标签</div><div class="v">{{ data.tags || '—' }}</div></div>
          </div>
        </div>

        <div class="detail-section">
          <h3>🔗 证据材料（{{ data.evidences?.length || 0 }}份）</h3>
          <div v-if="!data.evidences?.length" class="text-muted text-sm">暂无证据材料</div>
          <div v-else class="stat-grid">
            <div v-for="e in data.evidences" :key="e.id" class="stat-card">
              <div class="label">{{ typeLabel(e.type) }} · 编号 {{ e.id?.slice(0, 8) }}</div>
              <div class="value" style="font-size:15px;">{{ e.name }}</div>
              <div class="text-muted text-sm" style="margin-top:4px;">{{ e.desc || '—' }}</div>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h3>👥 办理分工与最近处理意见</h3>
          <div class="detail-grid">
            <div class="item"><div class="k">📝 登记人</div><div class="v">{{ data.registrarName }} <span class="badge-role badge-registrar">线索登记员</span></div></div>
            <div class="item"><div class="k">🔍 审核人</div><div class="v">{{ data.auditorName || '（暂未分派）' }} <span v-if="data.auditorName" class="badge-role badge-auditor">审核主管</span></div></div>
            <div class="item"><div class="k">📋 复核人</div><div class="v">{{ data.reviewerName || '（待归档时确定）' }} <span v-if="data.reviewerName" class="badge-role badge-reviewer">复核负责人</span></div></div>
            <div class="item"><div class="k">办理时限</div><div class="v">{{ fmtTime(data.dueAt) }} <span v-if="isOverdue(data.dueAt)" style="color:var(--danger);">（已逾期）</span></div></div>
            <div class="item" style="grid-column: span 2;">
              <div class="k">最近处理人</div>
              <div class="v">
                <b>{{ data.lastHandlerName || '—' }}</b>
                <span v-if="data.lastResult" style="margin-left:8px;">· {{ data.lastResult }}</span>
              </div>
            </div>
            <div class="item" style="grid-column: span 2;">
              <div class="k">最近处理意见/结果</div>
              <div class="v" style="white-space:pre-wrap;line-height:1.7;background:var(--gray-50);padding:10px 12px;border-radius:6px;">
                {{ data.lastOpinion || '（暂无）' }}
              </div>
            </div>
          </div>
        </div>

        <div class="detail-section" v-if="data.appeals?.length">
          <h3>⚖️ 异常申诉记录（{{ data.appeals.length }}条）</h3>
          <div v-for="a in data.appeals" :key="a.id" class="card" style="background:var(--gray-50);margin-bottom:10px;">
            <div class="flex justify-between items-center mb-0">
              <div>
                <b>{{ a.appellantName }}</b>
                <span class="badge-role badge-registrar" style="margin:0 6px;">线索登记员</span>
                于 {{ fmtTime(a.createdAt) }} 发起申诉
              </div>
              <span class="tag" :class="appealStatusCls(a.status)">{{ appealStatusLabel(a.status) }}</span>
            </div>
            <div class="form-row" style="margin-top:10px;">
              <label>📝 申诉理由</label>
              <div style="white-space:pre-wrap;background:#fff;padding:10px;border-radius:6px;font-size:13px;line-height:1.7;">{{ a.reason }}</div>
            </div>
            <div v-if="a.reviewedAt" class="form-row">
              <label>📋 {{ a.reviewerName }} 复核意见</label>
              <div style="white-space:pre-wrap;background:#fff;padding:10px;border-radius:6px;font-size:13px;line-height:1.7;">
                {{ a.reviewOpinion }}
                <div v-if="a.rejectReason" style="margin-top:6px;color:var(--danger);"><b>驳回原因：</b>{{ a.rejectReason }}</div>
                <div class="text-sm text-muted" style="margin-top:6px;">复核时间：{{ fmtTime(a.reviewedAt) }} · 原状态：{{ origStatusLabel(a.originalStatus) }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h3>🕒 办理流水 & 状态变更（共 {{ data.operations?.length || 0 }} 条）</h3>
          <div class="timeline">
            <div v-for="op in data.operations" :key="op.id" class="timeline-item">
              <div class="tl-head">
                <span class="tl-action">{{ op.action }}</span>
                <span v-if="op.fromStatus" class="text-muted text-sm">
                  {{ statusLabelByKey(op.fromStatus) }} → <b>{{ statusLabelByKey(op.toStatus) }}</b>
                </span>
                <span class="tl-meta">
                  版本 v{{ op.versionBefore }}→v{{ op.versionAfter }} · {{ fmtTime(op.createdAt) }}
                </span>
              </div>
              <div class="tl-head">
                <span class="badge-role" :class="`badge-${op.operatorRole}`">{{ roleLabel(op.operatorRole) }}</span>
                <b>{{ op.operatorName }}</b>
              </div>
              <div v-if="op.comment || op.rejectReason || op.reviewOpinion" class="tl-body">
                <p v-if="op.comment"><span class="label">处理意见：</span>{{ op.comment }}</p>
                <p v-if="op.rejectReason" style="color:var(--danger);"><span class="label">驳回/缺证据原因：</span>{{ op.rejectReason }}</p>
                <p v-if="op.reviewOpinion" style="color:#5b21b6;"><span class="label">复核意见：</span>{{ op.reviewOpinion }}</p>
              </div>
            </div>
          </div>
        </div>

        <div v-if="availableActions.length">
          <div class="detail-section">
            <h3>⚡ 当前角色可执行操作</h3>
            <div class="text-sm text-muted" style="margin-bottom:10px;">
              当前登录：<b>{{ authStore.user?.realName }}</b>（<span class="badge-role" :class="`badge-${authStore.role}`">{{ authStore.user?.roleLabel }}</span>）
              · 系统按角色+状态+办理边界自动判断可执行项
            </div>
            <div class="action-bar">
              <button v-for="a in availableActions" :key="a.key" class="btn"
                :class="a.cls" @click="openAction(a)">
                {{ a.icon }} {{ a.label }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 动作对话框 -->
    <div v-if="currentAction" class="modal-mask" @click.self="currentAction=null">
      <div class="modal">
        <h3>{{ currentAction.icon }} {{ currentAction.label }}</h3>

        <!-- 分派 -->
        <template v-if="currentAction.key === 'assign'">
          <div class="form-row">
            <label>分派给审核主管<span class="req">*</span></label>
            <select v-model="form.auditorId" class="form-select">
              <option value="">请选择</option>
              <option v-for="u in auditors" :key="u.id" :value="u.id">{{ u.realName }}（@{{ u.username }}）</option>
            </select>
          </div>
          <div class="form-row">
            <label>办理时限（天）</label>
            <input v-model.number="form.dueDays" type="number" min="1" max="30" class="form-input" />
          </div>
          <div class="form-row">
            <label>分派说明/意见</label>
            <textarea v-model="form.comment" class="form-textarea" placeholder="请填写分派说明，填写核实重点、注意事项等"></textarea>
          </div>
        </template>

        <!-- 开始核实 -->
        <template v-else-if="currentAction.key === 'start_verify'">
          <div class="form-row">
            <label>备注</label>
            <textarea v-model="form.comment" class="form-textarea" placeholder="可填写核实计划（可选）"></textarea>
          </div>
        </template>

        <!-- 缺证据 -->
        <template v-else-if="currentAction.key === 'lack_evidence'">
          <div class="form-row">
            <label>缺少证据说明<span class="req">*</span></label>
            <textarea v-model="form.rejectReason" class="form-textarea" placeholder="请详细说明需要补充哪些证据材料，以便登记员补齐"></textarea>
          </div>
          <div class="form-row">
            <label>补充备注</label>
            <textarea v-model="form.comment" class="form-textarea" placeholder="可选"></textarea>
          </div>
        </template>

        <!-- 退回补正 -->
        <template v-else-if="currentAction.key === 'return_correct'">
          <div class="form-row">
            <label>退回原因<span class="req">*</span></label>
            <textarea v-model="form.rejectReason" class="form-textarea" placeholder="请详细说明退回补正原因及需要修改的内容"></textarea>
          </div>
          <div class="form-row">
            <label>处理意见</label>
            <textarea v-model="form.comment" class="form-textarea" placeholder="请填写修改建议"></textarea>
          </div>
        </template>

        <!-- 核实完成提交归档 -->
        <template v-else-if="currentAction.key === 'submit_review'">
          <div class="form-row">
            <label>核实结论<span class="req">*</span></label>
            <textarea v-model="form.comment" class="form-textarea" placeholder="请详细填写核实经过、核实结论、已采取处置措施等，作为复核归档依据"></textarea>
          </div>
        </template>

        <!-- 复核归档 -->
        <template v-else-if="currentAction.key === 'archive'">
          <div class="form-row">
            <label>复核归档结论<span class="req">*</span></label>
            <textarea v-model="form.archiveResult" class="form-textarea" placeholder="请填写复核意见及最终归档结论（如：整改到位情况、回访反馈等）"></textarea>
          </div>
        </template>

        <!-- 提交/补正重提/申诉补正重提 -->
        <template v-else-if="['submit','resubmit_after_appeal'].includes(currentAction.key)">
          <div class="form-row">
            <label>补充证据材料（可选可多条）</label>
            <div v-for="(_, i) in form.extraEvidences" :key="i" class="flex gap-2 mb-0" style="margin-bottom:6px;">
              <select v-model="form.extraEvidences[i].type" class="form-select" style="width:110px;">
                <option value="image">图片</option>
                <option value="video">视频</option>
                <option value="audio">录音</option>
                <option value="document">文档</option>
              </select>
              <input v-model="form.extraEvidences[i].name" class="form-input" placeholder="材料名称" />
              <input v-model="form.extraEvidences[i].desc" class="form-input" placeholder="备注说明" />
              <button class="btn btn-sm" @click="form.extraEvidences.splice(i,1)">删除</button>
            </div>
            <button class="btn btn-sm" @click="form.extraEvidences.push({type:'image',name:'',desc:''})">➕ 追加证据</button>
          </div>
          <div class="form-row">
            <label>提交说明</label>
            <textarea v-model="form.comment" class="form-textarea" placeholder="补充说明提交/补正的情况（可选）"></textarea>
          </div>
        </template>

        <!-- 发起申诉 -->
        <template v-else-if="currentAction.key === 'appeal'">
          <div class="form-row">
            <label>申诉理由<span class="req">*</span></label>
            <textarea v-model="form.reason" class="form-textarea" placeholder="请详细说明申诉理由、相关依据，并说明为何不接受退回/缺证据/逾期等处理"></textarea>
          </div>
          <div class="text-sm text-muted">提交后，线索单状态将变为「异常申诉中」，等待复核负责人受理。</div>
        </template>

        <!-- 申诉受理/驳回 -->
        <template v-else-if="['appeal_accept','appeal_reject','appeal_resubmit'].includes(currentAction.key)">
          <div class="form-row">
            <label>复核意见<span class="req">*</span></label>
            <textarea v-model="form.reviewOpinion" class="form-textarea" placeholder="请填写复核意见，详细说明裁决依据"></textarea>
          </div>
          <div v-if="currentAction.key === 'appeal_reject'" class="form-row">
            <label>驳回原因<span class="req">*</span></label>
            <textarea v-model="form.rejectReason" class="form-textarea" placeholder="请说明驳回申诉的原因"></textarea>
          </div>
          <div class="text-sm text-muted">
            <template v-if="currentAction.key === 'appeal_accept'">受理后线索单状态为「申诉已受理」，由登记员补充材料后再次提交。</template>
            <template v-else-if="currentAction.key === 'appeal_resubmit'">受理后直接转入「补正重提」状态，登记员可进一步补充证据。</template>
            <template v-else>驳回后线索单为「申诉已驳回」，登记员可修改后再次发起申诉。</template>
          </div>
        </template>

        <!-- 逾期/冲突 -->
        <template v-else>
          <div class="form-row">
            <label>标记说明</label>
            <textarea v-model="form.comment" class="form-textarea" placeholder="请填写标记说明"></textarea>
          </div>
        </template>

        <div class="modal-footer">
          <button class="btn" @click="currentAction=null">取消</button>
          <button class="btn" :class="currentAction.confirmCls || 'btn-primary'"
            :disabled="processing" @click="submitAction">
            {{ processing ? '处理中...' : '确认' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="toast" style="position:fixed;top:20px;right:20px;padding:12px 20px;background:var(--gray-900);color:#fff;border-radius:8px;z-index:9999;">
      {{ toast }}
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const authStore = useAuthStore()
const { get, post } = useApi()
const id = computed(() => route.params.id as string)
const data = ref<any>(null)
const auditors = ref<any[]>([])
const currentAction = ref<any>(null)
const processing = ref(false)
const toast = ref('')
const form = reactive<any>({
  auditorId: '', dueDays: 5, comment: '', rejectReason: '', reason: '',
  reviewOpinion: '', archiveResult: '', extraEvidences: []
})

const fmtTime = (t: any) => {
  if (!t) return '—'
  const s = typeof t === 'string' ? t : (t as any).toISOString?.() || String(t)
  return s.replace('T', ' ').slice(0, 16)
}
const priorityLabel = (p: string) => ({ high: '🔴 高', normal: '🟡 中', low: '🟢 低' }[p || 'normal'] || '🟡 中')
const typeLabel = (t: string) => ({ image: '📷 图片', video: '🎥 视频', audio: '🔊 录音', document: '📄 文档' }[t || 'image'] || t)
const roleLabel = (r: string) => ({ registrar: '线索登记员', auditor: '审核主管', reviewer: '复核负责人' }[r || ''] || '未知')
const statusLabelByKey = (s: string) => {
  const map: any = {
    draft: '草稿', submitted: '待核实分派', assigned: '已分派', verifying: '核实中',
    lack_evidence: '缺证据', returned: '退回补正', resubmitted: '补正重提',
    overdue: '逾期', archived: '已归档', appealed: '异常申诉中',
    appeal_accepted: '申诉已受理', appeal_rejected: '申诉已驳回', status_conflict: '状态冲突'
  }
  return map[s] || s
}
const origStatusLabel = (s: string) => statusLabelByKey(s)
const appealStatusLabel = (s: string) => ({ pending: '待复核', accepted: '已受理', rejected: '已驳回' }[s] || s)
const appealStatusCls = (s: string) => s === 'accepted' ? 'tag-申诉已受理' : s === 'rejected' ? 'tag-申诉已驳回' : 'tag-异常申诉中'
const isOverdue = (t: any) => t && new Date(t).getTime() < Date.now()

const availableActions = computed(() => {
  const list: any[] = []
  if (!data.value) return list
  const s = data.value.status
  const role = authStore.role
  const ver = data.value.version
  const isOwner = data.value.registrarID === authStore.user?.id
  const isAuditorHandler = !data.value.auditorID || data.value.auditorID === authStore.user?.id
  const isReviewer = role === 'reviewer'

  // 登记员操作：仅本人登记的单据可操作
  if (role === 'registrar' && isOwner) {
    if (s === 'draft') list.push({ key: 'submit', label: '提交线索', icon: '📤', cls: 'btn-primary', confirmCls: 'btn-primary', ver })
    if (['returned', 'lack_evidence'].includes(s)) {
      list.push({ key: 'submit', label: '补正材料后再次提交', icon: '🔁', cls: 'btn-primary', ver })
      list.push({ key: 'appeal', label: '发起异常申诉', icon: '⚖️', cls: 'btn-warning', ver })
    }
    if (['overdue', 'status_conflict', 'archived', 'appeal_rejected'].includes(s)) {
      list.push({ key: 'appeal', label: '发起异常申诉', icon: '⚖️', cls: 'btn-warning', ver })
    }
    if (s === 'appeal_rejected') {
      list.push({ key: 'submit', label: '按驳回意见补正后重提', icon: '🔁', cls: 'btn-primary', ver })
    }
    if (s === 'appeal_accepted') {
      list.push({ key: 'resubmit_after_appeal', label: '申诉受理后补正重提', icon: '🔁', cls: 'btn-primary', ver })
    }
  }

  // 审核主管操作：仅分派给本人或未分派的可办理
  if (role === 'auditor') {
    if (['submitted', 'resubmitted'].includes(s)) list.push({ key: 'assign', label: '核实分派', icon: '📋', cls: 'btn-primary', ver })
    if (s === 'assigned' && isAuditorHandler) {
      list.push({ key: 'start_verify', label: '开始核实', icon: '🔍', cls: 'btn-info', ver })
      list.push({ key: 'lack_evidence', label: '标记缺证据', icon: '⚠️', cls: 'btn-warning', ver })
      list.push({ key: 'return_correct', label: '退回补正', icon: '↩️', cls: 'btn-danger', ver })
    }
    if (s === 'verifying' && isAuditorHandler) {
      list.push({ key: 'lack_evidence', label: '标记缺证据', icon: '⚠️', cls: 'btn-warning', ver })
      list.push({ key: 'return_correct', label: '退回补正', icon: '↩️', cls: 'btn-danger', ver })
      list.push({ key: 'submit_review', label: '完成核实并提交复核归档', icon: '✅', cls: 'btn-success', ver })
    }
    if (s === 'lack_evidence' && isAuditorHandler) {
      list.push({ key: 'return_correct', label: '退回补正', icon: '↩️', cls: 'btn-danger', ver })
    }
  }

  // 复核负责人：全部可见可操作
  if (isReviewer) {
    if (s === 'verifying') list.push({ key: 'archive', label: '复核归档', icon: '📦', cls: 'btn-success', ver })
    if (['assigned', 'verifying'].includes(s)) list.push({ key: 'mark_overdue', label: '标记逾期', icon: '⏰', cls: 'btn-danger', ver })
    list.push({ key: 'mark_conflict', label: '标记状态冲突', icon: '💥', cls: 'btn-warning', ver })
    if (s === 'appealed') {
      list.push({ key: 'appeal_accept', label: '受理申诉', icon: '✔️', cls: 'btn-success', ver })
      list.push({ key: 'appeal_resubmit', label: '受理并转补正重提', icon: '🔁', cls: 'btn-primary', ver })
      list.push({ key: 'appeal_reject', label: '驳回申诉', icon: '❌', cls: 'btn-danger', ver })
    }
  }

  return list
})

const loadData = async () => {
  try {
    data.value = await get(`/api/clues/${id.value}`)
    const users = await get<any[]>('/api/users')
    auditors.value = users.filter((u: any) => u.role === 'auditor')
  } catch (e: any) {
    if (e?.status === 403) {
      data.value = null
      showToast('🚫 无权限查看该线索单详情，自动返回列表')
      setTimeout(() => navigateTo('/clues'), 1500)
    } else {
      throw e
    }
  }
}

const openAction = (a: any) => {
  // 重置表单
  Object.keys(form).forEach(k => delete form[k])
  form.auditorId = ''; form.dueDays = 5; form.comment = ''; form.rejectReason = ''
  form.reason = ''; form.reviewOpinion = ''; form.archiveResult = ''
  form.extraEvidences = []
  form._ver = a.ver
  currentAction.value = a
}

const showToast = (m: string) => {
  toast.value = m
  setTimeout(() => toast.value = '', 2000)
}

const submitAction = async () => {
  const key = currentAction.value.key
  const version = form._ver
  processing.value = true
  try {
    let endpoint = ''
    let body: any = { version }
    switch (key) {
      case 'assign':
        if (!form.auditorId) throw new Error('请选择分派对象')
        endpoint = `/api/clues/${id.value}/assign`
        body = { version, auditorId: form.auditorId, dueDays: form.dueDays, comment: form.comment }
        break
      case 'start_verify':
      case 'lack_evidence':
      case 'return_correct':
      case 'submit_review':
      case 'submit':
      case 'mark_overdue':
      case 'mark_conflict':
      case 'archive':
        endpoint = `/api/clues/${id.value}/process`
        body = {
          version,
          action: key === 'mark_overdue' ? 'mark_overdue' : key === 'mark_conflict' ? 'mark_conflict' : key,
          comment: form.comment,
          rejectReason: form.rejectReason,
          archiveResult: form.archiveResult,
          extraEvidences: form.extraEvidences?.filter((e: any) => e.name) || []
        }
        if (key === 'lack_evidence' && !form.rejectReason) throw new Error('请填写缺证据说明')
        if (key === 'return_correct' && !form.rejectReason) throw new Error('请填写退回原因')
        if (key === 'submit_review' && !form.comment) throw new Error('请填写核实结论')
        if (key === 'archive' && !form.archiveResult) throw new Error('请填写归档结论')
        break
      case 'resubmit_after_appeal':
        endpoint = `/api/clues/${id.value}/resubmit-appeal`
        body = { version, comment: form.comment, extraEvidences: form.extraEvidences?.filter((e: any) => e.name) || [] }
        break
      case 'appeal':
        if (!form.reason) throw new Error('请填写申诉理由')
        endpoint = `/api/clues/${id.value}/appeal`
        body = { version, reason: form.reason }
        break
      case 'appeal_accept':
      case 'appeal_reject':
      case 'appeal_resubmit':
        if (!form.reviewOpinion) throw new Error('请填写复核意见')
        if (key === 'appeal_reject' && !form.rejectReason) throw new Error('请填写驳回原因')
        endpoint = `/api/clues/${id.value}/appeal/review`
        body = {
          version,
          action: key === 'appeal_accept' ? 'accept' : key === 'appeal_reject' ? 'reject' : 'resubmit_auto',
          reviewOpinion: form.reviewOpinion,
          rejectReason: form.rejectReason
        }
        break
    }
    const res = await post(endpoint, body)
    showToast('✅ 操作成功')
    currentAction.value = null
    await loadData()
  } catch (e: any) {
    const msg = e.message || '操作失败'
    showToast('❌ ' + msg)
    if (msg.includes('版本') || msg.includes('冲突') || msg.includes('version')) {
      setTimeout(async () => {
        showToast('🔄 检测到版本冲突，正在刷新最新数据...')
        await loadData()
      }, 1200)
    }
  } finally {
    processing.value = false
  }
}

onMounted(loadData)
</script>
