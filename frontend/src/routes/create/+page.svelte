<script>
  import { onMount } from 'svelte';
  import { createOrder, fetchUsers, ROLE_MAP } from '$lib/api';
  import { goto } from '$app/navigation';

  let users = [];
  let keepers = [];
  let loading = false;
  let errorMsg = '';
  let successMsg = '';

  let form = {
    product_name: '',
    supplier: '',
    temperature_range: '',
    storage_location: '',
    risk_level: 'low',
    notes: '',
    created_by: ''
  };

  onMount(async () => {
    try {
      users = await fetchUsers();
      keepers = users.filter(u => u.role === 'warehouse_keeper');
      if (keepers.length > 0) {
        form.created_by = keepers[0].id;
      }
    } catch (e) {
      console.error(e);
    }
  });

  async function handleSubmit() {
    if (!form.product_name || !form.supplier || !form.temperature_range || !form.storage_location || !form.created_by) {
      errorMsg = '请填写所有必填项';
      return;
    }
    errorMsg = '';
    successMsg = '';
    loading = true;
    try {
      const res = await createOrder(form);
      if (res.error) {
        errorMsg = res.error;
      } else {
        successMsg = '入库单创建成功！';
        setTimeout(() => goto('/orders'), 1000);
      }
    } catch (e) {
      errorMsg = '创建失败，请重试';
    } finally {
      loading = false;
    }
  }
</script>

<div class="create-page">
  <div class="page-header">
    <a href="/orders" class="back-link">← 返回队列</a>
    <h1 class="page-title">新建冷链入库单</h1>
  </div>

  <div class="form-card">
    <form on:submit|preventDefault={handleSubmit}>
      <div class="form-section">
        <h3 class="section-title">基本信息</h3>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">产品名称 <span class="required">*</span></label>
            <input type="text" class="form-input" bind:value={form.product_name} placeholder="例：冻虾仁" />
          </div>
          <div class="form-group">
            <label class="form-label">供应商 <span class="required">*</span></label>
            <input type="text" class="form-input" bind:value={form.supplier} placeholder="例：远洋水产有限公司" />
          </div>
          <div class="form-group">
            <label class="form-label">温区范围 <span class="required">*</span></label>
            <input type="text" class="form-input" bind:value={form.temperature_range} placeholder="例：-18℃~-22℃" />
          </div>
          <div class="form-group">
            <label class="form-label">存储位置 <span class="required">*</span></label>
            <input type="text" class="form-input" bind:value={form.storage_location} placeholder="例：A区-01号库" />
          </div>
        </div>
      </div>

      <div class="form-section">
        <h3 class="section-title">风险与处理人</h3>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">风险等级 <span class="required">*</span></label>
            <div class="risk-options">
              <label class="risk-option risk-high" class:selected={form.risk_level === 'high'}>
                <input type="radio" bind:group={form.risk_level} value="high" />
                <span class="risk-radio"></span>
                <span class="risk-name">高风险</span>
                <span class="risk-desc">队列最前，需全部证据</span>
              </label>
              <label class="risk-option risk-medium" class:selected={form.risk_level === 'medium'}>
                <input type="radio" bind:group={form.risk_level} value="medium" />
                <span class="risk-radio"></span>
                <span class="risk-name">中风险</span>
                <span class="risk-desc">队列居中，需温度证据</span>
              </label>
              <label class="risk-option risk-low" class:selected={form.risk_level === 'low'}>
                <input type="radio" bind:group={form.risk_level} value="low" />
                <span class="risk-radio"></span>
                <span class="risk-name">低风险</span>
                <span class="risk-desc">队列靠后，标准流程</span>
              </label>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">建单人（仓管员）<span class="required">*</span></label>
            <select class="form-select" bind:value={form.created_by}>
              <option value="">请选择仓管员</option>
              {#each keepers as k}
                <option value={k.id}>{k.display_name}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>

      <div class="form-section">
        <h3 class="section-title">备注</h3>
        <textarea class="form-textarea" bind:value={form.notes} placeholder="可选填写备注信息..." rows="3"></textarea>
      </div>

      {#if errorMsg}
        <div class="error-msg">⚠️ {errorMsg}</div>
      {/if}

      {#if successMsg}
        <div class="success-msg">✅ {successMsg}</div>
      {/if}

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" disabled={loading}>
          {loading ? '提交中...' : '提交入库单'}
        </button>
        <button type="button" class="btn btn-secondary" on:click={() => goto('/orders')}>取消</button>
      </div>
    </form>
  </div>
</div>

<style>
  .create-page {
    max-width: 800px;
  }

  .page-header {
    margin-bottom: 20px;
  }

  .back-link {
    font-size: 13px;
    color: #3b82f6;
    display: inline-block;
    margin-bottom: 8px;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .page-title {
    font-size: 22px;
    font-weight: 700;
    color: #1e3a5f;
  }

  .form-card {
    background: white;
    border-radius: 10px;
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  .form-section {
    margin-bottom: 24px;
  }

  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: #334155;
    margin-bottom: 14px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e2e8f0;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-label {
    font-size: 13px;
    color: #475569;
    font-weight: 600;
  }

  .required {
    color: #dc2626;
  }

  .form-input, .form-select {
    padding: 8px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 14px;
    transition: border 0.2s;
  }

  .form-input:focus, .form-select:focus, .form-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
  }

  .form-textarea {
    padding: 8px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 14px;
    resize: vertical;
    font-family: inherit;
    width: 100%;
  }

  .risk-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .risk-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .risk-option input {
    display: none;
  }

  .risk-option:hover {
    border-color: #93c5fd;
  }

  .risk-high.selected { border-color: #dc2626; background: #fef2f2; }
  .risk-medium.selected { border-color: #f59e0b; background: #fffbeb; }
  .risk-low.selected { border-color: #10b981; background: #ecfdf5; }

  .risk-radio {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid #cbd5e1;
  }

  .risk-high.selected .risk-radio { border-color: #dc2626; background: #dc2626; }
  .risk-medium.selected .risk-radio { border-color: #f59e0b; background: #f59e0b; }
  .risk-low.selected .risk-radio { border-color: #10b981; background: #10b981; }

  .risk-name {
    font-weight: 600;
    font-size: 14px;
    min-width: 50px;
  }

  .risk-desc {
    font-size: 12px;
    color: #64748b;
  }

  .error-msg {
    padding: 10px 14px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #dc2626;
    font-size: 13px;
    margin-bottom: 14px;
  }

  .success-msg {
    padding: 10px 14px;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    border-radius: 6px;
    color: #059669;
    font-size: 13px;
    margin-bottom: 14px;
  }

  .form-actions {
    display: flex;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
  }

  .btn {
    display: inline-block;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
    font-weight: 500;
  }

  .btn-primary {
    background: #2563eb;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .btn-primary:disabled {
    background: #93c5fd;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: #f1f5f9;
    color: #475569;
  }

  .btn-secondary:hover {
    background: #e2e8f0;
  }

  @media (max-width: 768px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
