<template>
  <div>
    <div class="stat-row">
      <div class="stat-card">
        <div class="label">线索单总数</div>
        <div class="num">{{ stats.totalOrders || 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="label">已发起 (待办理)</div>
        <div class="num" style="color:#2563eb">{{ stats.byStatus?.INITIATED || 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="label">已办理 (待复核)</div>
        <div class="num" style="color:#b45309">{{ stats.byStatus?.HANDLED || 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="label">已归档</div>
        <div class="num" style="color:#059669">{{ stats.byStatus?.ARCHIVED || 0 }}</div>
      </div>
    </div>

    <div class="two-col">
      <div class="container" style="overflow:hidden;display:flex;flex-direction:column;">
        <div class="toolbar">
          <input class="input" placeholder="搜索单号/标题/企业" v-model="filters.keyword" style="width:240px" @input="loadOrders" />
          <select class="select" v-model="filters.status" @change="loadOrders">
            <option value="">全部状态</option>
            <option value="INITIATED">已发起</option>
            <option value="HANDLED">已办理</option>
            <option value="REVIEWED">已复核</option>
            <option value="ARCHIVED">已归档</option>
            <option value="REJECTED">已驳回</option>
          </select>
          <select class="select" v-model="filters.currentStage" @change="loadOrders">
            <option value="">全部阶段</option>
            <option value="INITIATE">发起</option>
            <option value="HANDLE">办理</option>
            <option value="REVIEW_ARCHIVE">复核归档</option>
          </select>
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:#4b5563;">
            <input type="checkbox" class="checkbox" v-model="filters.mine" @change="loadOrders" />
            只看我的
          </label>
          <div style="flex:1"></div>
          <button class="btn" style="padding:6px 12px;font-size:13px;" @click="onRefresh">⟳ 刷新列表</button>
          <button v-if="canInitiate" class="btn btn-primary" @click="showCreateModal = true">＋ 发起线索单</button>
          <button v-if="canBatchReview && selectedOrderNos.length > 0" class="btn btn-success" @click="batchReview"
            :title="hasSelectedMissingVersion ? '部分选中项缺少版本号，将被跳过。请先刷新列表' : ''">
            ✓ 批量复核归档 ({{ selectedOrderNos.length }})
            <span v-if="hasSelectedMissingVersion" style="font-size:11px;margin-left:4px;color:#fef08a;">
              (⚠{{ missingVersionCount }}缺版本)
            </span>
          </button>
        </div>

        <div v-if="alert" class="alert" :class="'alert-' + alert.type" style="margin:12px 16px 0;white-space:pre-wrap;">
          <div v-if="alert.title" style="font-weight:600;margin-bottom:4px;">{{ alert.title }}</div>
          <div>{{ alert.message }}</div>
        </div>

        <div class="table-wrap" style="flex:1;overflow:auto;">
          <table>
            <thead>
              <tr>
                <th style="width:36px">
                  <input v-if="canBatchReview" type="checkbox" class="checkbox"
                    :checked="allChecked" @change="onToggleAll" />
                </th>
                <th>单号</th>
                <th>标题</th>
                <th>企业名称</th>
                <th>行业</th>
                <th>阶段</th>
                <th>状态</th>
                <th>证据</th>
                <th>版本/负责人</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in orders" :key="o.order_no"
                :class="rowClass(o)"
                @click="selectPreview(o)">
                <td @click.stop>
                  <input v-if="canReview(o)" type="checkbox" class="checkbox"
                    :checked="selectedOrderNos.includes(o.order_no)"
                    :disabled="!o.version"
                    :title="!o.version ? '该单缺少版本号，请刷新列表后再勾选' : ''"
                    @change="onToggleOne(o)" />
                </td>
                <td><span class="link" @click.stop="goDetail(o)">{{ o.order_no }}</span></td>
                <td>{{ o.title }}</td>
                <td>{{ o.enterprise_name }}</td>
                <td>{{ o.industry || '-' }}</td>
                <td>{{ o.stageName }}</td>
                <td>
                  <span class="tag" :class="'tag-' + o.status.toLowerCase()">{{ o.statusName }}</span>
                </td>
                <td>
                  <span class="evidence-dot" :class="o.has_enterprise_evidence ? 'ok' : 'miss'">企</span>
                  <span class="evidence-dot" :class="o.has_followup_evidence ? 'ok' : 'miss'">跟</span>
                  <span class="evidence-dot" :class="o.has_signing_evidence ? 'ok' : 'miss'">签</span>
                </td>
                <td>
                  <span v-if="!o.version" style="color:#dc2626;font-weight:600;">⚠ 缺版本</span>
                  <span v-else style="color:#6b7280;font-size:12px;">v{{ o.version }}</span>
                  <div style="font-size:11px;color:#6b7280;">
                    {{ o.current_stage === 'HANDLE' ? (o.handler_name || '待指派') :
                       o.current_stage === 'REVIEW_ARCHIVE' ? (o.reviewer_name || o.handler_name || '-') :
                       o.initiator_name }}
                  </div>
                </td>
                <td>{{ o.created_at?.slice(0, 16).replace('T', ' ') }}</td>
                <td @click.stop>
                  <button class="btn" style="padding:4px 10px;font-size:12px" @click="goDetail(o)">办理</button>
                </td>
              </tr>
              <tr v-if="orders.length === 0">
                <td colspan="11" class="empty">暂无线索单数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="side-panel">
        <div class="side-title">🔍 证据预览（使用详情接口数据）</div>
        <div v-if="!previewDetail" style="color:#9ca3af;font-size:13px;text-align:center;padding:40px 0;">
          点击左侧列表中的线索单，右侧调用详情接口展示完整证据数据
        </div>
        <div v-else>
          <div style="margin-bottom:12px;">
            <div style="font-weight:600;font-size:14px;">{{ previewDetail.order.order_no }}</div>
            <div style="font-size:12px;color:#6b7280;">
              {{ previewDetail.order.title }} / 版本 v{{ previewDetail.order.version }}
            </div>
            <div style="font-size:12px;color:#4b5563;margin-top:4px;">
              阶段：<b>{{ previewDetail.order.stageName }}</b> ·
              状态：<span class="tag" :class="'tag-' + previewDetail.order.status.toLowerCase()"
                style="font-size:11px;padding:1px 6px;">{{ previewDetail.order.statusName }}</span>
            </div>
          </div>

          <div class="evidence-card" :class="previewDetail.enterpriseEvidenceOk ? 'has' : 'no'">
            <h4>
              <span>{{ previewDetail.enterpriseEvidenceOk ? '✓' : '✗' }}</span>
              企业线索关键信息
            </h4>
            <div v-if="previewDetail.enterprise">
              <p>
                名称：<b>{{ previewDetail.enterprise.enterprise_name }}</b><br/>
                联系人：{{ previewDetail.enterprise.contact_person || '<span style=\'color:#dc2626\'>缺失</span>' }}<br/>
                电话：{{ previewDetail.enterprise.contact_phone || '<span style=\'color:#dc2626\'>缺失</span>' }}<br/>
                行业：{{ previewDetail.enterprise.industry || '-' }}
                <span v-if="previewDetail.enterprise.scale">｜规模：{{ previewDetail.enterprise.scale }}</span>
              </p>
              <p v-if="!previewDetail.enterpriseEvidenceOk" style="color:#dc2626;font-size:12px;">
                ⚠ 企业线索信息不完整（名称/联系人/电话任一缺失）
              </p>
            </div>
            <p v-else>企业线索不存在</p>
          </div>

          <div class="evidence-card" :class="previewDetail.followups.length > 0 ? 'has' : 'no'">
            <h4>
              <span>{{ previewDetail.followups.length > 0 ? '✓' : '✗' }}</span>
              跟进拜访记录
              <span class="badge-count" style="margin-left:auto">{{ previewDetail.followups.length }}</span>
            </h4>
            <p v-if="previewDetail.followups.length === 0">暂无跟进拜访记录（至少需要1条）</p>
            <div v-for="f in previewDetail.followups.slice().reverse()" :key="f.id" class="followup-card" style="margin-top:6px;">
              <div class="head">
                <span class="date">📅 {{ f.visit_date }}</span>
                <span class="by">👤 {{ f.handler_name }}</span>
              </div>
              <p>{{ f.content }}</p>
              <div v-if="f.location || f.participants" style="font-size:11px;color:#6b7280;margin-top:4px;">
                {{ f.location ? '📍 ' + f.location : '' }}
                {{ f.participants ? ' · 👥 ' + f.participants : '' }}
                {{ f.attachment ? ' · 📎 ' + f.attachment : '' }}
              </div>
            </div>
          </div>

          <div class="evidence-card" :class="previewDetail.signings.length > 0 ? 'has' : 'no'">
            <h4>
              <span>{{ previewDetail.signings.length > 0 ? '✓' : '✗' }}</span>
              签约确认材料
              <span class="badge-count" style="margin-left:auto">{{ previewDetail.signings.length }}</span>
            </h4>
            <p v-if="previewDetail.signings.length === 0">暂无签约确认材料</p>
            <div v-for="s in previewDetail.signings.slice().reverse()" :key="s.id" class="signing-card" style="margin-top:6px;">
              <div class="head">
                <span class="date">📅 {{ s.signing_date }}</span>
                <span class="by">💰 ¥{{ s.contract_amount?.toLocaleString() }}万</span>
              </div>
              <p>{{ s.contract_terms || '合同已签约' }}</p>
              <div v-if="s.attachment" style="font-size:11px;color:#6b7280;margin-top:4px;">
                📎 {{ s.attachment }} · 👤 {{ s.handler_name }}
              </div>
            </div>
          </div>

          <div v-if="previewDetail.logs && previewDetail.logs.length > 0" class="evidence-card" style="margin-top:10px;background:#fafafa;">
            <h4>
              <span>📝</span> 操作日志（最近3条）
            </h4>
            <div v-for="(log, i) in previewDetail.logs.slice().reverse().slice(0, 3)" :key="i" style="font-size:12px;padding:4px 0;">
              <div style="display:flex;justify-content:space-between;">
                <span :style="{ color: log.action.includes('拦截') ? '#dc2626' : '#059669', fontWeight: 600 }">
                  {{ log.action }}
                </span>
                <span style="color:#6b7280;">{{ log.created_at?.slice(5, 16).replace('T', ' ') }} · {{ log.operator_name }}</span>
              </div>
              <div style="color:#4b5563;margin-top:2px;">{{ log.detail }}</div>
            </div>
          </div>

          <button class="btn btn-primary" style="width:100%" @click="goDetail(previewDetail.order)">查看详情并办理 →</button>
        </div>
      </div>
    </div>

    <div v-if="showCreateModal" class="modal-mask" @click.self="showCreateModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>发起招商线索单</h3>
          <button class="btn" @click="showCreateModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="createAlert" class="alert" :class="'alert-' + createAlert.type">{{ createAlert.message }}</div>
          <div class="form-row">
            <label class="required">选择企业线索</label>
            <select class="select" v-model="createForm.clue_no">
              <option value="">请选择企业线索</option>
              <option v-for="l in availableLeads" :key="l.clue_no" :value="l.clue_no">
                {{ l.clue_no }} - {{ l.enterprise_name }} ({{ l.contact_person || '无联系人' }} / {{ l.contact_phone || '无电话' }})
              </option>
            </select>
            <div v-if="!canInitiate" class="alert alert-error" style="margin-top:8px;">
              您当前角色【{{ userStore.currentUser?.roleName }}】无权发起线索单，请切换到招商专员角色
            </div>
          </div>
          <div class="form-row">
            <label class="required">线索单标题</label>
            <input class="input" v-model="createForm.title" placeholder="例如：XX公司入驻意向" />
          </div>
          <div class="form-row">
            <label>流转规则</label>
            <div style="font-size:13px;color:#6b7280;line-height:1.6;">
              ① 招商专员(发起) → ② 招商经理(办理：补跟进+签约) → ③ 复核专员(归档)<br/>
              ⚠ 后一个岗位<strong>不能替前一个岗位</strong>补流程；<strong>已归档后</strong>禁止再补录
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showCreateModal = false">取消</button>
          <button class="btn btn-primary" :disabled="!canInitiate" @click="submitCreate">发起线索单</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/user.js';
import api from '../utils/api.js';

const router = useRouter();
const userStore = useUserStore();

const orders = ref([]);
const stats = ref({});
const filters = ref({ keyword: '', status: '', currentStage: '', mine: false });
const selectedOrderNos = ref([]);
const previewDetail = ref(null);
const previewLoading = ref(false);
const showCreateModal = ref(false);
const createForm = ref({ clue_no: '', title: '' });
const createAlert = ref(null);
const alert = ref(null);
const enterpriseLeads = ref([]);

const canInitiate = computed(() => userStore.currentUser?.role === 'INITIATOR');
const canReviewAny = computed(() => userStore.currentUser?.role === 'REVIEWER');
const canBatchReview = computed(() => canReviewAny.value);

const reviewableOrderNos = computed(() =>
  orders.value.filter(o => canReview(o)).map(o => o.order_no)
);

const missingVersionCount = computed(() =>
  selectedOrderNos.value.filter(n => {
    const o = orders.value.find(x => x.order_no === n);
    return !o || !o.version;
  }).length
);
const hasSelectedMissingVersion = computed(() => missingVersionCount.value > 0);

const allChecked = computed(() =>
  reviewableOrderNos.value.length > 0 &&
  reviewableOrderNos.value.every(n => selectedOrderNos.value.includes(n))
);

const availableLeads = computed(() => enterpriseLeads.value.filter(l => !l.active_order_count));

function canReview(o) {
  return canReviewAny.value && o.current_stage === 'REVIEW_ARCHIVE' && ['HANDLED', 'REVIEWED'].includes(o.status) && !!o.version;
}

function rowClass(o) {
  return {
    'row-active': previewDetail.value?.order?.order_no === o.order_no,
    'row-version-stale': !o.version
  };
}

function onToggleAll(e) {
  if (e.target.checked) {
    selectedOrderNos.value = [...reviewableOrderNos.value];
  } else {
    selectedOrderNos.value = [];
  }
}

function onToggleOne(o) {
  if (!o.version) {
    showAlert('error', `线索单【${o.order_no}】缺少版本号，请刷新列表后再勾选`);
    return;
  }
  const idx = selectedOrderNos.value.indexOf(o.order_no);
  if (idx >= 0) {
    selectedOrderNos.value.splice(idx, 1);
  } else {
    selectedOrderNos.value.push(o.order_no);
  }
}

onMounted(async () => {
  await loadOrders();
  await loadStats();
  await loadEnterpriseLeads();
});

watch(() => userStore.currentUser?.id, () => {
  selectedOrderNos.value = [];
  previewDetail.value = null;
  loadOrders();
  loadStats();
});

async function loadOrders() {
  const params = new URLSearchParams();
  if (filters.value.keyword) params.append('keyword', filters.value.keyword);
  if (filters.value.status) params.append('status', filters.value.status);
  if (filters.value.currentStage) params.append('currentStage', filters.value.currentStage);
  if (filters.value.mine) params.append('mine', 'true');
  const res = await api.get('/clue-orders?' + params.toString());
  if (res.success) {
    orders.value = res.data;
    if (!previewDetail.value && orders.value.length > 0) {
      selectPreview(orders.value[0]);
    } else if (previewDetail.value) {
      const stillExists = orders.value.find(o => o.order_no === previewDetail.value.order.order_no);
      if (!stillExists) {
        previewDetail.value = orders.value[0] ? null : previewDetail.value;
      }
    }
    selectedOrderNos.value = selectedOrderNos.value.filter(n =>
      reviewableOrderNos.value.includes(n)
    );
  } else {
    showAlert('error', res.message || '加载失败');
  }
}

async function loadStats() {
  const res = await api.get('/stats');
  if (res.success) stats.value = res.data;
}

async function loadEnterpriseLeads() {
  const res = await api.get('/enterprise-leads');
  if (res.success) enterpriseLeads.value = res.data;
}

async function selectPreview(order) {
  if (previewLoading.value) return;
  previewLoading.value = true;
  try {
    const res = await api.get('/clue-orders/' + order.order_no);
    if (res.success) {
      const d = res.data;
      const enterpriseEvidenceOk = !!(d.enterprise && d.enterprise.enterprise_name &&
        d.enterprise.contact_person && d.enterprise.contact_phone);
      previewDetail.value = {
        order: d.order,
        enterprise: d.enterprise,
        followups: d.followups || [],
        signings: d.signings || [],
        logs: d.logs || [],
        enterpriseEvidenceOk
      };
    } else {
      showAlert('error', res.message || '加载详情失败');
    }
  } finally {
    previewLoading.value = false;
  }
}

function goDetail(order) {
  router.push('/queue/' + order.order_no);
}

function showAlert(type, message, title) {
  alert.value = { type, message, title };
  setTimeout(() => { alert.value = null; }, 9000);
}

async function onRefresh() {
  previewDetail.value = null;
  selectedOrderNos.value = [];
  await loadOrders();
  await loadStats();
  showAlert('success', '列表已刷新，已获取各条线索单的最新版本号');
}

async function submitCreate() {
  createAlert.value = null;
  if (!createForm.value.clue_no || !createForm.value.title) {
    createAlert.value = { type: 'error', message: '请选择企业线索并填写标题' };
    return;
  }
  const res = await api.post('/clue-orders', createForm.value);
  if (res.success) {
    showAlert('success', res.message);
    showCreateModal.value = false;
    createForm.value = { clue_no: '', title: '' };
    await loadOrders();
    await loadStats();
    if (res.warnings && res.warnings.length > 0) {
      setTimeout(() => {
        showAlert('warning', '注意：' + res.warnings.map(w => w.name).join('、') + '有待补充');
      }, 300);
    }
  } else {
    let msg = res.message || '创建失败';
    if (res.details) {
      if (res.details.existingOrderNo) {
        msg += ` (已存在单号: ${res.details.existingOrderNo})`;
      }
      if (Array.isArray(res.details)) {
        msg += ': ' + res.details.map(d => d.name).join('、');
      }
    }
    createAlert.value = { type: 'error', message: msg };
  }
}

async function batchReview() {
  if (!confirm(`确认批量复核归档 ${selectedOrderNos.value.length} 条线索单吗？\n\n注意：版本过期或证据不全的将被逐条拦截并返回具体原因。`)) return;

  const orderObjs = [];
  const missingVersionNos = [];
  for (const no of selectedOrderNos.value) {
    const o = orders.value.find(x => x.order_no === no);
    if (!o || !o.version) {
      missingVersionNos.push(no);
      continue;
    }
    orderObjs.push({ order_no: no, clientVersion: o.version });
  }

  if (missingVersionNos.length > 0) {
    if (!confirm(`⚠ 有 ${missingVersionNos.length} 条线索单缺少版本号，将跳过并无法批量归档：\n  ${missingVersionNos.join('、')}\n\n是否只对有版本号的 ${orderObjs.length} 条继续？（建议先点"刷新列表"后再重试）`)) {
      return;
    }
    showAlert('warning', `${missingVersionNos.length} 条缺版本的单被跳过：${missingVersionNos.join('、')}，请刷新列表后重试`);
    if (orderObjs.length === 0) {
      await loadOrders();
      return;
    }
  }

  const res = await api.post('/clue-orders/batch-review', { orders: orderObjs });
  if (res.success) {
    showAlert(res.data.failed > 0 ? 'warning' : 'success', res.message);
    if (res.data.results && res.data.results.length > 0) {
      const success = res.data.results.filter(d => d.success);
      const missingVer = res.data.results.filter(d => !d.success && d.error === 'CLIENT_VERSION_REQUIRED');
      const staleVer = res.data.results.filter(d => !d.success && d.error === 'VERSION_CONFLICT');
      const statusMismatch = res.data.results.filter(d => !d.success && ['NOT_REVIEWABLE', 'WRONG_STAGE', 'WRONG_STATUS'].includes(d.error));
      const evidenceFail = res.data.results.filter(d => !d.success && d.error === 'INSUFFICIENT_EVIDENCE');
      const otherFail = res.data.results.filter(d => !d.success &&
        !['CLIENT_VERSION_REQUIRED', 'VERSION_CONFLICT', 'NOT_REVIEWABLE', 'WRONG_STAGE', 'WRONG_STATUS', 'INSUFFICIENT_EVIDENCE'].includes(d.error));
      const lines = [];
      if (success.length) lines.push(`✅ 成功归档 ${success.length} 条：${success.map(s => s.order_no + '(→v' + s.newVersion + ')').join('、')}`);
      if (missingVer.length) lines.push(`🔴 [缺版本凭证] ${missingVer.length} 条（未提交 clientVersion，请刷新列表）：${missingVer.map(f => f.order_no).join('、')}`);
      if (staleVer.length) lines.push(`🔴 [版本冲突/过期] ${staleVer.length} 条（本地版本≠服务端，请刷新列表）：${staleVer.map(f => f.order_no + '（客户端v' + f.clientVersion + '≠服务端v' + f.serverVersion + '）').join('、')}`);
      if (statusMismatch.length) lines.push(`🟡 [状态/阶段不符] ${statusMismatch.length} 条（需处于REVIEW_ARCHIVE阶段+HANDLED状态）：${statusMismatch.map(f => f.order_no).join('、')}`);
      if (evidenceFail.length) lines.push(`🟠 [证据不全] ${evidenceFail.length} 条：${evidenceFail.map(f => f.order_no + '（缺' + (f.missing || []).map(m => m.name).join('/') + '）').join('、')}`);
      if (otherFail.length) lines.push(`⚫ [其他失败] ${otherFail.length} 条：${otherFail.map(f => f.order_no + '(' + f.error + '):' + f.message).join('; ')}`);
      if (staleVer.length || missingVer.length) {
        lines.push('');
        lines.push('💡 提示：红色拦截项请点击"刷新列表"获取最新版本号后再勾选重试');
      }
      setTimeout(() => showAlert(
        res.data.failed > 0 ? 'error' : 'success',
        lines.join('\n'),
        '批量复核详细结果'
      ), 100);
    }
    selectedOrderNos.value = [];
    await loadOrders();
    await loadStats();
  } else {
    showAlert('error', res.message || '批量操作失败', '批量复核失败');
    await loadOrders();
  }
}
</script>

<style scoped>
.row-active {
  background: #eff6ff !important;
}
.row-active td {
  font-weight: 500;
}
.row-version-stale {
  background: #fef2f2 !important;
}
.row-version-stale td:first-child input {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
