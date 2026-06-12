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
          <button v-if="canInitiate" class="btn btn-primary" @click="showCreateModal = true">＋ 发起线索单</button>
          <button v-if="canBatchReview && selectedOrders.length > 0" class="btn btn-success" @click="batchReview">
            ✓ 批量复核归档 ({{ selectedOrders.length }})
          </button>
        </div>

        <div v-if="alert" class="alert" :class="'alert-' + alert.type" style="margin:12px 16px 0;">
          {{ alert.message }}
        </div>

        <div class="table-wrap" style="flex:1;overflow:auto;">
          <table>
            <thead>
              <tr>
                <th style="width:36px">
                  <input v-if="canBatchReview" type="checkbox" class="checkbox"
                    :checked="allSelected" @change="toggleAll" />
                </th>
                <th>单号</th>
                <th>标题</th>
                <th>企业名称</th>
                <th>行业</th>
                <th>阶段</th>
                <th>状态</th>
                <th>证据</th>
                <th>负责人</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in orders" :key="o.order_no">
                <td>
                  <input v-if="canReview(o)" type="checkbox" class="checkbox"
                    :value="o.order_no" v-model="selectedOrders" />
                </td>
                <td><span class="link" @click="goDetail(o)">{{ o.order_no }}</span></td>
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
                  {{ o.current_stage === 'HANDLE' ? (o.handler_name || '待指派') :
                     o.current_stage === 'REVIEW_ARCHIVE' ? (o.reviewer_name || o.handler_name || '-') :
                     o.initiator_name }}
                </td>
                <td>{{ o.created_at?.slice(0, 16).replace('T', ' ') }}</td>
                <td>
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
        <div class="side-title">🔍 证据预览（点击左侧线索单查看详情）</div>
        <div v-if="!previewOrder" style="color:#9ca3af;font-size:13px;text-align:center;padding:40px 0;">
          点击左侧列表中的线索单，右侧显示该单的三类证据情况
        </div>
        <div v-else>
          <div style="margin-bottom:12px;">
            <div style="font-weight:600;font-size:14px;">{{ previewOrder.order_no }}</div>
            <div style="font-size:12px;color:#6b7280;">{{ previewOrder.title }} / {{ previewOrder.enterprise_name }}</div>
          </div>

          <div class="evidence-card" :class="previewOrder.has_enterprise_evidence ? 'has' : 'no'">
            <h4>
              <span>{{ previewOrder.has_enterprise_evidence ? '✓' : '✗' }}</span>
              企业线索关键信息
            </h4>
            <p v-if="previewOrder.has_enterprise_evidence">
              名称：{{ previewOrder.enterprise_name }}<br/>
              联系人：{{ previewOrder.contact_person || '-' }}<br/>
              电话：{{ previewOrder.contact_phone || '-' }}<br/>
              行业：{{ previewOrder.industry || '-' }}
            </p>
            <p v-else>企业线索信息不完整，缺少企业名称、联系人或联系电话</p>
          </div>

          <div class="evidence-card" :class="previewOrder.has_followup_evidence ? 'has' : 'no'">
            <h4>
              <span>{{ previewOrder.has_followup_evidence ? '✓' : '✗' }}</span>
              跟进拜访记录
              <span class="badge-count" style="margin-left:auto">{{ previewFollowups.length }}</span>
            </h4>
            <p v-if="previewFollowups.length === 0">暂无跟进拜访记录</p>
            <div v-for="f in previewFollowups.slice(0, 2)" :key="f.id" class="followup-card" style="margin-top:6px;">
              <div class="head">
                <span class="date">{{ f.visit_date }}</span>
                <span class="by">{{ f.handler_name }}</span>
              </div>
              <p>{{ f.content }}</p>
            </div>
          </div>

          <div class="evidence-card" :class="previewOrder.has_signing_evidence ? 'has' : 'no'">
            <h4>
              <span>{{ previewOrder.has_signing_evidence ? '✓' : '✗' }}</span>
              签约确认材料
              <span class="badge-count" style="margin-left:auto">{{ previewSignings.length }}</span>
            </h4>
            <p v-if="previewSignings.length === 0">暂无签约确认材料</p>
            <div v-for="s in previewSignings.slice(0, 2)" :key="s.id" class="signing-card" style="margin-top:6px;">
              <div class="head">
                <span class="date">{{ s.signing_date }}</span>
                <span class="by">¥{{ s.contract_amount?.toLocaleString() }}万</span>
              </div>
              <p>{{ s.contract_terms || '已签约' }}</p>
            </div>
          </div>

          <button class="btn btn-primary" style="width:100%" @click="goDetail(previewOrder)">查看并办理 →</button>
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
                {{ l.clue_no }} - {{ l.enterprise_name }} ({{ l.contact_person }} / {{ l.contact_phone }})
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
            <label>可发起角色</label>
            <div style="font-size:13px;color:#6b7280;">招商专员(发起) —— 提交后进入办理阶段，由招商经理负责跟进拜访和签约确认</div>
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
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/user.js';
import api from '../utils/api.js';

const router = useRouter();
const userStore = useUserStore();

const orders = ref([]);
const stats = ref({});
const filters = ref({ keyword: '', status: '', currentStage: '', mine: false });
const selectedOrders = ref([]);
const previewOrder = ref(null);
const previewFollowups = ref([]);
const previewSignings = ref([]);
const showCreateModal = ref(false);
const createForm = ref({ clue_no: '', title: '' });
const createAlert = ref(null);
const alert = ref(null);
const enterpriseLeads = ref([]);

const canInitiate = computed(() => userStore.currentUser?.role === 'INITIATOR');
const canReviewAny = computed(() => userStore.currentUser?.role === 'REVIEWER');

const canBatchReview = computed(() => canReviewAny.value);

const allSelected = computed({
  get: () => orders.value.length > 0 && orders.value.filter(o => canReview(o)).every(o => selectedOrders.value.includes(o.order_no)),
  set: (v) => {
    if (v) {
      selectedOrders.value = orders.value.filter(o => canReview(o)).map(o => o.order_no);
    } else {
      selectedOrders.value = [];
    }
  }
});

const availableLeads = computed(() => enterpriseLeads.value.filter(l => !l.active_order_count));

function canReview(o) {
  return canReviewAny.value && o.current_stage === 'REVIEW_ARCHIVE' && ['HANDLED', 'REVIEWED'].includes(o.status);
}

onMounted(async () => {
  await loadOrders();
  await loadStats();
  await loadEnterpriseLeads();
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
    if (!previewOrder.value && orders.value.length > 0) {
      await selectPreview(orders.value[0]);
    }
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
  previewOrder.value = order;
  const res = await api.get('/clue-orders/' + order.order_no);
  if (res.success) {
    previewFollowups.value = res.data.followups || [];
    previewSignings.value = res.data.signings || [];
  }
}

function goDetail(order) {
  router.push('/queue/' + order.order_no);
}

function toggleAll() {}

function showAlert(type, message) {
  alert.value = { type, message };
  setTimeout(() => { alert.value = null; }, 4000);
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
      showAlert('warning', '注意：' + res.warnings.map(w => w.name).join('、') + '有待补充');
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
  if (!confirm(`确认批量复核归档 ${selectedOrders.value.length} 条线索单吗？证据不全的将被跳过。`)) return;
  const res = await api.post('/clue-orders/batch-review', { order_nos: selectedOrders.value });
  if (res.success) {
    showAlert(res.data.failed > 0 ? 'warning' : 'success', res.message);
    if (res.data.details) {
      const failed = res.data.details.filter(d => !d.success);
      if (failed.length > 0) {
        setTimeout(() => {
          alert.value = { type: 'warning', message: '失败明细：' + failed.map(f => `${f.orderNo}: ${f.message}`).join('；') };
        }, 100);
      }
    }
    selectedOrders.value = [];
    await loadOrders();
    await loadStats();
  } else {
    showAlert('error', res.message || '批量操作失败');
  }
}
</script>
