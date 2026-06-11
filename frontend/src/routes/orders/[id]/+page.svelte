<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { fetchOrder, fetchUsers, processOrder, STATUS_MAP, RISK_MAP, ROLE_MAP, RESULT_MAP, ACTION_MAP } from '$lib/api';

  let orderDetail = null;
  let users = [];
  let loading = true;
  let processing = false;
  let errorMsg = '';

  let selectedAction = '';
  let opinion = '';
  let evTemp = false;
  let evQual = false;
  let evQty = false;

  $: orderId = $page.params.id;
  $: order = orderDetail?.order;
  $: records = orderDetail?.operation_records || [];
  $: currentStatus = order?.status || '';
  $: availableActions = getAvailableActions(currentStatus);
  $: currentUser = users.find(u => u.id === order?.current_handler_id);

  function getAvailableActions(status) {
    const flow = {
      registered: [{ action: 'advance', label: '推进至核验' }, { action: 'return', label: '退回补正' }],
      verifying:  [{ action: 'advance', label: '推进至归档' }, { action: 'return', label: '退回补正' }],
      returned:   [{ action: 'correct', label: '补正提交' }],
      archived:   [],
      overdue:    [{ action: 'advance', label: '推进至核验' }],
      conflict:   [{ action: 'force_fix', label: '强制修复冲突' }]
    };
    return flow[status] || [];
  }

  onMount(async () => {
    try {
      const [detail, u] = await Promise.all([fetchOrder(orderId), fetchUsers()]);
      orderDetail = detail;
      users = u;
      if (order) {
        evTemp = order.evidence_temperature;
        evQual = order.evidence_quality;
        evQty = order.evidence_quantity;
      }
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  });

  async function handleProcess() {
    if (!selectedAction) { errorMsg = '请选择操作'; return; }
    if (!opinion.trim()) { errorMsg = '请填写处理意见'; return; }
    errorMsg = '';
    processing = true;
    try {
      const payload = {
        handler_id: order.current_handler_id,
        action: selectedAction,
        opinion: opinion.trim(),
        result: selectedAction === 'return' ? 'returned' : 'passed',
        version: order.version,
        evidence_temperature: evTemp,
        evidence_quality: evQual,
        evidence_quantity: evQty
      };
      const res = await processOrder(orderId, payload);
      if (res.error) {
        errorMsg = res.error;
      } else {
        orderDetail = res.data;
        if (orderDetail?.order) {
          evTemp = orderDetail.order.evidence_temperature;
          evQual = orderDetail.order.evidence_quality;
          evQty = orderDetail.order.evidence_quantity;
        }
        selectedAction = '';
        opinion = '';
      }
    } catch (e) {
      errorMsg = '处理失败，请重试';
    } finally {
      processing = false;
    }
  }

  function statusLabel(s) { return STATUS_MAP[s]?.label || s; }
  function statusColor(s) { return STATUS_MAP[s]?.color || '#666'; }
  function statusBg(s) { return STATUS_MAP[s]?.bg || '#f5f5f5'; }
  function riskLabel(r) { return RISK_MAP[r]?.label || r; }
  function riskColor(r) { return RISK_MAP[r]?.color || '#666'; }
  function riskBg(r) { return RISK_MAP[r]?.bg || '#f5f5f5'; }
  function roleLabel(r) { return ROLE_MAP[r]?.label || r; }
  function resultLabel(r) { return RESULT_MAP[r]?.label || r; }
  function resultColor(r) { return RESULT_MAP[r]?.color || '#666'; }
  function actionLabel(a) { return ACTION_MAP[a]?.label || a; }
  function actionIcon(a) { return ACTION_MAP[a]?.icon || ''; }
</script>

{#if loading}
  <div class="loading">加载中...</div>
{:else if !order}
  <div class="empty">入库单不存在</div>
{:else}
  <div class="detail-page">
    <div class="detail-header">
      <a href="/orders" class="back-link">← 返回队列</a>
      <h1 class="page-title">{order.order_no}</h1>
      <div class="header-badges">
        <span class="badge badge-lg" style="color: {riskColor(order.risk_level)}; background: {riskBg(order.risk_level)}">
          {riskLabel(order.risk_level)}
        </span>
        <span class="badge badge-lg" style="color: {statusColor(order.status)}; background: {statusBg(order.status)}">
          {statusLabel(order.status)}
        </span>
        <span class="version-tag">v{order.version}</span>
      </div>
    </div>

    <div class="detail-grid">
      <div class="info-card">
        <h3 class="card-title">基本信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">产品名称</span>
            <span class="info-value">{order.product_name}</span>
          </div>
          <div class="info-item">
            <span class="info-label">供应商</span>
            <span class="info-value">{order.supplier}</span>
          </div>
          <div class="info-item">
            <span class="info-label">温区范围</span>
            <span class="info-value temp-value">{order.temperature_range}</span>
          </div>
          <div class="info-item">
            <span class="info-label">存储位置</span>
            <span class="info-value">{order.storage_location}</span>
          </div>
          <div class="info-item">
            <span class="info-label">创建人</span>
            <span class="info-value">{order.created_by_name}</span>
          </div>
          <div class="info-item">
            <span class="info-label">当前处理人</span>
            <span class="info-value">{order.current_handler_name} <span class="role-tag">({roleLabel(order.current_handler_role)})</span></span>
          </div>
          <div class="info-item">
            <span class="info-label">创建时间</span>
            <span class="info-value time-value">{new Date(order.created_at).toLocaleString('zh-CN')}</span>
          </div>
          <div class="info-item">
            <span class="info-label">更新时间</span>
            <span class="info-value time-value">{new Date(order.updated_at).toLocaleString('zh-CN')}</span>
          </div>
        </div>
        {#if order.notes}
          <div class="info-item full-width" style="margin-top: 12px;">
            <span class="info-label">备注</span>
            <span class="info-value">{order.notes}</span>
          </div>
        {/if}
      </div>

      <div class="info-card">
        <h3 class="card-title">证据状态</h3>
        <div class="evidence-grid">
          <div class="evidence-item" class:evidence-ok={order.evidence_temperature} class:evidence-missing={!order.evidence_temperature}>
            <span class="evidence-icon">{order.evidence_temperature ? '✅' : '❌'}</span>
            <span class="evidence-name">温度记录</span>
            <span class="evidence-status">{order.evidence_temperature ? '已提供' : '未提供'}</span>
          </div>
          <div class="evidence-item" class:evidence-ok={order.evidence_quality} class:evidence-missing={!order.evidence_quality}>
            <span class="evidence-icon">{order.evidence_quality ? '✅' : '❌'}</span>
            <span class="evidence-name">质量检测</span>
            <span class="evidence-status">{order.evidence_quality ? '已提供' : '未提供'}</span>
          </div>
          <div class="evidence-item" class:evidence-ok={order.evidence_quantity} class:evidence-missing={!order.evidence_quantity}>
            <span class="evidence-icon">{order.evidence_quantity ? '✅' : '❌'}</span>
            <span class="evidence-name">数量核实</span>
            <span class="evidence-status">{order.evidence_quantity ? '已提供' : '未提供'}</span>
          </div>
        </div>
        <div class="risk-rules">
          <p class="rule-title">风险分级处置规则：</p>
          <p class="rule-item" class:active-rule={order.risk_level === 'high'}>🔴 高风险：推进需全部3项证据</p>
          <p class="rule-item" class:active-rule={order.risk_level === 'medium'}>🟡 中风险：推进需温度记录</p>
          <p class="rule-item" class:active-rule={order.risk_level === 'low'}>🟢 低风险：标准流程即可</p>
        </div>
      </div>
    </div>

    <div class="process-card">
      <h3 class="card-title">处理操作</h3>
      {#if availableActions.length === 0}
        <div class="no-action">当前状态「{statusLabel(order.status)}」无需处理</div>
      {:else}
        <div class="process-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">当前处理人</label>
              <div class="handler-info">
                {order.current_handler_name}
                <span class="role-badge">{roleLabel(order.current_handler_role)}</span>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">选择操作</label>
              <select class="form-select" bind:value={selectedAction}>
                <option value="">请选择操作</option>
                {#each availableActions as a}
                  <option value={a.action}>{a.label}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="form-group full">
            <label class="form-label">处理意见</label>
            <textarea class="form-textarea" bind:value={opinion} placeholder="请填写处理意见..." rows="3"></textarea>
          </div>
          <div class="form-row evidence-form">
            <label class="form-label">补充证据（可选）</label>
            <div class="evidence-checks">
              <label class="check-item">
                <input type="checkbox" bind:checked={evTemp} />
                <span>🌡️ 温度记录</span>
              </label>
              <label class="check-item">
                <input type="checkbox" bind:checked={evQual} />
                <span>🔬 质量检测</span>
              </label>
              <label class="check-item">
                <input type="checkbox" bind:checked={evQty} />
                <span>📦 数量核实</span>
              </label>
            </div>
          </div>
          {#if errorMsg}
            <div class="error-msg">⚠️ {errorMsg}</div>
          {/if}
          <button class="btn btn-submit" on:click={handleProcess} disabled={processing}>
            {processing ? '处理中...' : '提交处理'}
          </button>
        </div>
      {/if}
    </div>

    <div class="records-card">
      <h3 class="card-title">操作记录</h3>
      {#if records.length === 0}
        <div class="no-records">暂无操作记录</div>
      {:else}
        <div class="timeline">
          {#each records as record, i}
            <div class="timeline-item">
              <div class="timeline-dot" style="background: {resultColor(record.result)}"></div>
              {#if i < records.length - 1}
                <div class="timeline-line"></div>
              {/if}
              <div class="timeline-content">
                <div class="timeline-header">
                  <span class="timeline-handler">{record.handler_name}</span>
                  <span class="timeline-role">{record.role_label}</span>
                  <span class="timeline-action">{actionIcon(record.action)} {record.action_label}</span>
                  <span class="timeline-result" style="color: {resultColor(record.result)}">{resultLabel(record.result)}</span>
                  <span class="timeline-time">{new Date(record.created_at).toLocaleString('zh-CN')}</span>
                </div>
                {#if record.opinion}
                  <div class="timeline-opinion">
                    <span class="opinion-label">意见：</span>{record.opinion}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .loading, .empty {
    text-align: center;
    padding: 60px;
    color: #64748b;
  }

  .detail-page {
    max-width: 100%;
  }

  .detail-header {
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
    display: inline;
  }

  .header-badges {
    display: inline-flex;
    gap: 8px;
    margin-left: 12px;
    vertical-align: middle;
  }

  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .badge-lg {
    padding: 4px 12px;
    font-size: 13px;
    font-weight: 600;
  }

  .version-tag {
    display: inline-block;
    padding: 4px 10px;
    background: #f1f5f9;
    border-radius: 4px;
    font-size: 12px;
    color: #64748b;
    font-family: monospace;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }

  .info-card {
    background: white;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  .card-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #334155;
    padding-bottom: 8px;
    border-bottom: 1px solid #e2e8f0;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .full-width {
    grid-column: 1 / -1;
  }

  .info-label {
    font-size: 12px;
    color: #94a3b8;
    font-weight: 500;
  }

  .info-value {
    font-size: 14px;
    color: #1e293b;
    font-weight: 500;
  }

  .temp-value {
    color: #0369a1;
    font-family: monospace;
  }

  .time-value {
    color: #64748b;
    font-size: 13px;
  }

  .role-tag {
    font-size: 11px;
    color: #94a3b8;
  }

  .evidence-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }

  .evidence-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 14px;
  }

  .evidence-ok {
    background: #ecfdf5;
  }

  .evidence-missing {
    background: #fef2f2;
  }

  .evidence-icon {
    font-size: 16px;
  }

  .evidence-name {
    flex: 1;
    font-weight: 500;
  }

  .evidence-status {
    font-size: 12px;
    color: #64748b;
  }

  .risk-rules {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
  }

  .rule-title {
    font-size: 12px;
    font-weight: 600;
    color: #475569;
    margin-bottom: 6px;
  }

  .rule-item {
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.8;
  }

  .active-rule {
    color: #1e293b;
    font-weight: 600;
  }

  .process-card {
    background: white;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    margin-bottom: 16px;
  }

  .no-action {
    color: #64748b;
    font-size: 14px;
    text-align: center;
    padding: 20px;
    background: #f8fafc;
    border-radius: 6px;
  }

  .process-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .form-row {
    display: flex;
    gap: 16px;
  }

  .form-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-group.full {
    width: 100%;
  }

  .form-label {
    font-size: 12px;
    color: #64748b;
    font-weight: 600;
  }

  .handler-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    padding: 6px 10px;
    background: #f0f9ff;
    border-radius: 6px;
    color: #0369a1;
    font-weight: 500;
  }

  .role-badge {
    font-size: 11px;
    padding: 2px 6px;
    background: #dbeafe;
    border-radius: 3px;
    color: #1d4ed8;
  }

  .form-select {
    padding: 8px 10px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 14px;
  }

  .form-textarea {
    padding: 8px 10px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 14px;
    resize: vertical;
    font-family: inherit;
  }

  .evidence-form {
    flex-direction: column;
  }

  .evidence-checks {
    display: flex;
    gap: 16px;
  }

  .check-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    cursor: pointer;
  }

  .error-msg {
    padding: 8px 12px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #dc2626;
    font-size: 13px;
  }

  .btn {
    display: inline-block;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-submit {
    background: #2563eb;
    color: white;
    padding: 10px 24px;
    font-weight: 600;
    align-self: flex-start;
  }

  .btn-submit:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .btn-submit:disabled {
    background: #93c5fd;
    cursor: not-allowed;
  }

  .records-card {
    background: white;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  .no-records {
    color: #94a3b8;
    text-align: center;
    padding: 20px;
  }

  .timeline {
    position: relative;
  }

  .timeline-item {
    position: relative;
    padding-left: 28px;
    padding-bottom: 20px;
  }

  .timeline-item:last-child {
    padding-bottom: 0;
  }

  .timeline-dot {
    position: absolute;
    left: 0;
    top: 4px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 0 0 1px currentColor;
  }

  .timeline-line {
    position: absolute;
    left: 5px;
    top: 18px;
    width: 2px;
    height: calc(100% - 8px);
    background: #e2e8f0;
  }

  .timeline-content {
    background: #f8fafc;
    border-radius: 8px;
    padding: 12px 14px;
    border: 1px solid #e2e8f0;
  }

  .timeline-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }

  .timeline-handler {
    font-weight: 600;
    font-size: 13px;
    color: #1e293b;
  }

  .timeline-role {
    font-size: 11px;
    padding: 1px 6px;
    background: #e2e8f0;
    border-radius: 3px;
    color: #475569;
  }

  .timeline-action {
    font-size: 12px;
    color: #64748b;
  }

  .timeline-result {
    font-size: 12px;
    font-weight: 600;
  }

  .timeline-time {
    font-size: 11px;
    color: #94a3b8;
    margin-left: auto;
  }

  .timeline-opinion {
    font-size: 13px;
    color: #475569;
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px dashed #e2e8f0;
  }

  .opinion-label {
    font-weight: 600;
    color: #64748b;
  }

  @media (max-width: 768px) {
    .detail-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
