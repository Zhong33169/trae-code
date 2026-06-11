<script>
  import { STATUS_LABELS } from '$lib/store';

  export let currentStatus;
  export let isReturned = false;

  const steps = [
    { key: 'draft', label: '创建登记', role: '登记员' },
    { key: 'pending_review', label: '审核办理', role: '审核主管' },
    { key: 'pending_final', label: '复核归档', role: '复核负责人' },
    { key: 'archived', label: '完成归档', role: '系统' }
  ];

  function getStepClass(step, index) {
    if (currentStatus === 'archived' && step.key === 'archived') return 'done';
    
    const statusOrder = ['draft', 'pending_review', 'supplement_required', 'pending_final', 'returned', 'overdue', 'archived'];
    const currentIdx = statusOrder.indexOf(currentStatus === 'supplement_required' ? 'pending_review' : currentStatus);
    const stepIdx = statusOrder.indexOf(step.key === 'archived' ? 'archived' : step.key);
    
    if (step.key === 'archived') {
      return currentStatus === 'archived' ? 'done' : '';
    }
    
    if (stepIdx < currentIdx) return 'done';
    if (step.key === (currentStatus === 'supplement_required' ? 'pending_review' : currentStatus)) return 'active';
    return '';
  }
</script>

<div class="progress-flow">
  {#each steps as step, i}
    <div class="flow-step {getStepClass(step, i)} {currentStatus === 'returned' && (step.key === 'pending_review' || step.key === 'pending_final') ? 'rejected' : ''}">
      <div class="flow-step-circle">
        {#if getStepClass(step, i) === 'done'}
          ✓
        {:else if currentStatus === 'returned' && (step.key === 'pending_review' || step.key === 'pending_final')}
          ✕
        {:else}
          {i + 1}
        {/if}
      </div>
      <div class="flow-step-label">{step.label}</div>
      <div class="flow-step-role">{step.role}</div>
    </div>
  {/each}
</div>

{#if currentStatus === 'supplement_required'}
  <div class="alert alert-warning">
    ⚠️ 当前状态：需补正附件 — 单据已被审核主管退回，请补齐缺失材料或替换被驳回附件后重新提交。
  </div>
{/if}
{#if currentStatus === 'returned'}
  <div class="alert alert-danger">
    ❌ 当前状态：已退回 — 单据在复核阶段被退回，请查看下方退回原因后联系相关人员。
  </div>
{/if}
{#if currentStatus === 'overdue'}
  <div class="alert alert-danger">
    ⏰ 当前状态：已超时 — 处理超过时限，请尽快跟进。
  </div>
{/if}
