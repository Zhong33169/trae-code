<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/userStore';
  import { api } from '$lib/api';
  import type { TradeReview, Statistics, User } from '$lib/types';
  import {
    STATUS_LABEL, RISK_LABEL, ROLE_LABEL, statusColor, riskColor,
    fmtMoney, fmtDate, parseEvidence, RISK_REQUIRED_EVIDENCE,
  } from '$lib/types';

  let reviews: TradeReview[] = [];
  let stats: Statistics | null = null;
  let loading = true;
  let lastUserId = '';

  let filterStatus = '';
  let filterRisk = '';
  let filterRole = '';
  let filterMineOnly = false;
  let keyword = '';

  let autoRefreshTimer: any = null;

  onMount(async () => {
    if ($userStore.currentUserId) {
      lastUserId = $userStore.currentUserId;
      await loadData();
    }
    autoRefreshTimer = setInterval(loadData, 15000);
  });

  afterUpdate(() => {
    if ($userStore.currentUserId && $userStore.currentUserId !== lastUserId && !$userStore.loading) {
      lastUserId = $userStore.currentUserId;
      loadData();
    }
  });

  async function loadData() {
    if (!$userStore.currentUserId) return;
    loading = true;
    const q: any = {};
    if (filterStatus) q.status = filterStatus;
    if (filterRisk) q.risk_level = filterRisk;
    if (filterRole) q.current_role = filterRole;
    if (filterMineOnly) q.handler_id = $userStore.currentUserId;
    if (keyword) q.keyword = keyword;
    try {
      [reviews, stats] = await Promise.all([api.getReviews(q), api.getStatistics()]);
    } catch (e: any) {
      console.error('加载数据失败:', e.message);
    }
    loading = false;
  }

  function resetFilters() {
    filterStatus = '';
    filterRisk = '';
    filterRole = '';
    filterMineOnly = false;
    keyword = '';
    loadData();
  }

  function getHandlerName(id: string | null): string {
    if (!id) return '-';
    return $userStore.users.find(u => u.id === id)?.name || '-';
  }

  function hasMissingEvidence(r: TradeReview): string[] {
    const required = RISK_REQUIRED_EVIDENCE[r.risk_level] || [];
    const ev = parseEvidence(r.evidence_json);
    return required.filter(req => !ev.some(e => e && e.includes(req)));
  }

  $: currentUser = $userStore.users.find(u => u.id === $userStore.currentUserId);

  function destroy() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  }
</script>

<svelte:window on:destroy={destroy} />

{#if stats && currentUser}
  <div class="stats">
    <div class="stat-card">
      <div class="label">核查单总数</div>
      <div class="value">{stats.total}</div>
    </div>
    <div class="stat-card pending">
      <div class="label">待处理</div>
      <div class="value">{stats.pending}</div>
    </div>
    <div class="stat-card completed">
      <div class="label">已办结</div>
      <div class="value">{stats.completed}</div>
    </div>
    <div class="stat-card overdue">
      <div class="label">逾期</div>
      <div class="value">{stats.overdue}</div>
    </div>
    <div class="stat-card">
      <div class="label">高风险</div>
      <div class="value" style="color:#ef4444">{stats.byRisk.HIGH || 0}</div>
    </div>
    <div class="stat-card">
      <div class="label">中风险</div>
      <div class="value" style="color:#f59e0b">{stats.byRisk.MEDIUM || 0}</div>
    </div>
  </div>
{/if}

<div class="filters">
  <div class="filter-item">
    <label for="fs">状态</label>
    <select id="fs" bind:value={filterStatus} on:change={loadData}>
      <option value="">全部</option>
      <option value="REGISTERED">已登记</option>
      <option value="PENDING_CORRECTION">待补正</option>
      <option value="REVIEWING">复核中</option>
      <option value="COMPLETED">办结</option>
    </select>
  </div>
  <div class="filter-item">
    <label for="fr">风险</label>
    <select id="fr" bind:value={filterRisk} on:change={loadData}>
      <option value="">全部</option>
      <option value="HIGH">高风险</option>
      <option value="MEDIUM">中风险</option>
      <option value="LOW">低风险</option>
    </select>
  </div>
  <div class="filter-item">
    <label for="frole">处理角色</label>
    <select id="frole" bind:value={filterRole} on:change={loadData}>
      <option value="">全部</option>
      <option value="FINANCIAL_ADVISOR">理财顾问</option>
      <option value="COMPLIANCE_OFFICER">合规专员</option>
      <option value="BRANCH_MANAGER">营业部经理</option>
    </select>
  </div>
  <div class="filter-item">
    <label for="fkw">关键词</label>
    <input id="fkw" bind:value={keyword} placeholder="单号/客户/账号" on:keydown={(e) => e.key === 'Enter' && loadData()} />
  </div>
  <div class="filter-item" style="justify-content:flex-end">
    <label style="visibility:hidden">_</label>
    <div style="display:flex; gap:8px; align-items:center">
      <label style="display:flex; align-items:center; gap:6px; color:var(--text); margin:0">
        <input type="checkbox" bind:checked={filterMineOnly} on:change={loadData} style="width:auto" />
        只看我的
      </label>
      <button on:click={loadData} title="立即刷新">↻ 刷新</button>
      <button on:click={resetFilters}>重置</button>
      <button class="primary" on:click={() => goto('/register')}>+ 新登记</button>
    </div>
  </div>
</div>

<div class="table-wrap">
  {#if loading}
    <div style="padding:40px; text-align:center; color:var(--text-muted)">加载中...</div>
  {:else if reviews.length === 0}
    <div style="padding:40px; text-align:center; color:var(--text-muted)">暂无数据</div>
  {:else}
    <table>
      <thead>
        <tr>
          <th>单号</th>
          <th>客户</th>
          <th>账号</th>
          <th>交易类型</th>
          <th>金额</th>
          <th>风险</th>
          <th>状态</th>
          <th>当前处理人</th>
          <th>版本</th>
          <th>截止日期</th>
          <th>登记时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {#each reviews as r}
          {@const missing = hasMissingEvidence(r)}
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:6px">
                {r.code}
                {#if r.is_overdue}
                  <span class="tag overdue">逾期</span>
                {/if}
                {#if missing.length > 0 && r.status !== 'COMPLETED'}
                  <span class="tag" style="background:#fff7ed; color:#c2410c; border:1px solid #fed7aa">缺证据</span>
                {/if}
                {#if r.current_handler_id === $userStore.currentUserId && r.status !== 'COMPLETED'}
                  <span class="tag" style="background:#dbeafe; color:#1e40af; border:1px solid #93c5fd">待我处理</span>
                {/if}
              </div>
            </td>
            <td>{r.customer_name}</td>
            <td>{r.account_no}</td>
            <td>{r.trade_type}</td>
            <td>{fmtMoney(r.trade_amount)}</td>
            <td>
              <span class="tag" style="background:{riskColor(r.risk_level)}20; color:{riskColor(r.risk_level)}; border:1px solid {riskColor(r.risk_level)}50">
                {RISK_LABEL[r.risk_level]}（{r.priority}）
              </span>
            </td>
            <td>
              <span class="tag" style="background:{statusColor(r.status)}20; color:{statusColor(r.status)}; border:1px solid {statusColor(r.status)}50">
                {STATUS_LABEL[r.status]}
              </span>
            </td>
            <td>
              {r.current_role ? `${getHandlerName(r.current_handler_id)}（${ROLE_LABEL[r.current_role]}）` : '-'}
            </td>
            <td>v{r.version}</td>
            <td style="color:{r.is_overdue ? 'var(--danger)' : 'inherit'}">{fmtDate(r.deadline)}</td>
            <td>{fmtDate(r.created_at)}</td>
            <td>
              <button class="primary" on:click={() => goto(`/review/${r.id}`)}>查看</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<div style="margin-top:12px; text-align:right; color:var(--text-muted); font-size:12px">
  每 15 秒自动刷新 · 上次刷新：{new Date().toLocaleTimeString('zh-CN')}
</div>
