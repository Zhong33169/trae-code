<script>
  export let logs;
  import { AUDIT_ACTION_LABELS, ROLE_LABELS } from '$lib/store';

  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleString('zh-CN', { hour12: false });
  }
</script>

<div class="detail-section">
  <h3>📝 审计日志（完整操作轨迹）</h3>
  {#if logs && logs.length > 0}
    {#each logs as log}
      <div class="audit-item">
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
      </div>
    {/each}
  {:else}
    <div class="empty-state">暂无审计记录</div>
  {/if}
</div>
