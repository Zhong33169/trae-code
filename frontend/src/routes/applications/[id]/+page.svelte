<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { currentUser } from '$lib/stores';
  import { apiGet, apiPost, apiPostFull } from '$lib/api';
  import {
    STATUS_LABEL, STATUS_COLOR, RISK_LABEL, RISK_COLOR,
    ROLE_LABEL, EVIDENCE_LABEL, ACTION_LABEL, RESULT_LABEL
  } from '$lib/types';
  import type { FinancingApplication, OperationRecord } from '$lib/types';

  let loading = true;
  let app: FinancingApplication | null = null;
  let records: OperationRecord[] = [];
  let toast: { msg: string; type: string } | null = null;
  let interval: any;

  let showProcessModal = false;
  let processAction = '';
  let processOpinion = '';
  let processNewRisk: string | null = null;
  let showSubmitModal = false;
  let submitEvidence: string[] = [];
  let submitOpinion = '';
  let showAuditModal = false;
  let auditPass = false;
  let auditRemark = '';
  let auditRisk: string | null = null;

  onMount(async () => {
    await loadData();
    interval = setInterval(loadData, 15000);
  });
  onDestroy(() => { if (interval) clearInterval(interval); });

  async function loadData() {
    try {
      const id = $page.params.id;
      const data = await apiGet<any>(`/api/applications/${id}`);
      app = data.application;
      records = data.records;
      loading = false;
    } catch (e: any) {
      showToast(e.message || '加载失败', 'error');
      loading = false;
    }
  }

  function showToast(msg: string, type = 'info') {
    toast = { msg, type };
    setTimeout(() => toast = null, 3500);
  }

   let isMine = false;
  let role = '';
  let evidenceMissing: string[] = [];
  let canSubmit = false;
  let auditorActions: any[] = [];
  let canAudit = false;
  $: {
	  isMine = !!($currentUser && app && $currentUser.id === app.current_handler);
    role = $currentUser?.role || '';
    evidenceMissing = (app?.required_evidence || []).filter(r => !(app?.submitted_evidence || []).includes(r));
    canSubmit = role === 'REGISTRAR' && isMine && (app?.status === 'DRAFT' || app?.status === 'RETURNED_FOR_CORRECTION' || app?.status === 'EVIDENCE_MISSING');
    auditorActions = getAuditorActions();
    canAudit = role === 'REVIEWER' && isMine && app?.status === 'REVIEW_PENDING';
  }


  function getAuditorActions() {
    if (!app || !isMine || role !== 'AUDITOR') return [];
    const list: Array<{id: string, label: string, btn: string, explain: string, warn?: boolean, danger?: boolean}> = [];
    if (app.status === 'PENDING_VERIFICATION') {
      list.push({ id: 'VERIFY_PASS_AND_FORWARD', label: '核验通过并转复核', btn: 'success',
        explain: '证据齐全、风险可控，直接提交给复核负责人归档' });
      list.push({ id: 'VERIFY_PASS', label: '核验通过（暂存）', btn: 'info',
        explain: '核验通过但还需进一步核查，状态变为「核验通过待转」' });
      list.push({ id: 'VERIFY_FAIL_EVIDENCE', label: '核验不通过（缺证据）', btn: 'warning',
        explain: '证据缺失，退回登记员补充材料', warn: true });
      list.push({ id: 'VERIFY_RETURN_CORRECTION', label: '核验退回补正', btn: 'warning',
        explain: '数据不一致/比例异常，退回登记员核对后补正', warn: true });
      list.push({ id: 'VERIFY_FAIL_OVERDUE', label: '核验标记逾期/不良', btn: 'danger',
        explain: '存在逾期/不良征信记录，标记专项处理', danger: true });
      list.push({ id: 'VERIFY_CONFLICT', label: '核验标记状态冲突', btn: 'danger',
        explain: '多系统/渠道数据存在冲突待核查', danger: true });
    }
    if (app.status === 'VERIFICATION_PASSED') {
      list.push({ id: 'FORWARD', label: '转送复核负责人', btn: 'success',
        explain: '核验工作完成，正式流转到复核阶段' });
    }
    if (app.status === 'OVERDUE' || app.status === 'STATUS_CONFLICT') {
      list.push({ id: 'VERIFY_PASS_AND_FORWARD', label: '核查完毕并转复核', btn: 'success',
        explain: '逾期/冲突问题已核查清楚，可继续流转' });
    }
    return list;
  }

  function openProcess(action: string) {
    if (!app) return;
    processAction = action;
    processOpinion = '';
    processNewRisk = null;
    showProcessModal = true;
  }

  async function doProcess() {
    if (!app || !$currentUser) return;
    if (!processOpinion.trim()) { showToast('请填写处理意见', 'warning'); return; }
    try {
      const r = await apiPostFull<any>('/api/applications/process', {
        application_id: app.id,
        operator_id: $currentUser.id,
        action: processAction,
        opinion: processOpinion,
        expected_version: app.version,
        new_risk_level: processNewRisk || undefined
      });
      const st = r.status || app.status;
      const rs = r.last_result || '已处理';
      showToast(`处理成功：${RESULT_LABEL[rs] || rs}，当前状态 ${STATUS_LABEL[st] || st}（v${r.version}）`, 'success');
      showProcessModal = false;
      await loadData();
    } catch (e: any) {
      showToast(e.message || '处理失败', 'error');
    }
  }

  function openSubmit() {
    if (!app) return;
    submitEvidence = [...(app.submitted_evidence || [])];
    submitOpinion = '';
    showSubmitModal = true;
  }

  function toggleSubmitEvidence(key: string) {
    const i = submitEvidence.indexOf(key);
    if (i >= 0) submitEvidence.splice(i, 1);
    else submitEvidence.push(key);
  }

  async function doSubmit() {
    if (!app || !$currentUser) return;
    try {
      const r = await apiPostFull<any>('/api/applications/submit', {
        application_id: app.id,
        operator_id: $currentUser.id,
        submitted_evidence: submitEvidence,
        opinion: submitOpinion || undefined,
        expected_version: app.version
      });
      const st = r.status || app.status;
      showToast(`提交成功，状态：${STATUS_LABEL[st] || st}（v${r.version}）`, 'success');
      showSubmitModal = false;
      await loadData();
    } catch (e: any) { showToast(e.message || '提交失败', 'error'); }
  }

  function openAudit(pass: boolean) {
    auditPass = pass;
    auditRemark = '';
    auditRisk = app?.risk_level || null;
    showAuditModal = true;
  }

  async function doAudit() {
    if (!app || !$currentUser) return;
    if (!auditRemark.trim()) { showToast('请填写复核意见', 'warning'); return; }
    try {
      const r = await apiPostFull<any>('/api/applications/audit', {
        application_id: app.id,
        operator_id: $currentUser.id,
        pass: auditPass,
        remark: auditRemark,
        expected_version: app.version,
        new_risk_level: auditRisk || undefined
      });
      const rs = r.last_result || (auditPass ? 'ARCHIVED' : 'REJECTED');
      showToast(`复核完成：${RESULT_LABEL[rs] || rs}（v${r.version}）`, 'success');
      showAuditModal = false;
      await loadData();
    } catch (e: any) { showToast(e.message || '复核失败', 'error'); }
  }

  function recordClass(r: OperationRecord) {
    if (r.action === 'RISK_UPGRADE' || r.action === 'RISK_DOWNGRADE') return 'risk-change';
    if (['REVIEW_PASS_ARCHIVE','ARCHIVED','VERIFY_PASS','AUDIT_PASS'].includes(r.action) || r.result === 'ARCHIVED') return 'success';
    if (['VERIFY_FAIL_OVERDUE','VERIFY_CONFLICT','REJECTED','REVIEW_REJECT','VERIFY_RETURN_CORRECTION','VERIFY_FAIL_EVIDENCE']
          .includes(r.action) || ['OVERDUE','CONFLICT','RETURNED','EVIDENCE_MISSING','REJECTED'].includes(r.result))
      return 'critical-action';
    return '';
  }
</script>

{#if loading && !app}
  <div class="card"><div class="card-body"><div class="empty-state"><div class="icon">⏳</div>加载中...</div></div></div>
{:else if !app}
  <div class="card"><div class="card-body"><div class="empty-state"><div class="icon">❓</div>申请单不存在</div></div></div>
{:else}
  <a href="/" class="back-link" data-sveltekit-preload-data>← 返回工作台</a>

  <!-- 风险提示 -->
  {#if isMine && (app.risk_level === 'CRITICAL' || app.risk_level === 'HIGH')}
    <div class="alert {app.risk_level === 'CRITICAL' ? 'alert-danger' : 'alert-warning'}">
      <span>{app.risk_level === 'CRITICAL' ? '' : ''}</span>
      <div>
        <b>风险提示：</b>该申请单当前评级为 <b>{RISK_LABEL[app.risk_level]}</b>，
        处理时请审慎。调整风险等级（升/降）会写入操作记录永久留痕。
      </div>
    </div>
  {/if}

  <div class="card">
    <div class="detail-header" style="padding: 20px 24px; margin:0; border-bottom: 1px solid var(--border);">
      <div class="detail-title">
        <h2>
          {app.applicant_name} 的融资申请
          {#if app.risk_level === 'CRITICAL'}
            <span class="badge-highlight critical">{RISK_LABEL[app.risk_level]}</span>
          {:else if app.risk_level === 'HIGH'}
            <span class="badge-highlight high">{RISK_LABEL[app.risk_level]}</span>
          {:else}
            <span class="tag tag-risk" style="background:{RISK_COLOR[app.risk_level]}">{RISK_LABEL[app.risk_level]}</span>
          {/if}
          <span class="tag tag-status" style="background:{STATUS_COLOR[app.status]}">{STATUS_LABEL[app.status]}</span>
        </h2>
        <div class="no">申请编号：<b style="font-family: ui-monospace;">{app.application_no}</b> · 版本 v{app.version} · 创建于 {new Date(app.created_at).toLocaleString('zh-CN')}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:34px; line-height: 1.1; color: var(--primary); font-weight: 700;" class="money">
          ¥{app.financing_amount.toLocaleString()}
        </div>
        <div style="font-size:13px; color:var(--text-muted); margin-top:4px">期限 {app.financing_term_months} 个月</div>
      </div>
    </div>

    <!-- 处理工具栏：展示当前处理人能做什么 -->
    <div class="actions-toolbar">
      <div style="font-size:13px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-right:auto;">
        <span style="color:var(--text-muted)">当前处理人：</span>
        <b>{app.current_handler_name || app.current_handler}</b>
        <span class="tag" style="background: #eff6ff; color: var(--primary);">{ROLE_LABEL[app.current_handler_role || '']}</span>
        {#if isMine}
          <span class="tag" style="background: #dcfce7; color: var(--success);">✓ 是我</span>
        {/if}
      </div>

      {#if isMine}
        {#if canSubmit}
          <button class="primary" on:click={openSubmit}>
            {app.status === 'DRAFT' ? '提交审核' : '补正后重新提交'}
          </button>
        {/if}
        {#each auditorActions as a}
          <button class="{a.btn}" on:click={() => openProcess(a.id)}>{a.label}</button>
        {/each}
        {#if canAudit}
          <button class="success" on:click={() => openAudit(true)}>✅ 复核通过并归档</button>
          <button class="danger" on:click={() => openAudit(false)}>❌ 复核驳回</button>
        {/if}
      {:else if $currentUser}
        <span style="font-size:12px; color: var(--text-muted); padding: 4px 8px;">
          您不是当前处理人，仅可查看详情与操作记录
        </span>
      {/if}
    </div>

    <div class="card-body">
      <div class="detail-meta" style="margin-bottom: 20px;">
        <span>创建人：<b>{app.created_by_name || app.created_by}</b></span>
        <span>最近更新：<b>{new Date(app.updated_at).toLocaleString('zh-CN')}</b></span>
        {#if app.last_handler_id}
          <span>上一处理：<b>{app.last_handler_name}</b>（{ROLE_LABEL[app.last_handler_role || '']}）</span>
        {/if}
      </div>

      <!-- 上一处理人意见，详情重点 -->
      <div class="last-handler-box {app.last_handler_id ? '' : 'no-history'}">
        <div class="last-handler-title">💬 上一处理人的意见与结果（详情必看）</div>
        {#if app.last_handler_id}
          <div class="last-handler-content">
            <b>{app.last_handler_name}</b>
            <span class="tag" style="background: #eff6ff; color: var(--primary);">{ROLE_LABEL[app.last_handler_role || '']}</span>
            {#if app.last_result}
              <span class="tag" style="background: var(--success); color: white;">结果：{RESULT_LABEL[app.last_result] || app.last_result}</span>
            {/if}
          </div>
          {#if app.last_opinion}
            <div class="last-handler-opinion">「 {app.last_opinion} 」</div>
          {/if}
        {:else}
          <div style="color: var(--text-muted); font-size: 13px;">
            — 该申请单尚未被处理过，请按角色职责进行首次操作 —
          </div>
        {/if}
      </div>

      <h3 style="font-size:14px;margin-bottom:12px;color:var(--text-muted);letter-spacing:.02em;text-transform:uppercase">
        申请人与企业信息
      </h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">申请人姓名</span>
          <span class="info-value">{app.applicant_name}</span>
        </div>
        <div class="info-item">
          <span class="info-label">申请人身份证号</span>
          <span class="info-value" style="font-family: ui-monospace;">{app.applicant_id_card}</span>
        </div>
        <div class="info-item">
          <span class="info-label">企业名称</span>
          <span class="info-value">{app.company_name}</span>
        </div>
        <div class="info-item">
          <span class="info-label">企业统一社会信用代码</span>
          <span class="info-value" style="font-family: ui-monospace;">{app.company_credit_code}</span>
        </div>
        <div class="info-item">
          <span class="info-label">融资金额</span>
          <span class="info-value money">¥{app.financing_amount.toLocaleString()}</span>
        </div>
        <div class="info-item">
          <span class="info-label">融资期限</span>
          <span class="info-value">{app.financing_term_months} 个月</span>
        </div>
      </div>

      <h3 style="font-size:14px;margin:20px 0 12px;color:var(--text-muted);letter-spacing:.02em;text-transform:uppercase">
        证据材料检查
      </h3>
      {#if evidenceMissing.length > 0}
        <div class="alert alert-warning">
          <span>📎</span>
          <div>缺失 <b>{evidenceMissing.length}</b> 项必填证据：
            {evidenceMissing.map(e => EVIDENCE_LABEL[e] || e).join('、')}
            {#if role === 'REGISTRAR' && isMine && app.status !== 'PENDING_VERIFICATION'}
              ，请点击"补正后重新提交"补充。
            {/if}
          </div>
        </div>
      {:else}
        <div class="alert alert-success">
          <span>✅</span>
          <div>所有 <b>{app.required_evidence.length}</b> 项必填证据均已提交，材料齐全</div>
        </div>
      {/if}
      <div class="evidence-list">
        {#each app.required_evidence as key}
          <div class="evidence-item"
            class:submitted={app.submitted_evidence.includes(key)}
            class:missing={!app.submitted_evidence.includes(key)}>
            <span class="evidence-icon">{app.submitted_evidence.includes(key) ? '✅' : '❌'}</span>
            <span>{EVIDENCE_LABEL[key] || key}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- 时间线：操作记录 -->
  <div class="card" style="margin-top: 24px;">
    <div class="card-header">
      <h2>📜 操作记录 / 流程时间线（所有操作永久留痕）</h2>
      <span style="font-size:12px;color:var(--text-muted)">共 {records.length} 条记录</span>
    </div>
    <div class="card-body">
      {#if records.length === 0}
        <div class="empty-state"><div class="icon">📭</div>暂无操作记录</div>
      {:else}
        <div class="timeline">
          {#each records as r (r.id)}
            <div class="timeline-item {recordClass(r)}">
              <div class="timeline-time">{new Date(r.created_at).toLocaleString('zh-CN')}</div>
              <div class="timeline-head">
                <span class="timeline-action">{ACTION_LABEL[r.action] || r.action}</span>
                <span class="tag" style="background:#f1f5f9;color:#334155;">
                  {r.operator_name || r.operator_id}
                </span>
                <span class="tag" style="background:#eff6ff;color:var(--primary)">
                  {ROLE_LABEL[r.operator_role] || r.operator_role}
                </span>
                {#if r.from_status && r.to_status && r.from_status !== r.to_status}
                  <span class="tag" style="background:#fef3c7;color:#92400e">
                    {STATUS_LABEL[r.from_status]} → {STATUS_LABEL[r.to_status]}
                  </span>
                {/if}
                {#if r.from_risk_level && r.to_risk_level && r.from_risk_level !== r.to_risk_level}
                  <span class="tag" style="background:#fee2e2;color:#991b1b;font-weight:600">
                     风险变更：{RISK_LABEL[r.from_risk_level]} → {RISK_LABEL[r.to_risk_level]}
                  </span>
                {/if}
              </div>
              {#if r.opinion}
                <div class="timeline-opinion">💭 {r.opinion}</div>
              {/if}
              <div class="timeline-meta">
                <span>结果：<b style="color:#334155">{RESULT_LABEL[r.result] || r.result}</b></span>
                <span>版本：v{r.version_before} → v{r.version_after}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- 提交/补正 Modal -->
  {#if showSubmitModal}
    <div class="modal-overlay" on:click={(e) => { if (e.target === e.currentTarget) showSubmitModal = false; }}>
      <div class="modal" style="max-width: 560px;">
        <div class="modal-header">
          <h3>
            {app.status === 'DRAFT' ? '提交审核' : '补正后重新提交'}
          </h3>
          <button class="close-btn" on:click={() => showSubmitModal = false}>×</button>
        </div>
        <div class="modal-body">
          {#if app.status !== 'DRAFT' && app.last_opinion}
            <div class="alert alert-info">
              <span></span>
              <div>
                <b>上一处理人（{app.last_handler_name}）的意见：</b><br>
                {app.last_opinion}
              </div>
            </div>
          {/if}
          <div class="form-item">
            <label>勾选已提交的证据（必填项需全部勾选）</label>
            <div class="evidence-list">
              {#each app.required_evidence as key}
                <label class="evidence-item" style="cursor:pointer;user-select:none"
                  class:submitted={submitEvidence.includes(key)}
                  class:missing={!submitEvidence.includes(key)}>
                  <input type="checkbox" checked={submitEvidence.includes(key)}
                    on:change={() => toggleSubmitEvidence(key)} style="width:auto;margin-right:4px">
                  <span>{EVIDENCE_LABEL[key] || key}</span>
                </label>
              {/each}
            </div>
          </div>
          <div class="form-item">
            <label>处理说明（建议填写补充了哪些内容）</label>
            <textarea bind:value={submitOpinion}
              placeholder={app.status === 'DRAFT'
                ? '如：信息已核对无误，申请主管审核'
                : '例如：已补正财务报表数据，调整营收/金额比例，请复核'} rows={3}></textarea>
          </div>
          <div style="font-size:11px;color:var(--text-muted)">
            后端校验项：当前处理人、角色{role}、状态{app.status}、版本v{app.version}、必填证据齐全
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary" on:click={() => showSubmitModal = false}>取消</button>
          <button class="primary" on:click={doSubmit}>
            {app.status === 'DRAFT' ? '提交审核' : '补正并提交'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- 审核主管处理 Modal -->
  {#if showProcessModal && app}
    <div class="modal-overlay" on:click={(e) => { if (e.target === e.currentTarget) showProcessModal = false; }}>
      <div class="modal" style="max-width: 600px;">
        <div class="modal-header">
          <h3>🔍 {auditorActions.find(x=>x.id===processAction)?.label || processAction}</h3>
          <button class="close-btn" on:click={() => showProcessModal = false}>×</button>
        </div>
        <div class="modal-body">
          <div class="alert alert-info">
            <span>ℹ️</span>
            <div>{auditorActions.find(x=>x.id===processAction)?.explain || ''}</div>
          </div>
          <div class="form-item">
            <label>处理意见 *</label>
            <textarea bind:value={processOpinion} rows={4}
              placeholder="请填写具体核查结论，如：材料齐全且相互印证，风险在可接受范围 / 财务报表与税务数据存在 12% 差异待补正 / 经核查征信存在逾期 3 次等"></textarea>
          </div>
          <div class="form-item">
            <label>
              风险等级调整
              <span style="font-weight:normal;color:var(--text-muted);font-size:12px">
                （留痕在操作记录中；如不修改请保持原等级）
              </span>
            </label>
            <select bind:value={processNewRisk}>
              <option value="">保持不变（当前：{RISK_LABEL[app.risk_level]}）</option>
              <option value="LOW">低风险</option>
              <option value="MEDIUM">中风险</option>
              <option value="HIGH">高风险</option>
              <option value="CRITICAL">极高风险</option>
            </select>
          </div>
          <div style="font-size:11px;color:var(--text-muted)">
            后端校验：当前处理人、角色{role}、状态{app.status}、版本v{app.version}
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary" on:click={() => showProcessModal = false}>取消</button>
          <button class="primary" on:click={doProcess}>确认处理</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- 复核 Modal -->
  {#if showAuditModal && app}
    <div class="modal-overlay" on:click={(e) => { if (e.target === e.currentTarget) showAuditModal = false; }}>
      <div class="modal" style="max-width: 600px;">
        <div class="modal-header">
          <h3>{auditPass ? '✅ 复核通过并归档' : '❌ 复核驳回'}</h3>
          <button class="close-btn" on:click={() => showAuditModal = false}>×</button>
        </div>
        <div class="modal-body">
          {#if app.last_opinion}
            <div class="alert alert-info">
              <span>📋</span>
              <div>
                <b>上一处理（{app.last_handler_name}）意见：</b><br>{app.last_opinion}
              </div>
            </div>
          {/if}
          <div class="form-item">
            <label>复核意见 *</label>
            <textarea bind:value={auditRemark} rows={4}
              placeholder={auditPass
                ? '例如：经全面复核，材料真实有效、风险可控、审核流程合规，同意归档'
                : '例如：抵押物估值报告过期 / 保证人偿债能力不足等，本次驳回'}></textarea>
          </div>
          <div class="form-item">
            <label>
              风险等级最终认定
              <span style="font-weight:normal;color:var(--text-muted);font-size:12px">
                （变更会写入操作记录永久留痕）
              </span>
            </label>
            <select bind:value={auditRisk}>
              <option value="">保持不变（当前：{RISK_LABEL[app.risk_level]}）</option>
              <option value="LOW">低风险</option>
              <option value="MEDIUM">中风险</option>
              <option value="HIGH">高风险</option>
              <option value="CRITICAL">极高风险</option>
            </select>
          </div>
          <div style="font-size:11px;color:var(--text-muted)">
            后端校验：当前处理人、角色REVIEWER、状态{app.status}、版本v{app.version}
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary" on:click={() => showAuditModal = false}>取消</button>
          <button class={auditPass ? 'success' : 'danger'} on:click={doAudit}>
            确认{auditPass ? '归档' : '驳回'}
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}

{#if toast}
  <div class="toast {toast.type}">
    <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
    <span>{toast.msg}</span>
  </div>
{/if}
