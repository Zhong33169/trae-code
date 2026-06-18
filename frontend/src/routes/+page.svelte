<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser } from '$lib/stores';
  import { apiGet } from '$lib/api';
  import {
    STATUS_LABEL, STATUS_COLOR, RISK_LABEL, RISK_COLOR, RISK_BG,
    ROLE_LABEL, EVIDENCE_LABEL, RESULT_LABEL
  } from '$lib/types';
  import type { FinancingApplication, Statistics } from '$lib/types';
  import { goto } from '$app/navigation';

  let loading = true;
  let all: FinancingApplication[] = [];
  let stats: Statistics | null = null;
  let toast: { msg: string; type: string } | null = null;
  let showCreateModal = false;
  let newForm: any = {
    applicant_name: '', applicant_id_card: '', company_name: '', company_credit_code: '',
    financing_amount: 1000000, financing_term_months: 12, risk_level: 'MEDIUM',
    required_evidence: [] as string[], submitted_evidence: [] as string[]
  };

  function openCreateModal() {
    newForm = {
      applicant_name: '', applicant_id_card: '', company_name: '', company_credit_code: '',
      financing_amount: 1000000, financing_term_months: 12, risk_level: 'MEDIUM',
      required_evidence: ['business_license','financial_statement','tax_certificate'],
      submitted_evidence: [] as string[]
    };
    showCreateModal = true;
  }
  function showCreateModalFn() { openCreateModal(); }

  async function submitCreate() {
    if (!$currentUser) return;
    try {
      if (!newForm.applicant_name || !newForm.applicant_id_card || !newForm.company_name
          || !newForm.company_credit_code || newForm.financing_amount <= 0) {
        showToast('请填写必填项并确保金额>0', 'warning'); return;
      }
      if (newForm.required_evidence.length === 0) {
        showToast('请至少选择一项必填证据', 'warning'); return;
      }
      const r = await apiPost<any>('/api/applications', {
        ...newForm, operator_id: $currentUser.id
      });
      showToast(`申请单 ${r.application_no} 创建成功`, 'success');
      showCreateModal = false;
      await loadData();
      goto(`/applications/${r.id}`);
    } catch (e: any) { showToast(e.message || '创建失败', 'error'); }
  }

  function toggleRequired(ev: string) {
    const i = newForm.required_evidence.indexOf(ev);
    if (i >= 0) newForm.required_evidence.splice(i, 1);
    else newForm.required_evidence.push(ev);
  }
  function toggleSubmitted(ev: string) {
    const i = newForm.submitted_evidence.indexOf(ev);
    if (i >= 0) newForm.submitted_evidence.splice(i, 1);
    else newForm.submitted_evidence.push(ev);
  }

  $: myPending: FinancingApplication[] = $currentUser
    ? all.filter(a => a.current_handler === $currentUser!.id
        && !['ARCHIVED','REJECTED'].includes(a.status))
    : [];
  $: myCreated: FinancingApplication[] = $currentUser
    ? all.filter(a => a.created_by === $currentUser!.id)
    : [];
  $: highRiskList: FinancingApplication[] = all.filter(a =>
    ['HIGH','CRITICAL'].includes(a.risk_level));

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      const [apps, st] = await Promise.all([
        apiGet<any>($currentUser
          ? `/api/applications?role=${$currentUser.role}`
          : '/api/applications'),
        apiGet<any>('/api/statistics'),
      ]);
      all = apps.applications;
      stats = st;
    } catch (e: any) {
      showToast(e.message || '数据加载失败', 'error');
    } finally {
      loading = false;
    }
  }

  function showToast(msg: string, type = 'info') {
    toast = { msg, type };
    setTimeout(() => toast = null, 3000);
  }

  function evidenceStatusStr(a: FinancingApplication) {
    const req: string[] = a.required_evidence || [];
    const subm: string[] = a.submitted_evidence || [];
    const miss = req.filter(r => !subm.includes(r));
    return { submitted: subm.length, required: req.length, missing: miss };
  }

  function nextActionHint(a: FinancingApplication): string {
    if (!$currentUser) return '';
    const u = $currentUser;
    const isMine = a.current_handler === u.id;
    if (!isMine) return `当前处理人：${a.current_handler_name || a.current_handler}`;
    switch (u.role) {
      case 'REGISTRAR':
        if (a.status === 'DRAFT') return '👉 您需要填写完整后提交审核';
        if (a.status === 'RETURNED_FOR_CORRECTION') return '👉 请按上一处理人意见补正后重新提交';
        if (a.status === 'EVIDENCE_MISSING') return '👉 请补充缺失的证据后提交';
        break;
      case 'AUDITOR':
        if (a.status === 'PENDING_VERIFICATION') return '👉 请核验材料完整性与风险状况';
        if (a.status === 'OVERDUE') return '⚠️ 含逾期/不良记录，请专项审议或转复核';
        if (a.status === 'STATUS_CONFLICT') return '⚠️ 存在状态冲突，请核查后处理';
        if (a.status === 'VERIFICATION_PASSED') return '👉 核验完成，请转复核负责人';
        break;
      case 'REVIEWER':
        if (a.status === 'REVIEW_PENDING') return '👉 请复核并归档或驳回';
        break;
    }
    return '';
  }

  function isHighRisk(risk: string) {
    return risk === 'HIGH' || risk === 'CRITICAL';
  }
</script>

{#if $currentUser}

  <!-- 关键指标卡 -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">待我处理队列</div>
      <div class="stat-value">{myPending.length}</div>
      <div class="stat-sub">
        {#if $currentUser.role === 'REGISTRAR'}
          {#each ['DRAFT','RETURNED_FOR_CORRECTION','EVIDENCE_MISSING'] as s}
            {myPending.filter(a=>a.status===s).length} {STATUS_LABEL[s]} ·
          {/each}
        {:else if $currentUser.role === 'AUDITOR'}
          {#each ['PENDING_VERIFICATION','OVERDUE','STATUS_CONFLICT','VERIFICATION_PASSED'] as s}
            {myPending.filter(a=>a.status===s).length} {STATUS_LABEL[s]} ·
          {/each}
        {:else}
          {myPending.filter(a=>a.status==='REVIEW_PENDING').length} 待复核 ·
          {myPending.filter(a=>a.status==='ARCHIVED').length} 已归档
        {/if}
      </div>
    </div>
    <div class="stat-card danger">
      <div class="stat-label">高/极高风险申请单</div>
      <div class="stat-value danger">{highRiskList.length}</div>
      <div class="stat-sub">
        CRITICAL {highRiskList.filter(a=>a.risk_level==='CRITICAL').length} ·
        HIGH {highRiskList.filter(a=>a.risk_level==='HIGH').length}
      </div>
    </div>
    <div class="stat-card success">
      <div class="stat-label">已归档金额</div>
      <div class="stat-value">¥{(stats?.archived_amount || 0).toLocaleString()}</div>
      <div class="stat-sub">共 {stats?.count_by_status?.ARCHIVED || 0} 笔通过复核</div>
    </div>
    <div class="stat-card info">
      <div class="stat-label">申请单总数</div>
      <div class="stat-value">{stats?.total || 0}</div>
      <div class="stat-sub">总金额 ¥{(stats?.total_amount || 0).toLocaleString()}</div>
    </div>
  </div>

  <!-- 按角色的待办队列入口按钮 -->
  <div class="queue-badges">
    {#if $currentUser.role === 'REGISTRAR'}
      <button class="secondary sm" on:click={() => goto('/applications?status=DRAFT')}>
        📝 草稿 ({myPending.filter(a=>a.status==='DRAFT').length})
      </button>
      <button class="secondary sm" on:click={() => goto('/applications?status=RETURNED_FOR_CORRECTION')}>
        🔄 退回补正 ({myPending.filter(a=>a.status==='RETURNED_FOR_CORRECTION').length})
      </button>
      <button class="secondary sm" on:click={() => goto('/applications?status=EVIDENCE_MISSING')}>
        📎 缺证据 ({myPending.filter(a=>a.status==='EVIDENCE_MISSING').length})
      </button>
      <button class="primary sm" on:click={() => openCreateModal()}>+ 新建融资申请单</button>
    {:else if $currentUser.role === 'AUDITOR'}
      <button class="primary sm" on:click={() => goto('/applications?status=PENDING_VERIFICATION')}>
        ⏳ 待核验 ({myPending.filter(a=>a.status==='PENDING_VERIFICATION').length})
      </button>
      <button class="warning sm" on:click={() => goto('/applications?status=OVERDUE')}>
        ⚠️ 逾期/不良 ({myPending.filter(a=>a.status==='OVERDUE').length})
      </button>
      <button class="secondary sm" style="border-color: var(--purple); color: var(--purple);"
              on:click={() => goto('/applications?status=STATUS_CONFLICT')}>
        ⚡ 状态冲突 ({myPending.filter(a=>a.status==='STATUS_CONFLICT').length})
      </button>
      <button class="success sm" on:click={() => goto('/applications?status=VERIFICATION_PASSED')}>
        ✅ 核验通过待转 ({myPending.filter(a=>a.status==='VERIFICATION_PASSED').length})
      </button>
    {:else}
      <button class="primary sm" on:click={() => goto('/applications?status=REVIEW_PENDING')}>
        🧐 待我复核 ({myPending.filter(a=>a.status==='REVIEW_PENDING').length})
      </button>
      <button class="success sm" on:click={() => goto('/applications?status=ARCHIVED')}>
        📦 已归档 ({stats?.count_by_status?.ARCHIVED || 0})
      </button>
      <button class="danger sm" on:click={() => goto('/applications?status=REJECTED')}>
        ❌ 已驳回 ({stats?.count_by_status?.REJECTED || 0})
      </button>
    {/if}
    <div style="flex: 1;"></div>
    <button class="ghost sm" on:click={loadData}>🔄 刷新</button>
  </div>

  <!-- 我的待办：直接展示，而不是让用户先筛 -->
  {#if myPending.length > 0}
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <h2>📌 我的处理队列（按角色展示，共 {myPending.length} 条）</h2>
        <span style="font-size:12px; color: var(--text-muted)">
          高亮行为高风险/极高风险申请，需优先关注
        </span>
      </div>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>申请编号</th>
              <th>申请人/企业</th>
              <th>金额 / 期限</th>
              <th>风险等级</th>
              <th>当前状态</th>
              <th>材料</th>
              <th>上一处理意见</th>
              <th>下一步</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {#each myPending as a (a.id)}
              <tr class={a.risk_level === 'CRITICAL' ? 'critical-risk' : (a.risk_level === 'HIGH' ? 'high-risk' : '')}>
                <td>
                  <div style="font-weight: 600; color: var(--primary); font-family: ui-monospace;">
                    {a.application_no}
                  </div>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                    {new Date(a.created_at).toLocaleDateString('zh-CN')} 创建
                  </div>
                </td>
                <td>
                  <div style="font-weight: 500;">{a.applicant_name}</div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">{a.company_name}</div>
                </td>
                <td>
                  <div class="money" style="color: var(--primary); font-weight: 700;">
                    ¥{a.financing_amount.toLocaleString()}
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted);">{a.financing_term_months} 个月</div>
                </td>
                <td>
                  {#if isHighRisk(a.risk_level)}
                    <span class="badge-highlight {a.risk_level === 'CRITICAL' ? 'critical' : 'high'}">
                      🔴 {RISK_LABEL[a.risk_level]}
                    </span>
                  {:else}
                    <span class="tag tag-risk" style="background: {RISK_COLOR[a.risk_level]}">
                      {RISK_LABEL[a.risk_level]}
                    </span>
                  {/if}
                </td>
                <td>
                  <span class="tag tag-status" style="background: {STATUS_COLOR[a.status]}">
                    {STATUS_LABEL[a.status]}
                  </span>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                    v{a.version}
                  </div>
                </td>
                <td>
                  {@const ev = evidenceStatusStr(a)}
                  <div style="font-weight: 600; color: {ev.missing.length ? 'var(--danger)' : 'var(--success)'};">
                    {ev.submitted}/{ev.required}
                  </div>
                  {#if ev.missing.length}
                    <div style="font-size: 11px; color: var(--danger);">缺 {ev.missing.length} 项</div>
                  {/if}
                </td>
                <td style="max-width: 240px;">
                  {#if a.last_opinion}
                    <div style="font-size: 12px; line-height: 1.5; color: #334155; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                      {a.last_handler_name
                        ? `<b>${a.last_handler_name}</b>（${ROLE_LABEL[a.last_handler_role || '']}）：`
                        : ''}{a.last_opinion}
                    </div>
                    <div style="font-size: 11px; color: var(--success); margin-top: 2px;">
                      结果：{RESULT_LABEL[a.last_result || ''] || a.last_result}
                    </div>
                  {:else}
                    <span style="font-size: 12px; color: var(--text-muted);">— 首次处理 —</span>
                  {/if}
                </td>
                <td style="font-size: 12px; font-weight: 600; color: var(--primary); max-width: 180px; line-height: 1.5;">
                  {nextActionHint(a)}
                </td>
                <td>
                  <button class="primary sm" on:click={() => goto(`/applications/${a.id}`)}>
                    打开处理
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <!-- 高风险单独识别区 -->
  {#if highRiskList.length > 0}
    <div class="card" style="margin-bottom: 24px; border: 1px solid #fecaca; box-shadow: 0 0 0 1px #fecaca inset;">
      <div class="card-header" style="background: linear-gradient(90deg, #fef2f2, transparent); border-bottom-color: #fecaca;">
        <h2 style="color: var(--danger);">🚨 高/极高风险单独识别（{highRiskList.length} 笔）</h2>
        <span style="font-size: 12px; color: #991b1b;">降级或升级均会在操作记录中留痕</span>
      </div>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>申请编号</th>
              <th>申请人 / 企业</th>
              <th>金额</th>
              <th>风险等级</th>
              <th>当前状态</th>
              <th>处理人</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {#each highRiskList as a (a.id)}
              <tr class={a.risk_level === 'CRITICAL' ? 'critical-risk' : 'high-risk'}>
                <td style="font-family: ui-monospace; font-weight: 600;">{a.application_no}</td>
                <td>
                  <div>{a.applicant_name}</div>
                  <div style="font-size:12px;color:var(--text-muted)">{a.company_name}</div>
                </td>
                <td class="money" style="font-weight:700;color:var(--danger)">¥{a.financing_amount.toLocaleString()}</td>
                <td>
                  <span class="badge-highlight {a.risk_level === 'CRITICAL' ? 'critical' : 'high'}">
                    {a.risk_level === 'CRITICAL' ? '🔴🔴 ' : '🔴 '}
                    {RISK_LABEL[a.risk_level]}
                  </span>
                </td>
                <td><span class="tag tag-status" style="background:{STATUS_COLOR[a.status]}">{STATUS_LABEL[a.status]}</span></td>
                <td style="font-size:12px">
                  {a.current_handler_name}
                  <div style="color:var(--text-muted)">{ROLE_LABEL[a.current_handler_role || '']}</div>
                </td>
                <td><button class="danger sm" on:click={() => goto(`/applications/${a.id}`)}>查看与处理</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <!-- 各环节队列 -->
  <div class="grid-3">
    <div class="card">
      <div class="card-header" style="background: linear-gradient(180deg, #eff6ff, white);">
        <h2 style="color: var(--primary);">📝 登记 & 补正阶段</h2>
        <span class="tag tag-status" style="background: var(--primary);">
          {(stats?.count_by_status?.DRAFT||0)+(stats?.count_by_status?.RETURNED_FOR_CORRECTION||0)+(stats?.count_by_status?.EVIDENCE_MISSING||0)}
        </span>
      </div>
      <div class="card-body" style="padding:0">
        <table>
          <tbody>
            {#each all.filter(a=>['DRAFT','RETURNED_FOR_CORRECTION','EVIDENCE_MISSING'].includes(a.status)).slice(0,5) as a (a.id)}
              <tr>
                <td style="padding:10px 16px">
                  <div style="font-size:12px;font-family:ui-monospace;color:var(--primary);font-weight:600">{a.application_no}</div>
                  <div style="font-size:13px;margin-top:2px">{a.applicant_name} · {a.company_name}</div>
                  <div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    <span class="tag tag-status" style="background:{STATUS_COLOR[a.status]};font-size:11px">{STATUS_LABEL[a.status]}</span>
                    {#if isHighRisk(a.risk_level)}
                      <span class="badge-highlight {a.risk_level==='CRITICAL'?'critical':'high'}" style="font-size:10px;padding:1px 6px">
                        {RISK_LABEL[a.risk_level]}
                      </span>
                    {/if}
                    <span style="font-size:11px;color:var(--text-muted);margin-left:auto" class="money">¥{(a.financing_amount/10000).toFixed(0)}万</span>
                  </div>
                </td>
                <td style="width:80px;padding:10px 16px">
                  <button class="ghost sm" on:click={() => goto(`/applications/${a.id}`)}>详情</button>
                </td>
              </tr>
            {:else}
              <tr><td colspan="2"><div class="empty-state" style="padding:40px"><div class="icon">📭</div>暂无记录</div></td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header" style="background: linear-gradient(180deg, #fefce8, white);">
        <h2 style="color: var(--warning);">🔍 核验阶段</h2>
        <span class="tag tag-status" style="background: var(--warning);">
          {(stats?.count_by_status?.PENDING_VERIFICATION||0)+(stats?.count_by_status?.OVERDUE||0)+(stats?.count_by_status?.STATUS_CONFLICT||0)+(stats?.count_by_status?.VERIFICATION_PASSED||0)}
        </span>
      </div>
      <div class="card-body" style="padding:0">
        <table>
          <tbody>
            {#each all.filter(a=>['PENDING_VERIFICATION','OVERDUE','STATUS_CONFLICT','VERIFICATION_PASSED'].includes(a.status)).slice(0,5) as a (a.id)}
              <tr>
                <td style="padding:10px 16px">
                  <div style="font-size:12px;font-family:ui-monospace;color:var(--primary);font-weight:600">{a.application_no}</div>
                  <div style="font-size:13px;margin-top:2px">{a.applicant_name} · {a.company_name}</div>
                  <div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    <span class="tag tag-status" style="background:{STATUS_COLOR[a.status]};font-size:11px">{STATUS_LABEL[a.status]}</span>
                    {#if isHighRisk(a.risk_level)}
                      <span class="badge-highlight {a.risk_level==='CRITICAL'?'critical':'high'}" style="font-size:10px;padding:1px 6px">
                        {RISK_LABEL[a.risk_level]}
                      </span>
                    {/if}
                    <span style="font-size:11px;color:var(--text-muted);margin-left:auto" class="money">¥{(a.financing_amount/10000).toFixed(0)}万</span>
                  </div>
                </td>
                <td style="width:80px;padding:10px 16px">
                  <button class="ghost sm" on:click={() => goto(`/applications/${a.id}`)}>详情</button>
                </td>
              </tr>
            {:else}
              <tr><td colspan="2"><div class="empty-state" style="padding:40px"><div class="icon">📭</div>暂无记录</div></td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header" style="background: linear-gradient(180deg, #f0fdf4, white);">
        <h2 style="color: var(--success);">📦 复核归档</h2>
        <span class="tag tag-status" style="background: var(--success);">
          {(stats?.count_by_status?.REVIEW_PENDING||0)+(stats?.count_by_status?.ARCHIVED||0)+(stats?.count_by_status?.REJECTED||0)}
        </span>
      </div>
      <div class="card-body" style="padding:0">
        <table>
          <tbody>
            {#each all.filter(a=>['REVIEW_PENDING','ARCHIVED','REJECTED'].includes(a.status)).slice(0,5) as a (a.id)}
              <tr>
                <td style="padding:10px 16px">
                  <div style="font-size:12px;font-family:ui-monospace;color:var(--primary);font-weight:600">{a.application_no}</div>
                  <div style="font-size:13px;margin-top:2px">{a.applicant_name} · {a.company_name}</div>
                  <div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    <span class="tag tag-status" style="background:{STATUS_COLOR[a.status]};font-size:11px">{STATUS_LABEL[a.status]}</span>
                    {#if isHighRisk(a.risk_level)}
                      <span class="badge-highlight {a.risk_level==='CRITICAL'?'critical':'high'}" style="font-size:10px;padding:1px 6px">
                        {RISK_LABEL[a.risk_level]}
                      </span>
                    {/if}
                    <span style="font-size:11px;color:var(--text-muted);margin-left:auto" class="money">¥{(a.financing_amount/10000).toFixed(0)}万</span>
                  </div>
                </td>
                <td style="width:80px;padding:10px 16px">
                  <button class="ghost sm" on:click={() => goto(`/applications/${a.id}`)}>详情</button>
                </td>
              </tr>
            {:else}
              <tr><td colspan="2"><div class="empty-state" style="padding:40px"><div class="icon">📭</div>暂无记录</div></td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>

{:else if loading}
  <div class="card">
    <div class="card-body">
      <div class="empty-state"><div class="icon">⏳</div>加载中...</div>
    </div>
  </div>
{:else}
  <div class="card">
    <div class="card-body">
      <div class="empty-state"><div class="icon">🗂️</div>请选择用户身份以开始处理融资申请单</div>
    </div>
  </div>
{/if}

{#if toast}
  <div class="toast {toast.type}">
    <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
    <span>{toast.msg}</span>
  </div>
{/if}

{#if showCreateModal}
  <div class="modal-overlay" on:click={(e) => { if (e.target === e.currentTarget) showCreateModal = false; }}>
    <div class="modal" style="max-width: 640px;">
      <div class="modal-header">
        <h3>📝 新建融资申请单（登记员登记）</h3>
        <button class="close-btn" on:click={() => showCreateModal = false}>×</button>
      </div>
      <div class="modal-body">
        <div class="alert alert-info">
          <span>📘</span>
          <div>请完整填写申请人/企业信息与必填证据。创建后将进入 <b>草稿</b> 状态，确认信息后可提交进入核验流程。</div>
        </div>
        <div class="form-row">
          <div class="form-item">
            <label>申请人姓名 *</label>
            <input bind:value={newForm.applicant_name} placeholder="例如：张三">
          </div>
          <div class="form-item">
            <label>申请人身份证号 *</label>
            <input bind:value={newForm.applicant_id_card} placeholder="18位身份证号">
          </div>
        </div>
        <div class="form-row">
          <div class="form-item">
            <label>企业名称 *</label>
            <input bind:value={newForm.company_name} placeholder="例如：北京XX供应链有限公司">
          </div>
          <div class="form-item">
            <label>企业统一社会信用代码 *</label>
            <input bind:value={newForm.company_credit_code} placeholder="18位统一社会信用代码">
          </div>
        </div>
        <div class="form-row">
          <div class="form-item">
            <label>融资金额（元）*</label>
            <input type="number" bind:value={newForm.financing_amount} min={0}>
          </div>
          <div class="form-item">
            <label>融资期限（月）*</label>
            <input type="number" bind:value={newForm.financing_term_months} min={1}>
          </div>
        </div>
        <div class="form-item">
          <label>初始风险等级（登记时预判，后续审核主管可调整，变更会留痕）</label>
          <select bind:value={newForm.risk_level}>
            <option value="LOW">低风险</option>
            <option value="MEDIUM">中风险</option>
            <option value="HIGH">高风险</option>
            <option value="CRITICAL">极高风险</option>
          </select>
        </div>
        <div class="form-item">
          <label>必填证据（勾选）</label>
          <div class="evidence-list">
            {#each Object.entries(EVIDENCE_LABEL) as [key, label]}
              <label class="evidence-item" style="cursor:pointer;user-select:none"
                class:submitted={newForm.required_evidence.includes(key)}>
                <input type="checkbox" checked={newForm.required_evidence.includes(key)}
                  on:change={() => toggleRequired(key)} style="width:auto;margin-right:4px">
                <span>{label}</span>
              </label>
            {/each}
          </div>
        </div>
        <div class="form-item">
          <label>已提交的证据（可勾选，表示已收到）</label>
          <div class="evidence-list">
            {#if newForm.required_evidence.length === 0}
              <span style="font-size:12px;color:var(--text-muted)">请先在上方勾选必填证据</span>
            {:else}
              {#each newForm.required_evidence as key}
                <label class="evidence-item" style="cursor:pointer;user-select:none"
                  class:submitted={newForm.submitted_evidence.includes(key)}
                  class:missing={!newForm.submitted_evidence.includes(key)}>
                  <input type="checkbox" checked={newForm.submitted_evidence.includes(key)}
                    on:change={() => toggleSubmitted(key)} style="width:auto;margin-right:4px">
                  <span>{EVIDENCE_LABEL[key] || key}</span>
                </label>
              {/each}
            {/if}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px">
            💡 草稿阶段可暂未提交所有证据，但提交审核时要求必填证据全部齐全。
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="secondary" on:click={() => showCreateModal = false}>取消</button>
        <button class="primary" on:click={submitCreate}>创建申请单（草稿）</button>
      </div>
    </div>
  </div>
{/if}
