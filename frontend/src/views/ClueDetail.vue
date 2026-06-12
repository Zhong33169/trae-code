<template>
  <div>
    <div class="breadcrumb">
      <router-link to="/queue">招商线索单队列</router-link> / <span>线索单详情</span>
    </div>

    <div v-if="loading" class="empty">加载中...</div>

    <div v-else-if="!order" class="container">
      <div class="empty">线索单不存在或已被删除</div>
    </div>

    <div v-else class="two-col" style="height:auto;">
      <div class="container" style="overflow:visible;">
        <div class="section">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <div style="font-size:18px;font-weight:600;">
                {{ order.title }}
                <span class="tag" :class="'tag-' + order.status.toLowerCase()" style="margin-left:8px;">{{ order.statusName }}</span>
                <span class="tag tag-handled" style="margin-left:6px;background:#eff6ff;color:#1d4ed8;">{{ order.stageName }}</span>
              </div>
              <div style="font-size:13px;color:#6b7280;margin-top:6px;">
                单号：<b>{{ order.order_no }}</b> &nbsp;|&nbsp;
                关联企业：<b>{{ order.enterprise_name }}</b> &nbsp;|&nbsp;
                版本号：<b>v{{ order.version }}</b>
                <span v-if="order.handler_id" style="margin-left:8px;">
                  &nbsp;|&nbsp; 当前办理人：<b :style="{ color: isCurrentHandler ? '#059669' : '#6b7280' }">
                    {{ order.handler_name }}
                    <span v-if="isCurrentHandler">(您)</span>
                  </b>
                </span>
              </div>
            </div>
            <div style="display:flex;gap:8px;">
              <button v-if="canHandleSubmit" class="btn btn-primary" @click="showHandleModal = true">办理提交 →</button>
              <button v-if="canReview" class="btn btn-success" @click="doReview">✓ 复核归档</button>
              <button v-if="canReview" class="btn btn-danger" @click="showRejectModal = true">✗ 驳回</button>
              <button class="btn" @click="$router.back()">返回列表</button>
            </div>
          </div>
        </div>

        <div v-if="!canSupplementButHandler && userStore.currentUser?.role === 'HANDLER'"
          class="alert alert-warning" style="margin:12px 16px 0;">
          ⚠ {{ supplementBlockReason }}
        </div>

        <div v-if="alert" class="alert" :class="'alert-' + alert.type" style="margin:12px 16px 0;">
          <div style="font-weight:600;">{{ alert.title || '' }}</div>
          <div>{{ alert.message }}</div>
          <div v-if="alert.details" style="font-size:12px;opacity:0.9;margin-top:4px;">
            <div v-for="(d, i) in alert.details" :key="i">• {{ typeof d === 'string' ? d : (d.name + '：' + d.detail) }}</div>
          </div>
          <div v-if="alert.details && typeof alert.details === 'object' && !Array.isArray(alert.details)"
            style="font-size:12px;opacity:0.9;margin-top:4px;">
            <div v-for="(v, k) in alert.details" :key="k">• {{ k }}：{{ JSON.stringify(v) }}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">📋 基础信息</div>
          <div class="detail-grid">
            <div class="detail-item">
              <label>线索单编号</label>
              <div class="value">{{ order.order_no }}</div>
            </div>
            <div class="detail-item">
              <label>当前阶段</label>
              <div class="value">{{ order.stageName }}</div>
            </div>
            <div class="detail-item">
              <label>当前状态</label>
              <div class="value">
                <span class="tag" :class="'tag-' + order.status.toLowerCase()">{{ order.statusName }}</span>
              </div>
            </div>
            <div class="detail-item">
              <label>企业线索编号</label>
              <div class="value">{{ order.clue_no }}</div>
            </div>
            <div class="detail-item">
              <label>发起人员</label>
              <div class="value">{{ order.initiator_name || '-' }}</div>
            </div>
            <div class="detail-item">
              <label>发起时间</label>
              <div class="value">{{ order.initiate_time?.slice(0,16).replace('T',' ') || '-' }}</div>
            </div>
            <div class="detail-item">
              <label>办理人员</label>
              <div class="value">{{ order.handler_name || '-' }}</div>
            </div>
            <div class="detail-item">
              <label>办理时间</label>
              <div class="value">{{ order.handle_time?.slice(0,16).replace('T',' ') || '-' }}</div>
            </div>
            <div class="detail-item">
              <label>复核人员</label>
              <div class="value">{{ order.reviewer_name || '-' }}</div>
            </div>
            <div class="detail-item">
              <label>复核时间</label>
              <div class="value">{{ order.review_time?.slice(0,16).replace('T',' ') || '-' }}</div>
            </div>
            <div class="detail-item">
              <label>证据检查备注</label>
              <div class="value" style="font-size:12px;color:#6b7280;">{{ order.evidence_check_note || '-' }}</div>
            </div>
            <div class="detail-item" v-if="order.reject_reason">
              <label>驳回原因</label>
              <div class="value" style="color:#b91c1c;">{{ order.reject_reason }}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">🏢 企业线索信息</div>
          <div v-if="!hasEnterpriseEvidence" style="margin-bottom:10px;" class="alert alert-error"
               :class="enterpriseBlocked ? 'alert-error' : 'alert-warning'">
            ⚠ 企业线索信息不完整
            <span v-if="enterpriseMissingFields.length">：缺失 {{ enterpriseMissingFields.join('、') }}</span>
          </div>
          <div class="detail-grid">
            <div class="detail-item">
              <label>企业名称</label>
              <div class="value">{{ order.enterprise_name }}</div>
            </div>
            <div class="detail-item">
              <label>联系人</label>
              <div class="value">
                <template v-if="order.contact_person">{{ order.contact_person }}</template>
                <template v-else><span style="color:#dc2626;">⚠ 缺失</span></template>
              </div>
            </div>
            <div class="detail-item">
              <label>联系电话</label>
              <div class="value">
                <template v-if="order.contact_phone">{{ order.contact_phone }}</template>
                <template v-else><span style="color:#dc2626;">⚠ 缺失</span></template>
              </div>
            </div>
            <div class="detail-item">
              <label>所属行业</label>
              <div class="value">{{ order.industry || '-' }}</div>
            </div>
            <div class="detail-item">
              <label>企业规模</label>
              <div class="value">{{ order.scale || '-' }}</div>
            </div>
            <div class="detail-item">
              <label>注册资本</label>
              <div class="value">{{ order.registered_capital ? order.registered_capital + ' 万元' : '-' }}</div>
            </div>
            <div class="detail-item">
              <label>合作意向</label>
              <div class="value">{{ order.intention || '-' }}</div>
            </div>
            <div class="detail-item">
              <label>线索来源</label>
              <div class="value">{{ order.source || '-' }}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
            <div class="section-title" style="margin-bottom:0;">📅 跟进拜访记录 <span class="badge-count">{{ followups.length }}</span></div>
            <div>
              <button v-if="canSupplement" class="btn btn-primary" style="padding:4px 10px;font-size:12px;"
                @click="showFollowupModal = true">＋ 补录跟进</button>
              <span v-else-if="userStore.currentUser?.role === 'HANDLER'"
                style="font-size:12px;color:#6b7280;" :title="supplementBlockReason">
                🔒 {{ supplementBlockReasonShort }}
              </span>
            </div>
          </div>
          <div v-if="followups.length === 0" style="color:#9ca3af;font-size:13px;padding:16px 0;text-align:center;">
            暂无跟进拜访记录
          </div>
          <div v-for="f in followups" :key="f.id" class="followup-card">
            <div class="head">
              <span class="date">📌 {{ f.visit_date }} @ {{ f.location || '未填地点' }}</span>
              <span class="by">by {{ f.handler_name }}</span>
            </div>
            <p style="color:#6b7280;margin-bottom:4px;"><b>参与人员：</b>{{ f.participants || '未填' }}</p>
            <p>{{ f.content }}</p>
            <p v-if="f.attachment" style="color:#2563eb;">📎 {{ f.attachment }}</p>
          </div>
        </div>

        <div class="section">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
            <div class="section-title" style="margin-bottom:0;">📝 签约确认材料 <span class="badge-count">{{ signings.length }}</span></div>
            <div>
              <button v-if="canSupplement" class="btn btn-primary" style="padding:4px 10px;font-size:12px;"
                @click="showSigningModal = true">＋ 补录签约</button>
              <span v-else-if="userStore.currentUser?.role === 'HANDLER'"
                style="font-size:12px;color:#6b7280;" :title="supplementBlockReason">
                🔒 {{ supplementBlockReasonShort }}
              </span>
            </div>
          </div>
          <div v-if="signings.length === 0" style="color:#9ca3af;font-size:13px;padding:16px 0;text-align:center;">
            暂无签约确认材料
          </div>
          <div v-for="s in signings" :key="s.id" class="signing-card">
            <div class="head">
              <span class="date">📅 {{ s.signing_date }}</span>
              <span class="by">合同金额：¥{{ s.contract_amount?.toLocaleString() }} 万元</span>
            </div>
            <p style="margin-bottom:4px;"><b>合同条款：</b>{{ s.contract_terms || '未填' }}</p>
            <p v-if="s.attachment" style="color:#2563eb;">📎 {{ s.attachment }}</p>
            <p style="color:#6b7280;font-size:12px;">录入：{{ s.handler_name }}</p>
          </div>
        </div>

        <div class="section">
          <div class="section-title">📜 操作日志（拦截日志已记录）</div>
          <div v-for="l in logs" :key="l.id" class="log-item"
            :style="{ borderLeft: l.action.includes('拦截') ? '3px solid #dc2626' : '3px solid #3b82f6' }">
            <div class="meta">
              <span>{{ l.created_at?.slice(0,19).replace('T',' ') }}</span>
              <span style="color:#2563eb;">{{ l.operator_name }}</span>
              <span>{{ l.operator_role === 'INITIATOR' ? '招商专员' : l.operator_role === 'HANDLER' ? '招商经理' : '复核专员' }}</span>
            </div>
            <div class="action"
              :style="{ color: l.action.includes('拦截') ? '#dc2626' : '#059669', fontWeight: 600 }">
              {{ l.action }}
            </div>
            <div class="detail">{{ l.detail }}</div>
          </div>
        </div>
      </div>

      <div class="side-panel" style="position:sticky;top:20px;height:fit-content;">
        <div class="side-title">📁 证据完整性校验</div>

        <div class="evidence-card" :class="hasEnterpriseEvidence ? 'has' : 'no'">
          <h4><span>{{ hasEnterpriseEvidence ? '✓ 已齐备' : '✗ 缺失' }}</span>企业线索关键信息</h4>
          <p>发起/办理/复核前都需要：企业名称、联系人、联系电话齐全</p>
          <p v-if="!hasEnterpriseEvidence" style="color:#dc2626;font-size:12px;margin-top:4px;">
            缺失：{{ enterpriseMissingFields.join('、') }}
          </p>
        </div>

        <div class="evidence-card" :class="followups.length > 0 ? 'has' : 'no'">
          <h4><span>{{ followups.length > 0 ? '✓ 已齐备' : '✗ 缺失' }}</span>跟进拜访记录</h4>
          <p>办理/复核归档前至少需要 1 条跟进拜访记录</p>
        </div>

        <div class="evidence-card" :class="signings.length > 0 ? 'has' : 'no'">
          <h4><span>{{ signings.length > 0 ? '✓ 已齐备' : '✗ 缺失' }}</span>签约确认材料</h4>
          <p>复核归档前必须有签约确认（含合同金额、签约日期）</p>
        </div>

        <div class="side-title" style="margin-top:20px;">🚦 流转规则</div>
        <div style="font-size:12px;line-height:1.9;color:#4b5563;">
          <div>1️⃣ <b>发起</b> → 招商专员（INITIATOR）</div>
          <div>2️⃣ <b>办理</b> → 招商经理（HANDLER）</div>
          <div>3️⃣ <b>复核归档</b> → 复核专员（REVIEWER）</div>
          <div style="color:#b91c1c;margin-top:6px;">⚠️ 后岗不能替前岗补流程</div>
          <div style="color:#b91c1c;">⚠️ <b>办理阶段(HANDLE)外</b>不能补录跟进/签约</div>
          <div style="color:#b91c1c;">⚠️ 已归档线索单禁止再补录</div>
          <div style="color:#b91c1c;">⚠️ 非当前办理人不能补录</div>
          <div style="color:#b91c1c;">⚠️ 版本冲突时须刷新后再操作</div>
        </div>

        <div class="side-title" style="margin-top:20px;">🎯 当前状态可操作提示</div>
        <div style="font-size:12px;line-height:1.9;">
          <div v-if="canSupplement" style="color:#059669;">✅ 您现在可以：补录跟进/签约 → 办理提交</div>
          <div v-else-if="canHandleSubmit" style="color:#059669;">✅ 您现在可以：办理提交 → 进入复核</div>
          <div v-else-if="canReview" style="color:#059669;">✅ 您现在可以：复核归档 / 驳回</div>
          <div v-else-if="order.status === 'ARCHIVED'" style="color:#6b7280;">ℹ 线索单已归档，不可再操作</div>
          <div v-else-if="order.status === 'REJECTED'" style="color:#b91c1c;">⚠ 线索单已被驳回，需重新发起</div>
          <div v-else-if="!isCurrentHandler && userStore.currentUser?.role === 'HANDLER'" style="color:#b91c1c;">
            ⚠ 当前办理人：{{ order.handler_name }}，您无法操作
          </div>
          <div v-else style="color:#6b7280;">ℹ 请切换到对应岗位角色再操作</div>
        </div>
      </div>
    </div>

    <div v-if="showHandleModal" class="modal-mask" @click.self="showHandleModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>办理线索单 · 提交至复核归档</h3>
          <button class="btn" @click="showHandleModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="handleAlert" class="alert" :class="'alert-' + handleAlert.type">
            <div>{{ handleAlert.title || handleAlert.message }}</div>
            <div v-if="handleAlert.details" style="margin-top:6px;font-size:12px;">
              <div v-for="(d, i) in handleAlert.details" :key="i">• {{ typeof d === 'string' ? d : (d.name + '：' + d.detail) }}</div>
            </div>
            <div v-if="handleAlert.details && typeof handleAlert.details === 'object' && !Array.isArray(handleAlert.details)"
              style="font-size:12px;margin-top:6px;">
              <div v-for="(v, k) in handleAlert.details" :key="k">• {{ k }}：{{ JSON.stringify(v) }}</div>
            </div>
          </div>

          <div class="alert alert-info">
            当前角色：<b>{{ userStore.currentUser?.roleName }}</b>。提交后流转至【复核归档】阶段。
            <div v-if="order.handler_id && !isCurrentHandler" style="margin-top:6px;color:#b91c1c;">
              ⚠ 当前办理人：{{ order.handler_name }}，您无法办理
            </div>
          </div>

          <div style="margin:12px 0;padding:10px;background:#f9fafb;border-radius:6px;">
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;">
              <input type="checkbox" class="checkbox" v-model="handleForm.addFollowup" />
              <b>同步添加跟进拜访记录</b>
            </label>
          </div>
          <div v-if="handleForm.addFollowup">
            <div class="form-row">
              <label class="required">拜访日期</label>
              <input type="date" class="input" v-model="handleForm.followup.visit_date" />
            </div>
            <div class="form-row">
              <label>拜访地点</label>
              <input class="input" v-model="handleForm.followup.location" placeholder="例如：园区会议室A" />
            </div>
            <div class="form-row">
              <label>参与人员</label>
              <input class="input" v-model="handleForm.followup.participants" placeholder="参与方人员姓名" />
            </div>
            <div class="form-row">
              <label class="required">拜访内容</label>
              <textarea class="textarea" v-model="handleForm.followup.content" placeholder="详细拜访内容和结论"></textarea>
            </div>
          </div>

          <div style="margin:12px 0;padding:10px;background:#f9fafb;border-radius:6px;">
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;">
              <input type="checkbox" class="checkbox" v-model="handleForm.addSigning" />
              <b>同步添加签约确认</b>
            </label>
          </div>
          <div v-if="handleForm.addSigning">
            <div class="form-row">
              <label class="required">合同金额（万元）</label>
              <input type="number" class="input" v-model.number="handleForm.signing.contract_amount" placeholder="例如：3000" />
            </div>
            <div class="form-row">
              <label class="required">签约日期</label>
              <input type="date" class="input" v-model="handleForm.signing.signing_date" />
            </div>
            <div class="form-row">
              <label>合同条款摘要</label>
              <textarea class="textarea" v-model="handleForm.signing.contract_terms" placeholder="合同关键条款"></textarea>
            </div>
          </div>

          <div class="alert alert-warning" style="margin-top:12px;">
            客户端版本：<b>v{{ order.version }}</b>，服务器会校验版本；同时会校验您是否为当前办理人。
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showHandleModal = false">取消</button>
          <button class="btn btn-primary" :disabled="!canHandleSubmit" @click="doHandle">提交办理</button>
        </div>
      </div>
    </div>

    <div v-if="showRejectModal" class="modal-mask" @click.self="showRejectModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>驳回复核 · {{ orderNo }}</h3>
          <button class="btn" @click="showRejectModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="alert alert-warning">驳回后线索单将回到发起岗重新发起，请填写明确原因。</div>
          <div class="form-row">
            <label class="required">驳回原因</label>
            <textarea class="textarea" v-model="rejectForm.reason" placeholder="请详细说明驳回原因"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showRejectModal = false">取消</button>
          <button class="btn btn-danger" @click="doReject">确认驳回</button>
        </div>
      </div>
    </div>

    <div v-if="showFollowupModal" class="modal-mask" @click.self="showFollowupModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>补录跟进拜访（绑定线索单 v{{ order.version }}）</h3>
          <button class="btn" @click="showFollowupModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="alert alert-info">
            此补录接口将通过后端校验：<br/>
            ✓ 阶段必须是办理阶段(HANDLE) · ✓ 状态必须是已发起(INITIATED)<br/>
            ✓ 版本号 v{{ order.version }} · ✓ 必须是当前办理人{{ order.handler_name ? '：' + order.handler_name : '（空）' }}
          </div>
          <div class="form-row">
            <label class="required">拜访日期</label>
            <input type="date" class="input" v-model="followupForm.visit_date" />
          </div>
          <div class="form-row">
            <label>拜访地点</label>
            <input class="input" v-model="followupForm.location" />
          </div>
          <div class="form-row">
            <label>参与人员</label>
            <input class="input" v-model="followupForm.participants" />
          </div>
          <div class="form-row">
            <label class="required">拜访内容</label>
            <textarea class="textarea" v-model="followupForm.content"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showFollowupModal = false">取消</button>
          <button class="btn btn-primary" @click="addFollowup">确认补录</button>
        </div>
      </div>
    </div>

    <div v-if="showSigningModal" class="modal-mask" @click.self="showSigningModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>补录签约确认（绑定线索单 v{{ order.version }}）</h3>
          <button class="btn" @click="showSigningModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="alert alert-info">
            此补录接口将通过后端校验：<br/>
            ✓ 阶段必须是办理阶段(HANDLE) · ✓ 状态必须是已发起(INITIATED)<br/>
            ✓ 版本号 v{{ order.version }} · ✓ 必须是当前办理人{{ order.handler_name ? '：' + order.handler_name : '（空）' }}
          </div>
          <div class="form-row">
            <label class="required">合同金额（万元）</label>
            <input type="number" class="input" v-model.number="signingForm.contract_amount" />
          </div>
          <div class="form-row">
            <label class="required">签约日期</label>
            <input type="date" class="input" v-model="signingForm.signing_date" />
          </div>
          <div class="form-row">
            <label>合同条款摘要</label>
            <textarea class="textarea" v-model="signingForm.contract_terms"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showSigningModal = false">取消</button>
          <button class="btn btn-primary" @click="addSigning">确认补录</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useUserStore } from '../stores/user.js';
import api from '../utils/api.js';

const route = useRoute();
const userStore = useUserStore();
const orderNo = route.params.orderNo;

const loading = ref(true);
const order = ref(null);
const enterprise = ref(null);
const followups = ref([]);
const signings = ref([]);
const logs = ref([]);
const evidence = ref({ hasEnterpriseEvidence: false, hasFollowupEvidence: false, hasSigningEvidence: false });

const alert = ref(null);

const showHandleModal = ref(false);
const showRejectModal = ref(false);
const showFollowupModal = ref(false);
const showSigningModal = ref(false);

const handleForm = ref({
  addFollowup: true,
  addSigning: true,
  followup: { visit_date: '', location: '', participants: '', content: '' },
  signing: { contract_amount: null, signing_date: '', contract_terms: '' }
});
const handleAlert = ref(null);
const rejectForm = ref({ reason: '' });
const followupForm = ref({ visit_date: '', location: '', participants: '', content: '' });
const signingForm = ref({ contract_amount: null, signing_date: '', contract_terms: '' });

const isCurrentHandler = computed(() => {
  if (!order.value || !userStore.currentUser) return false;
  if (userStore.currentUser.role !== 'HANDLER') return false;
  if (!order.value.handler_id) return true;
  return order.value.handler_id === userStore.currentUser.id;
});

const canHandleSubmit = computed(() => {
  if (!order.value || !userStore.currentUser) return false;
  return userStore.currentUser.role === 'HANDLER' &&
         order.value.current_stage === 'HANDLE' &&
         order.value.status === 'INITIATED' &&
         isCurrentHandler.value;
});

const canSupplement = computed(() => {
  if (!order.value || !userStore.currentUser) return false;
  return userStore.currentUser.role === 'HANDLER' &&
         order.value.current_stage === 'HANDLE' &&
         order.value.status === 'INITIATED' &&
         isCurrentHandler.value;
});

const canSupplementButHandler = computed(() => {
  if (!order.value || !userStore.currentUser) return false;
  if (userStore.currentUser.role !== 'HANDLER') return false;
  return !canSupplement.value;
});

const supplementBlockReason = computed(() => {
  if (!order.value) return '';
  if (order.value.current_stage !== 'HANDLE') {
    const stageText = { INITIATE: '发起', HANDLE: '办理', REVIEW_ARCHIVE: '复核归档' }[order.value.current_stage];
    return `当前处于【${stageText}阶段】，仅【办理】阶段可补录跟进/签约（后岗不能替前岗补流程）`;
  }
  if (order.value.status !== 'INITIATED') {
    const statusText = { INITIATED:'已发起', HANDLED:'已办理', REVIEWED:'已复核', ARCHIVED:'已归档', REJECTED:'已驳回' }[order.value.status];
    return `当前状态为【${statusText}】，仅【已发起】状态可补录跟进/签约`;
  }
  if (!isCurrentHandler.value) {
    return `当前办理人是【${order.value.handler_name}】，您不是当前办理人，无法补录（防止覆盖他人办理结果）`;
  }
  return '';
});

const supplementBlockReasonShort = computed(() => {
  if (!order.value) return '不可补录';
  if (order.value.current_stage !== 'HANDLE') return '阶段不符';
  if (order.value.status !== 'INITIATED') return '状态不符';
  if (!isCurrentHandler.value) return '非办理人';
  return '不可补录';
});

const hasEnterpriseEvidence = computed(() => {
  if (!order.value) return false;
  return !!(order.value.enterprise_name && order.value.contact_person && order.value.contact_phone);
});

const enterpriseMissingFields = computed(() => {
  if (!order.value) return [];
  const missing = [];
  if (!order.value.enterprise_name) missing.push('企业名称');
  if (!order.value.contact_person) missing.push('联系人');
  if (!order.value.contact_phone) missing.push('联系电话');
  return missing;
});

const enterpriseBlocked = computed(() => enterpriseMissingFields.value.length > 0);

const canReview = computed(() => {
  if (!order.value || !userStore.currentUser) return false;
  return userStore.currentUser.role === 'REVIEWER' &&
         order.value.current_stage === 'REVIEW_ARCHIVE' &&
         ['HANDLED', 'REVIEWED'].includes(order.value.status);
});

onMounted(() => { loadDetail(); });

watch(() => userStore.currentUser?.id, () => { loadDetail(); });

async function loadDetail() {
  loading.value = true;
  const res = await api.get('/clue-orders/' + orderNo);
  if (res.success) {
    order.value = { ...res.data.order, ...res.data.enterprise };
    enterprise.value = res.data.enterprise;
    followups.value = res.data.followups || [];
    signings.value = res.data.signings || [];
    logs.value = res.data.logs || [];
    evidence.value = res.data.evidence || evidence.value;
  }
  loading.value = false;
}

function showAlertMsg(type, message, title, details) {
  alert.value = { type, message, title, details };
  setTimeout(() => { alert.value = null; }, 8000);
}

async function doHandle() {
  handleAlert.value = null;
  const payload = { clientVersion: order.value.version };

  if (handleForm.value.addFollowup) {
    const f = handleForm.value.followup;
    if (!f.visit_date || !f.content) {
      handleAlert.value = { type: 'error', message: '跟进拜访缺少日期或内容' };
      return;
    }
    payload.followup = { ...f };
  }
  if (handleForm.value.addSigning) {
    const s = handleForm.value.signing;
    if (!s.contract_amount || !s.signing_date) {
      handleAlert.value = { type: 'error', message: '签约确认缺少金额或日期' };
      return;
    }
    payload.signing = { ...s };
  }
  if (!payload.followup && !payload.signing) {
    handleAlert.value = { type: 'error', message: '至少需要提供跟进拜访或签约确认之一' };
    return;
  }

  const res = await api.post('/clue-orders/' + orderNo + '/handle', payload);
  if (res.success) {
    showAlertMsg('success', res.message);
    showHandleModal.value = false;
    await loadDetail();
  } else {
    const isVersionIssue = res.error === 'VERSION_CONFLICT' || res.error === 'CLIENT_VERSION_REQUIRED';
    handleAlert.value = {
      type: 'error',
      title: `办理被拦截 [${res.error}]`,
      message: res.message + (isVersionIssue ? '（页面已自动刷新，请核对最新状态后再操作）' : ''),
      details: res.details
    };
    await loadDetail();
  }
}

async function doReview() {
  if (!confirm('确认复核归档？证据齐全后才能归档。注意：归档后禁止再补录。')) return;
  const res = await api.post('/clue-orders/' + orderNo + '/review', {
    clientVersion: order.value.version, action: 'approve'
  });
  if (res.success) {
    showAlertMsg('success', res.message);
    await loadDetail();
  } else {
    const isVersionIssue = res.error === 'VERSION_CONFLICT' || res.error === 'CLIENT_VERSION_REQUIRED';
    showAlertMsg(
      'error',
      res.message + (isVersionIssue ? '（页面已自动刷新，请核对最新状态后再操作）' : ''),
      `复核被拦截 [${res.error}]`,
      res.details
    );
    await loadDetail();
  }
}

async function doReject() {
  if (!rejectForm.value.reason) {
    showAlertMsg('error', '请填写驳回原因');
    return;
  }
  const res = await api.post('/clue-orders/' + orderNo + '/review', {
    clientVersion: order.value.version, action: 'reject', rejectReason: rejectForm.value.reason
  });
  if (res.success) {
    showAlertMsg('success', res.message);
    showRejectModal.value = false;
    rejectForm.value = { reason: '' };
    await loadDetail();
  } else {
    const isVersionIssue = res.error === 'VERSION_CONFLICT' || res.error === 'CLIENT_VERSION_REQUIRED';
    showAlertMsg('error', res.message + (isVersionIssue ? '（页面已自动刷新）' : ''), `驳回被拦截 [${res.error}]`, res.details);
    await loadDetail();
  }
}

async function addFollowup() {
  const f = followupForm.value;
  if (!f.visit_date || !f.content) {
    showAlertMsg('error', '请填写拜访日期和内容');
    return;
  }
  const res = await api.post('/follow-up-records', {
    order_no: order.value.order_no,
    clientVersion: order.value.version,
    clue_no: order.value.clue_no,
    ...f
  });
  if (res.success) {
    showAlertMsg('success', res.message + '，线索单证据与版本已同步更新');
    showFollowupModal.value = false;
    followupForm.value = { visit_date: '', location: '', participants: '', content: '' };
    await loadDetail();
  } else {
    const isVersionIssue = res.error === 'VERSION_CONFLICT' || res.error === 'CLIENT_VERSION_REQUIRED';
    showAlertMsg(
      'error',
      res.message + (isVersionIssue ? '（页面已自动刷新，请核对最新状态后再补录）' : ''),
      `补录跟进被拦截 [${res.error}]`,
      res.details
    );
    await loadDetail();
  }
}

async function addSigning() {
  const s = signingForm.value;
  if (!s.contract_amount || !s.signing_date) {
    showAlertMsg('error', '请填写合同金额和签约日期');
    return;
  }
  const res = await api.post('/signing-confirmations', {
    order_no: order.value.order_no,
    clientVersion: order.value.version,
    clue_no: order.value.clue_no,
    ...s
  });
  if (res.success) {
    showAlertMsg('success', res.message + '，线索单证据与版本已同步更新');
    showSigningModal.value = false;
    signingForm.value = { contract_amount: null, signing_date: '', contract_terms: '' };
    await loadDetail();
  } else {
    const isVersionIssue = res.error === 'VERSION_CONFLICT' || res.error === 'CLIENT_VERSION_REQUIRED';
    showAlertMsg(
      'error',
      res.message + (isVersionIssue ? '（页面已自动刷新，请核对最新状态后再补录）' : ''),
      `补录签约被拦截 [${res.error}]`,
      res.details
    );
    await loadDetail();
  }
}
</script>
