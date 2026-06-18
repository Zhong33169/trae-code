<script lang="ts">
  import { onMount } from 'svelte';
  import { apiGet } from '$lib/api';
  import { STATUS_LABEL, STATUS_COLOR, RISK_LABEL, RISK_COLOR, ROLE_LABEL } from '$lib/types';
  import type { Statistics } from '$lib/types';
  import { goto } from '$app/navigation';

  let stats: Statistics | null = null;
  let loading = true;

  onMount(async () => {
    try {
      stats = await apiGet<any>('/api/statistics');
    } finally {
      loading = false;
    }
  });

  $: statusEntries = stats
    ? Object.entries(stats.count_by_status || {}).sort((a,b) => (b[1] as number) - (a[1] as number))
    : [];
  $: riskEntries = stats
    ? Object.entries(stats.count_by_risk || {}).sort((a,b) => (b[1] as number) - (a[1] as number))
    : [];
  $: total_status_count = statusEntries.reduce((s, [, v]) => s + (v as number), 0) || 1;
  $: total_risk_count = riskEntries.reduce((s, [, v]) => s + (v as number), 0) || 1;
</script>

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-label">申请单总数</div>
    <div class="stat-value">{stats?.total || 0}</div>
    <div class="stat-sub">总融资额 ¥{(stats?.total_amount || 0).toLocaleString()}</div>
  </div>
  <div class="stat-card success">
    <div class="stat-label">已归档金额</div>
    <div class="stat-value">¥{(stats?.archived_amount || 0).toLocaleString()}</div>
    <div class="stat-sub">通过复核算 {stats?.count_by_status?.ARCHIVED || 0} 笔</div>
  </div>
  <div class="stat-card danger">
    <div class="stat-label">高风险 / 极高风险</div>
    <div class="stat-value danger">{stats?.high_risk_count || 0}</div>
    <div class="stat-sub">
      占比 {stats?.total ? (stats.high_risk_count / stats.total * 100).toFixed(1) : 0}%
    </div>
  </div>
  <div class="stat-card info">
    <div class="stat-label">平均金额/笔</div>
    <div class="stat-value">¥{stats?.total ? (stats.total_amount / stats.total).toLocaleString(undefined,{maximumFractionDigits:0}) : 0}</div>
    <div class="stat-sub">共 {stats?.total || 0} 笔</div>
  </div>
</div>

<div class="grid-3">
  <div class="card">
    <div class="card-header">
      <h2>📊 按状态分布</h2>
    </div>
    <div class="card-body">
      {#each statusEntries as [status, count]}
        {@const pct = Math.round((count as number) / total_status_count * 100)}
        <div style="margin-bottom: 14px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:13px;">
            <span style="display:flex;align-items:center;gap:6px;">
              <span class="tag tag-status" style="background:{STATUS_COLOR[status] || '#6b7280'}">{STATUS_LABEL[status] || status}</span>
            </span>
            <b>{count} ({pct}%)</b>
          </div>
          <div style="background: #f1f5f9; border-radius: 4px; height: 8px; overflow: hidden;">
            <div style="height: 100%; width: {pct}%; background: {STATUS_COLOR[status] || '#6b7280'}; transition: width .3s;"></div>
          </div>
        </div>
      {:else}
        <div class="empty-state" style="padding:20px"><div class="icon">📊</div>暂无数据</div>
      {/each}
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h2>⚠️ 按风险等级分布</h2>
    </div>
    <div class="card-body">
      {#each riskEntries as [risk, count]}
        {@const pct = Math.round((count as number) / total_risk_count * 100)}
        <div style="margin-bottom: 14px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:13px;">
            <span style="display:flex;align-items:center;gap:6px;">
              {#if risk === 'HIGH' || risk === 'CRITICAL'}
                <span class="badge-highlight {risk === 'CRITICAL' ? 'critical' : 'high'}" style="font-size:11px;padding:1px 8px">
                  {RISK_LABEL[risk]}
                </span>
              {:else}
                <span class="tag tag-risk" style="background:{RISK_COLOR[risk]}">{RISK_LABEL[risk]}</span>
              {/if}
            </span>
            <b>{count} ({pct}%)</b>
          </div>
          <div style="background: #f1f5f9; border-radius: 4px; height: 8px; overflow: hidden;">
            <div style="height: 100%; width: {pct}%; background: {RISK_COLOR[risk]}; transition: width .3s;"></div>
          </div>
        </div>
      {:else}
        <div class="empty-state" style="padding:20px"><div class="icon">📊</div>暂无数据</div>
      {/each}
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h2>👥 各角色处理队列</h2>
    </div>
    <div class="card-body" style="padding: 8px 20px;">
      <table>
        <thead>
          <tr>
            <th>处理人</th>
            <th>角色</th>
            <th style="text-align:right">待办数</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each stats?.handler_queue || [] as h (h.user_id)}
            <tr>
              <td style="font-weight: 600;">{h.display_name}</td>
              <td><span class="tag" style="background:#eff6ff;color:var(--primary);">{ROLE_LABEL[h.role]}</span></td>
              <td style="text-align:right; font-size: 20px; font-weight: 700;">{h.queue_count}</td>
              <td style="width: 80px;">
                <button class="ghost sm" on:click={() => goto(`/applications?role=${h.role}`)}>查看</button>
              </td>
            </tr>
          {:else}
            <tr><td colspan="4"><div class="empty-state" style="padding:20px"><div class="icon">📊</div>暂无数据</div></td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

<div class="card" style="margin-top: 24px;">
  <div class="card-header">
    <h2>🔁 三大处理阶段说明</h2>
  </div>
  <div class="card-body">
    <div class="grid-3">
      <div style="padding: 14px; border: 1px solid var(--border); border-radius: 8px; border-top: 4px solid var(--primary);">
        <h3 style="font-size:15px; margin-bottom: 8px;">阶段一 · 融资申请单登记</h3>
        <div style="color: var(--text-muted); font-size: 13px; margin-bottom: 10px;">
          <b>角色：</b>{ROLE_LABEL.REGISTRAR}
        </div>
        <ul style="font-size:13px;line-height:1.8;padding-left:18px;color:#334155">
          <li>创建融资申请单（草稿状态）</li>
          <li>填写申请人/企业信息、融资金额和期限</li>
          <li>勾选必填证据清单与已提交证据</li>
          <li>证据齐全后提交进入核验环节</li>
          <li>对退回补正/缺证据的申请单补正后重提</li>
        </ul>
      </div>
      <div style="padding: 14px; border: 1px solid var(--border); border-radius: 8px; border-top: 4px solid var(--warning);">
        <h3 style="font-size:15px; margin-bottom: 8px;">阶段二 · 过程核验</h3>
        <div style="color: var(--text-muted); font-size: 13px; margin-bottom: 10px;">
          <b>角色：</b>{ROLE_LABEL.AUDITOR}
        </div>
        <ul style="font-size:13px;line-height:1.8;padding-left:18px;color:#334155">
          <li>核验证据的完整性与一致性</li>
          <li>识别缺证据 / 数据异常 / 逾期 / 状态冲突</li>
          <li>根据核查结果升级或降级风险等级（留痕）</li>
          <li>正常申请单转送复核负责人</li>
          <li>异常申请单退回补正或标记专项处理</li>
        </ul>
      </div>
      <div style="padding: 14px; border: 1px solid var(--border); border-radius: 8px; border-top: 4px solid var(--success);">
        <h3 style="font-size:15px; margin-bottom: 8px;">阶段三 · 复核归档</h3>
        <div style="color: var(--text-muted); font-size: 13px; margin-bottom: 10px;">
          <b>角色：</b>{ROLE_LABEL.REVIEWER}
        </div>
        <ul style="font-size:13px;line-height:1.8;padding-left:18px;color:#334155">
          <li>对审核结论与证据进行最终复核</li>
          <li>确认风险等级认定并可再次调整</li>
          <li>通过 → 归档，纳入已融资规模统计</li>
          <li>驳回 → 留痕并记入驳回统计</li>
          <li>操作记录全部留痕，可审计追溯</li>
        </ul>
      </div>
    </div>
  </div>
</div>

{#if loading && !stats}
  <div class="card" style="margin-top:24px">
    <div class="card-body"><div class="empty-state"><div class="icon">⏳</div>加载中...</div></div>
  </div>
{/if}
