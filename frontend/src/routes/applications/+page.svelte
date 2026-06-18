<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser } from '$lib/stores';
  import { apiGet } from '$lib/api';
  import {
    STATUS_LABEL, STATUS_COLOR, RISK_LABEL, RISK_COLOR,
    ROLE_LABEL, EVIDENCE_LABEL, RESULT_LABEL
  } from '$lib/types';
  import type { FinancingApplication, Statistics } from '$lib/types';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let loading = true;
  let all: FinancingApplication[] = [];
  let stats: Statistics | null = null;
  let toast: { msg: string; type: string } | null = null;

  let fStatus = '';
  let fRisk = '';
  let fRole = '';
  let fHandler = '';
  let fKeyword = '';

  let searchParams = new URLSearchParams();

  onMount(async () => {
    fStatus = $page.url.searchParams.get('status') || '';
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      const params = new URLSearchParams();
      if (fStatus) params.set('status', fStatus);
      if (fRisk) params.set('risk', fRisk);
      if (fRole) params.set('role', fRole);
      if (fHandler) params.set('handler', fHandler);
      if (fKeyword) params.set('keyword', fKeyword);
      const qs = params.toString();
      const [apps, st] = await Promise.all([
        apiGet<any>(`/api/applications${qs ? `?${qs}` : ''}`),
        apiGet<any>('/api/statistics'),
      ]);
      all = apps;
      stats = st;
    } catch (e: any) {
      showToast(e.message || '加载失败', 'error');
    } finally {
      loading = false;
    }
  }

  function showToast(msg: string, type = 'info') {
    toast = { msg, type };
    setTimeout(() => toast = null, 3000);
  }

  function reset() {
    fStatus = ''; fRisk = ''; fRole = ''; fHandler = ''; fKeyword = '';
    loadData();
  }

  function isHighRisk(risk: string) {
    return risk === 'HIGH' || risk === 'CRITICAL';
  }

  function evidenceStr(a: FinancingApplication) {
    const req = a.required_evidence?.length || 0;
    const sub = a.submitted_evidence?.length || 0;
    return `${sub}/${req}`;
  }

  const STATUS_KEYS = ['DRAFT','PENDING_VERIFICATION','VERIFICATION_PASSED','EVIDENCE_MISSING',
    'OVERDUE','RETURNED_FOR_CORRECTION','STATUS_CONFLICT','REVIEW_PENDING','ARCHIVED','REJECTED'];
  const RISK_KEYS = ['LOW','MEDIUM','HIGH','CRITICAL'];
</script>

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-label">申请单总数</div>
    <div class="stat-value">{stats?.total || 0}</div>
    <div class="stat-sub">总金额 ¥{(stats?.total_amount || 0).toLocaleString()}</div>
  </div>
  <div class="stat-card danger">
    <div class="stat-label">高风险 / 极高风险</div>
    <div class="stat-value danger">{stats?.high_risk_count || 0}</div>
    <div class="stat-sub">
      CRITICAL {stats?.count_by_risk?.CRITICAL || 0} · HIGH {stats?.count_by_risk?.HIGH || 0}
    </div>
  </div>
  <div class="stat-card success">
    <div class="stat-label">已归档通过率</div>
    <div class="stat-value">
      {stats?.total ? ((stats.count_by_status?.ARCHIVED||0) / stats.total * 100).toFixed(1) : 0}%
    </div>
    <div class="stat-sub">
      {stats?.count_by_status?.ARCHIVED || 0} 笔 / ¥{(stats?.archived_amount||0).toLocaleString()}
    </div>
  </div>
  <div class="stat-card warning">
    <div class="stat-label">退回补正 / 缺证据</div>
    <div class="stat-value">
      {(stats?.count_by_status?.RETURNED_FOR_CORRECTION||0) + (stats?.count_by_status?.EVIDENCE_MISSING||0)}
    </div>
    <div class="stat-sub">
      退回 {(stats?.count_by_status?.RETURNED_FOR_CORRECTION||0)} · 缺证据 {(stats?.count_by_status?.EVIDENCE_MISSING||0)}
    </div>
  </div>
  <div class="stat-card info">
    <div class="stat-label">逾期 / 状态冲突</div>
    <div class="stat-value">
      {(stats?.count_by_status?.OVERDUE||0) + (stats?.count_by_status?.STATUS_CONFLICT||0)}
    </div>
    <div class="stat-sub">
      逾期 {(stats?.count_by_status?.OVERDUE||0)} · 冲突 {(stats?.count_by_status?.STATUS_CONFLICT||0)}
    </div>
  </div>
</div>

<div class="filters">
  <div class="form-item" style="margin:0">
    <label>按状态</label>
    <select bind:value={fStatus} on:change={loadData}>
      <option value="">全部状态</option>
      {#each STATUS_KEYS as k}
        <option value={k}>{STATUS_LABEL[k]} ({stats?.count_by_status?.[k] || 0})</option>
      {/each}
    </select>
  </div>
  <div class="form-item" style="margin:0">
    <label>按风险等级</label>
    <select bind:value={fRisk} on:change={loadData}>
      <option value="">全部风险</option>
      {#each RISK_KEYS as k}
        <option value={k}>{RISK_LABEL[k]} ({stats?.count_by_risk?.[k] || 0})</option>
      {/each}
    </select>
  </div>
  <div class="form-item" style="margin:0">
    <label>按角色视图</label>
    <select bind:value={fRole} on:change={loadData}>
      <option value="">全部</option>
      <option value="REGISTRAR">{ROLE_LABEL.REGISTRAR}</option>
      <option value="AUDITOR">{ROLE_LABEL.AUDITOR}</option>
      <option value="REVIEWER">{ROLE_LABEL.REVIEWER}</option>
    </select>
  </div>
  <div class="form-item" style="margin:0">
    <label>关键词（编号/姓名/企业）</label>
    <input bind:value={fKeyword} placeholder="如 RZZ、陈缺证、供应链...">
  </div>
  <div class="filter-actions">
    <button class="secondary sm" on:click={reset}>重置</button>
    <button class="primary sm" on:click={loadData}>🔍 搜索</button>
  </div>
</div>

<div class="queue-badges">
  <span class="tag" style="background:#f1f5f9;color:#334155">快捷：</span>
  {#each STATUS_KEYS as k}
    <button class="queue-badge {fStatus === k ? 'active' : ''}" on:click={() => { fStatus = k; loadData(); }}>
      {STATUS_LABEL[k]}
      <span class="count">{stats?.count_by_status?.[k] || 0}</span>
    </button>
  {/each}
</div>

<div class="card">
  <div class="card-header">
    <h2>申请单列表（共 {all.length} 条）</h2>
    <div style="font-size:12px;color:var(--text-muted)">
      {#if $currentUser}当前登录：{$currentUser.display_name}（{ROLE_LABEL[$currentUser.role]}）{/if}
    </div>
  </div>
  <div style="overflow-x: auto;">
    {#if loading}
      <div class="card-body"><div class="empty-state"><div class="icon">⏳</div>加载中...</div></div>
    {:else if all.length === 0}
      <div class="card-body"><div class="empty-state"><div class="icon">📭</div>没有符合条件的申请单</div></div>
    {:else}
      <table>
        <thead>
          <tr>
            <th>申请编号</th>
            <th>申请人 / 企业</th>
            <th>金额 / 期限</th>
            <th>风险等级</th>
            <th>状态</th>
            <th>材料</th>
            <th>处理人</th>
            <th>创建 / 更新</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {#each all as a (a.id)}
            <tr class={a.risk_level === 'CRITICAL' ? 'critical-risk' : (a.risk_level === 'HIGH' ? 'high-risk' : '')}>
              <td>
                <div style="font-family: ui-monospace; font-weight: 600; color: var(--primary);">{a.application_no}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">v{a.version}</div>
              </td>
              <td>
                <div style="font-weight:500">{a.applicant_name}</div>
                <div style="font-size:12px;color:var(--text-muted);">{a.company_name}</div>
              </td>
              <td>
                <div class="money" style="font-weight:700;color:var(--primary)">¥{a.financing_amount.toLocaleString()}</div>
                <div style="font-size:12px;color:var(--text-muted);">{a.financing_term_months} 个月</div>
              </td>
              <td>
                {#if isHighRisk(a.risk_level)}
                  <span class="badge-highlight {a.risk_level === 'CRITICAL' ? 'critical' : 'high'}">
                    {a.risk_level === 'CRITICAL' ? '🔴🔴 ' : '🔴 '}
                    {RISK_LABEL[a.risk_level]}
                  </span>
                {:else}
                  <span class="tag tag-risk" style="background:{RISK_COLOR[a.risk_level]}">{RISK_LABEL[a.risk_level]}</span>
                {/if}
              </td>
              <td>
                <span class="tag tag-status" style="background:{STATUS_COLOR[a.status]}">{STATUS_LABEL[a.status]}</span>
              </td>
              <td>
                <div style="font-weight:600">{evidenceStr(a)}</div>
                {#if (a.required_evidence?.length || 0) - (a.submitted_evidence?.length || 0) > 0}
                  <div style="font-size:11px;color:var(--danger)">缺 {(a.required_evidence?.length||0)-(a.submitted_evidence?.length||0)}</div>
                {/if}
              </td>
              <td>
                <div>{a.current_handler_name}</div>
                <div style="font-size:11px;color:var(--text-muted);">{ROLE_LABEL[a.current_handler_role || '']}</div>
                {#if $currentUser && a.current_handler === $currentUser.id}
                  <div style="font-size:10px;color:var(--success);font-weight:600;margin-top:2px">→ 待我处理</div>
                {/if}
              </td>
              <td style="font-size:11px;">
                <div>{new Date(a.created_at).toLocaleDateString('zh-CN')}</div>
                <div style="color:var(--text-muted);">{new Date(a.updated_at).toLocaleDateString('zh-CN')}</div>
              </td>
              <td>
                <button class="primary sm" on:click={() => goto(`/applications/${a.id}`)}>打开</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

{#if toast}
  <div class="toast {toast.type}">
    <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
    <span>{toast.msg}</span>
  </div>
{/if}
