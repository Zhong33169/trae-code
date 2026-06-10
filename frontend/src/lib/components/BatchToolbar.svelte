<script>
  import { createEventDispatcher } from 'svelte';
  import { currentUser, refreshAll } from '$lib/stores.js';
  import { api } from '$lib/api.js';
  import { ROLES, RESERVATION_STATUS } from '$lib/constants.js';

  const dispatch = createEventDispatcher();

  export let selectedIds;
  export let reservations;

  let operating = false;
  let errorMsg = '';
  let showCommentDialog = false;
  let currentOperation = '';
  let comment = '';

  $: canBatchLabReview = $currentUser?.role === ROLES.LAB_ADMIN && selectedIds.size > 0;
  $: canBatchCollegeConfirm = $currentUser?.role === ROLES.COLLEGE_HEAD && selectedIds.size > 0;

  $: selectedItems = reservations.filter((r) => selectedIds.has(r.id));

  function openBatchDialog(operation) {
    currentOperation = operation;
    comment = '';
    errorMsg = '';
    showCommentDialog = true;
  }

  async function executeBatch() {
    if (selectedItems.length === 0) return;

    operating = true;
    errorMsg = '';

    try {
      const ids = selectedItems.map((r) => r.id);
      const versions = selectedItems.map((r) => r.version);

      const result = await api.batchOperation(ids, versions, currentOperation, comment);

      if (result.fail_count > 0) {
        const failReasons = result.results
          .filter((r) => !r.success)
          .map((r) => {
            let msg = `${r.reservation_no || '#' + r.id}: ${r.error}`;
            if (r.errors && r.errors.length > 0) {
              msg += '\n  - ' + r.errors.join('\n  - ');
            }
            return msg;
          })
          .join('\n');
        errorMsg = `成功 ${result.success_count} 条，失败 ${result.fail_count} 条\n\n失败详情：\n${failReasons}`;
      }
      
      refreshAll();
      dispatch('complete', { result });
      
      if (result.fail_count === 0) {
        showCommentDialog = false;
      }
    } catch (e) {
      errorMsg = e.message;
    } finally {
      operating = false;
    }
  }

  function cancelDialog() {
    showCommentDialog = false;
    errorMsg = '';
  }

  function getOperationLabel(op) {
    const labels = {
      lab_review_pass: '批量通过',
      lab_reject: '批量退回',
      college_confirm_pass: '批量确认',
      college_reject: '批量退回',
    };
    return labels[op] || op;
  }
</script>

<div class="batch-toolbar">
  {#if selectedIds.size > 0}
    <span class="selected-count">已选 {selectedIds.size} 项</span>

    {#if canBatchLabReview}
      <button
        class="btn btn-primary"
        on:click={() => openBatchDialog('lab_review_pass')}
      >
        批量通过审核
      </button>
      <button
        class="btn btn-warning"
        on:click={() => openBatchDialog('lab_reject')}
      >
        批量退回
      </button>
    {/if}

    {#if canBatchCollegeConfirm}
      <button
        class="btn btn-success"
        on:click={() => openBatchDialog('college_confirm_pass')}
      >
        批量确认
      </button>
      <button
        class="btn btn-danger"
        on:click={() => openBatchDialog('college_reject')}
      >
        批量退回
      </button>
    {/if}
  {/if}
</div>

{#if showCommentDialog}
  <div class="dialog-overlay" on:click={cancelDialog}>
    <div class="dialog" on:click|stopPropagation>
      <h3>{getOperationLabel(currentOperation)}</h3>

      <div class="dialog-body">
        <p>将对 {selectedItems.length} 条预约单执行此操作</p>

        <div class="form-group">
          <label>操作说明（可选）</label>
          <textarea
            bind:value={comment}
            rows="3"
            placeholder="请输入操作说明或退回原因..."
          ></textarea>
        </div>

        {#if errorMsg}
          <div class="error-box">
            <pre>{errorMsg}</pre>
          </div>
        {/if}
      </div>

      <div class="dialog-footer">
        <button class="btn btn-default" on:click={cancelDialog} disabled={operating}>
          取消
        </button>
        <button
          class="btn btn-primary"
          on:click={executeBatch}
          disabled={operating}
        >
          {operating ? '处理中...' : '确认执行'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .batch-toolbar {
    display: flex;
    gap: 10px;
    padding: 10px 16px;
    background: #f0f6ff;
    border-bottom: 1px solid #e0e8f0;
    align-items: center;
  }

  .selected-count {
    font-size: 13px;
    color: #2d5a87;
    font-weight: 500;
    margin-right: auto;
  }

  .btn {
    padding: 6px 14px;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-primary {
    background: #2d5a87;
    color: white;
  }

  .btn-primary:hover {
    background: #1e3a5f;
  }

  .btn-success {
    background: #27ae60;
    color: white;
  }

  .btn-success:hover {
    background: #1e8449;
  }

  .btn-warning {
    background: #f39c12;
    color: white;
  }

  .btn-warning:hover {
    background: #d68910;
  }

  .btn-danger {
    background: #e74c3c;
    color: white;
  }

  .btn-danger:hover {
    background: #c0392b;
  }

  .btn-default {
    background: #ecf0f1;
    color: #333;
  }

  .btn-default:hover {
    background: #bdc3c7;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog {
    background: white;
    border-radius: 8px;
    width: 400px;
    max-width: 90vw;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }

  .dialog h3 {
    margin: 0;
    padding: 16px 20px;
    border-bottom: 1px solid #eee;
    font-size: 16px;
    color: #1e3a5f;
  }

  .dialog-body {
    padding: 20px;
  }

  .dialog-body p {
    margin: 0 0 12px;
    font-size: 14px;
    color: #666;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 13px;
    color: #666;
  }

  .form-group textarea {
    padding: 8px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
    resize: vertical;
  }

  .error-box {
    margin-top: 12px;
    padding: 10px;
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    color: #c33;
  }

  .error-box pre {
    margin: 0;
    white-space: pre-wrap;
    font-size: 12px;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 12px 20px;
    border-top: 1px solid #eee;
  }
</style>
