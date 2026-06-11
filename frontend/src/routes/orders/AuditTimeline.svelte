<script>
  export let logs;
  import { AUDIT_ACTION_LABELS, ROLE_LABELS } from '$lib/store';

  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleString('zh-CN', { hour12: false });
  }

  function getItemClass(log) {
    if (log.action === 'operation_failed') return 'audit-item audit-item-danger';
    if (log.action === 'rejected_supervisor' || log.action === 'rejected_final') return 'audit-item audit-item-warning';
    return 'audit-item';
  }
</script>

<div class="detail-section">
  <h3>📝 审计日志（完整操作轨迹）</h3>
  {#if logs && logs.length > 0}
    {#each logs as log}
      <div class={getItemClass(log)}>
        <div class="header">
          <span class="action">{AUDIT_ACTION_LABELS[log.action] || log.action}</span>
          <span class="time">{formatDate(log.created_at)}</span>
        </div>
        <div class="operator">
          操作人：{log.operator}（{ROLE_LABELS[log.operator_role] || log.operator_role}）
        </div>
        {#if log.reason}
          <div class="reason"><strong>原因说明：</strong>{log.reason}</div>
        {/if}
        {#if log.detail}
          <div class="detail"><strong>详细信息：</strong>{log.detail}</div>
        {/if}
      </div>
    {/each}
  {:else}
    <div class="empty-state">暂无审计记录</div>
  {/if}
</div>

<style>
  :global(.audit-item-danger) {
    border-left-color: #dc2626 !important;
    background: #fef2f2 !important;
  }
  :global(.audit-item-warning) {
    border-left-color: #ea580c !important;
    background: #fff7ed !important;
  }
  :global(.audit-item .detail) {
    margin-top: 6px;
    font-size: 13px;
    color: #4b5563;
  }
</style>
