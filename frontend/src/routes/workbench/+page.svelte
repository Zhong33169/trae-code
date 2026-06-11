<script>
  import { onMount } from 'svelte';
  import { fetchManagerWorkbench, fetchOrder, processOrder, STATUS_MAP, RISK_MAP, ROLE_MAP, RESULT_MAP, ACTION_MAP } from '$lib/api';

  const TABS = [
    { key: 'manager_action', label: '👔 经理办理区', color: '#6366f1', bg: '#eef2ff',
      desc: '待经理复核 / 已驳回，经理可执行动作' },
    { key: 'keeper_correction', label: '📋 仓管员补正中', color: '#f59e0b', bg: '#fffbeb',
      desc: '退回补正跟踪，由仓管员处理补正，完成后自动回到经理' },
    { key: 'conflict_fix', label: '⚠️ 冲突待修复', color: '#7c3aed', bg: '#f5f3ff',
      desc: '版本冲突或状态不一致，强制回登记重走' }
  ];

  let wb = null;
  let detail = null;
  let activeTab = 'manager_action';
  let selectedId = null;
  let loading = true;
  let processing = false;
  let errorMsg = '';

  let selectedAction = '';
  let opinion = '';
  let evTemp = false;
  let evQual = false;
  let evQty = false;

  $: tabItems = wb?.items?.[activeTab] || [];
  $: selectedItem = tabItems.find(x => x.id === selectedId) || null;
  $: isReadonly = selectedItem?.is_readonly ?? true;

  function statusLabel(s) { return STATUS_MAP[s]?.label || s; }
  function statusColor(s) { return STATUS_MAP[s]?.color || '#666'; }
  function statusBg(s) { return STATUS_MAP[s]?.bg || '#f5f5f5'; }
  function riskLabel(r) { return RISK_MAP[r]?.label || r; }
  function riskColor(r) { return RISK_MAP[r]?.color || '#666'; }
  function riskBg(r) { return RISK_MAP[r]?.bg || '#f5f5f5'; }
  function roleLabel(r) { return ROLE_MAP[r]?.label || r; }
  function resultLabel(r) { return RESULT_MAP[r]?.label || r; }
  function resultColor(r) { return RESULT_MAP[r]?.color || '#666'; }

  function actionResult(a) {
    switch (a) {
      case 'return': return 'returned';
      case 'reject': return 'rejected';
      case 'correct': return 'corrected';
      case 'force_fix': return 'force_fixed';
      default: return 'passed';
    }
  }

  function opinionPlaceholder(action) {
    switch (action) {
      case 'approve': return '请写明复核通过意见，例如：证据齐全、同意归档...';
      case 'reject':  return '请写明驳回原因，例如：证据不完整、数据异常、需重新核验...';
      case 'return':  return '请写明退回补正内容，例如：缺少温度记录、质量报告缺失...';
      case 'advance': return '请写明推进意见...';
      case 'correct': return '请写明补正内容和特批原因...';
      case 'force_fix': return '请写明强制修复原因和处理方案...';
      default: return '请填写处理意见...';
    }
  }

  function tabCount(key) { return wb?.counters?.[key] || 0; }

  $: {
    if (selectedItem && detail?.order) {
      evTemp = detail.order.evidence_temperature;
      evQual = detail.order.evidence_quality;
      evQty  = detail.order.evidence_quantity;
    }
  }

  async function loadAll() {
    loading = true;
    selectedAction = '';
    opinion = '';
    errorMsg = '';
    try {
      wb = await fetchManagerWorkbench();
      const items = wb?.items?.[activeTab] || [];
      if (items.length > 0) {
        if (!items.find(x => x.id === selectedId)) {
          selectedId = items[0].id;
        }
        await loadDetail();
      } else {
        selectedId = null;
        detail = null;
      }
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function loadDetail() {
    if (!selectedId) { detail = null; return; }
    try {
      detail = await fetchOrder(selectedId);
      if (detail?.order) {
        evTemp = detail.order.evidence_temperature;
        evQual = detail.order.evidence_quality;
        evQty  = detail.order.evidence_quantity;
      }
    } catch (e) {
      console.error(e);
    }
  }

  onMount(loadAll);

  async function selectTab(key) {
    activeTab = key;
    selectedId = null;
    detail = null;
    const items = wb?.items?.[key] || [];
    if (items.length > 0) {
      selectedId = items[0].id;
      await loadDetail();
    }
  }

  async function selectItem(id) {
    selectedId = id;
    await loadDetail();
  }

  async function handleProcess() {
    if (!selectedItem) { errorMsg = '请先选择入库单'; return; }
    if (isReadonly) { errorMsg = '当前分区为只读跟踪区，无法执行动作'; return; }
    if (!selectedAction) { errorMsg = '请选择操作'; return; }
    if (!opinion.trim()) { errorMsg = '请填写处理意见'; return; }
    errorMsg = '';
    processing = true;
    try {
      const payload = {
        handler_id: selectedItem.current_handler_id,
        action: selectedAction,
        opinion: opinion.trim(),
        result: actionResult(selectedAction),
        version: selectedItem.version,
        evidence_temperature: evTemp,
        evidence_quality: evQual,
        evidence_quantity: evQty
      };
      const res = await processOrder(selectedId, payload);
      if (res.error) {
        errorMsg = res.error + (res.current_version ? ` (当前版本 v${res.current_version})` : '');
      } else {
        detail = res.data;
        if (detail?.order) {
          evTemp = detail.order.evidence_temperature;
          evQual = detail.order.evidence_quality;
          evQty  = detail.order.evidence_quantity;
        }
        selectedAction = '';
        opinion = '';
        await loadAll();
      }
    } catch (e) {
      errorMsg = '处理失败，请重试';
    } finally {
      processing = false;
    }
  }
</script>

{#if loading}
  <div class="loading">加载经理工作台中...</div>
{:else}
  <div class="workbench">
    <div class="wb-header">
      <div>
        <h1 class="page-title">👔 仓储经理复核办理工作台</h1>
        <p class="wb-subtitle">
          {wb.user_name}（经理）&nbsp;·&nbsp;共 <b class="total">{wb.todo_count}</b> 个事项
          &nbsp;·&nbsp;👔 办理 <b>{tabCount('manager_action')}</b>
          &nbsp;·&nbsp;📋 补正跟踪 <b>{tabCount('keeper_correction')}</b>
          &nbsp;·&nbsp;⚠️ 冲突 <b>{tabCount('conflict_fix')}</b>
        </p>
      </div>
      <button class="btn-refresh" on:click={loadAll} disabled={processing}>🔄 刷新</button>
    </div>

    <div class="tabs">
      {#each TABS as tab}
        <button type="button" class="tab-btn"
                class:tab-active={activeTab === tab.key}
                style="--tabc: {tab.color}; --tabbg: {tab.bg};"
                on:click={() => selectTab(tab.key)}>
          <span class="tab-label">{tab.label}</span>
          <span class="tab-badge">{tabCount(tab.key)}</span>
        </button>
      {/each}
    </div>

    {#if TABS.find(t => t.key === activeTab)?.desc}
      <div class="tab-desc" style="border-left-color: {TABS.find(t => t.key === activeTab)?.color}">
        {TABS.find(t => t.key === activeTab)?.desc}
      </div>
    {/if}

    {#if !tabItems.length}
      <div class="empty">当前分区「{TABS.find(t=>t.key===activeTab)?.label}」没有事项</div>
    {:else}
      <div class="wb-body">
        <div class="list-pane">
          <div class="list-header">共 {tabItems.length} 条（按风险优先级排序）</div>
          {#each tabItems as item}
            <div class="order-card"
                 class:card-selected={selectedId === item.id}
                 class:card-high={item.risk_level === 'high'}
                 class:card-readonly={item.is_readonly}
                 on:click={() => selectItem(item.id)}>
              <div class="card-top">
                <span class="card-no">{item.order_no}</span>
                <span class="badge risk-badge"
                      style="color:{riskColor(item.risk_level)}; background:{riskBg(item.risk_level)}">
                  {riskLabel(item.risk_level)}
                </span>
              </div>
              <div class="card-product">{item.product_name} <span class="card-supplier">· {item.supplier}</span></div>
              <div class="card-meta">
                <span>v{item.version}</span>
                <span>{item.temperature_range}</span>
                <span class="badge status-badge"
                      style="color:{statusColor(item.status)}; background:{statusBg(item.status)}">
                  {statusLabel(item.status)}
                </span>
                <span class="evidence-icons">
                  {#if item.evidence_temperature}🌡️{:else}<s title="缺温度记录">🌡️</s>{/if}
                  {#if item.evidence_quality}🔬{:else}<s title="缺质量报告">🔬</s>{/if}
                  {#if item.evidence_quantity}📦{:else}<s title="缺数量凭证">📦</s>{/if}
                </span>
              </div>

              {#if item.tracking_hint}
                <div class="tracking-hint" class:hint-ro={item.is_readonly}>
                  {item.is_readonly ? '👀' : '⏩'}&nbsp; {item.tracking_hint}
                </div>
              {/if}

              {#if item.last_opinion}
                <div class="card-opinion">
                  <span class="op-from">💬 {item.last_handler_name}（{item.last_action_label}→{item.last_result_label}）：</span>
                  {item.last_opinion.length > 45 ? item.last_opinion.slice(0, 45) + '...' : item.last_opinion}
                </div>
              {/if}

              {#if item.required_evidence_cn?.length && !item.is_readonly}
                <div class="card-evidence-req">
                  ⚠️ 操作必须提供：<b>{item.required_evidence_cn.join('、')}</b>
                </div>
              {/if}

              {#if !item.is_readonly && item.available_actions?.length}
                <div class="card-actions-preview">
                  可执行：
                  {#each item.available_actions as a, idx}
                    <span class="mini-action">{a.icon}{a.label}{idx < item.available_actions.length - 1 ? ' · ' : ''}</span>
                  {/each}
                </div>
              {/if}

              {#if item.is_readonly}
                <div class="card-ro-tag">🔒 只读跟踪</div>
              {/if}
            </div>
          {/each}
        </div>

        <div class="detail-pane">
          {#if selectedItem && detail?.order}
            <div class="d-section">
              <div class="d-section-head">
                <h3>📋 {detail.order.order_no} - {detail.order.product_name}</h3>
                <div class="d-head-badges">
                  <span class="badge" style="color:{riskColor(detail.order.risk_level)}; background:{riskBg(detail.order.risk_level)}">
                    {riskLabel(detail.order.risk_level)}
                  </span>
                  <span class="badge" style="color:{statusColor(detail.order.status)}; background:{statusBg(detail.order.status)}">
                    {statusLabel(detail.order.status)}
                  </span>
                  <span class="version-tag">v{detail.order.version}</span>
                  {#if isReadonly}
                    <span class="ro-tag">🔒 只读跟踪</span>
                  {/if}
                </div>
              </div>

              {#if selectedItem.tracking_hint}
                <div class="track-banner" class:tb-ro={isReadonly}>
                  {isReadonly ? '👀 补正跟踪' : '⏩ 办理进度'}：{selectedItem.tracking_hint}
                </div>
              {/if}

              <div class="info-grid">
                <div class="info-item"><span>供应商</span><b>{detail.order.supplier}</b></div>
                <div class="info-item"><span>温区</span><b class="temp-value">{detail.order.temperature_range}</b></div>
                <div class="info-item"><span>库位</span><b>{detail.order.storage_location}</b></div>
                <div class="info-item"><span>当前处理人</span><b>{detail.order.current_handler_name}（{roleLabel(detail.order.current_handler_role)}）</b></div>
                <div class="info-item"><span>创建人</span><b>{detail.order.created_by_name}</b></div>
                <div class="info-item"><span>更新时间</span><b>{new Date(detail.order.updated_at).toLocaleString('zh-CN')}</b></div>
              </div>
            </div>

            <div class="d-section ev-section">
              <h4>🔬 证据状态 & 风险规则</h4>
              <div class="evidence-row">
                <label class="ev-pill" class:ev-ok={evTemp} class:ev-miss={!evTemp} class:ev-locked={isReadonly}>
                  {evTemp ? '✅' : '❌'} 温度记录
                  {#if !isReadonly}
                    <input type="checkbox" bind:checked={evTemp} />
                  {/if}
                </label>
                <label class="ev-pill" class:ev-ok={evQual} class:ev-miss={!evQual} class:ev-locked={isReadonly}>
                  {evQual ? '✅' : '❌'} 质量检测
                  {#if !isReadonly}
                    <input type="checkbox" bind:checked={evQual} />
                  {/if}
                </label>
                <label class="ev-pill" class:ev-ok={evQty} class:ev-miss={!evQty} class:ev-locked={isReadonly}>
                  {evQty ? '✅' : '❌'} 数量核实
                  {#if !isReadonly}
                    <input type="checkbox" bind:checked={evQty} />
                  {/if}
                </label>
              </div>
              {#if selectedItem.required_evidence_cn?.length}
                <div class="rule-alert" class:rule-readonly={isReadonly}>
                  📌 「{riskLabel(detail.order.risk_level)}」操作必须提供：<b>{selectedItem.required_evidence_cn.join('、')}</b>
                </div>
              {/if}
            </div>

            {#if selectedItem.last_opinion}
              <div class="d-section last-op-section">
                <h4>💬 上一处理意见（{selectedItem.last_handler_name} · {selectedItem.last_action_label} → {selectedItem.last_result_label}）</h4>
                <div class="opinion-box">{selectedItem.last_opinion}</div>
              </div>
            {/if}

            <div class="d-section">
              <h4>📜 操作 & 审计轨迹（{detail.operation_records.length} 条）</h4>
              <div class="mini-timeline">
                {#each detail.operation_records.slice().reverse() as record}
                  <div class="mt-item" class:mt-conflict={record.result === 'conflict'}>
                    <span class="mt-dot" style="background:{resultColor(record.result)}"></span>
                    <div class="mt-body">
                      <div class="mt-head">
                        <b>{record.handler_name}</b> <span class="mt-role">{record.role_label}</span>
                        <span class="mt-action">{record.action_label}</span>
                        <span class="mt-result" style="color:{resultColor(record.result)}">{record.result_label}</span>
                        <span class="mt-time">{new Date(record.created_at).toLocaleString('zh-CN')}</span>
                      </div>
                      {#if record.opinion}
                        <div class="mt-opinion">{record.opinion}</div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <div class="select-hint">← 请从左侧选择一个入库单查看详情</div>
          {/if}
        </div>
      </div>

      {#if selectedItem && detail?.order && !isReadonly && selectedItem.available_actions?.length}
        <div class="sticky-action">
          <div class="sa-left">
            <div class="sa-title">
              👔 经理办理区
              <span class="sa-no">{detail.order.order_no} v{detail.order.version}</span>
              {#if detail.order.current_handler_role === 'warehouse_manager'}
                <span class="sa-role">✅ 您是当前处理人</span>
              {:else}
                <span class="sa-role sa-role-warn">⚠️ 当前处理人非经理</span>
              {/if}
            </div>
          </div>
          <div class="sa-body">
            <div class="action-btns">
              {#each selectedItem.available_actions as a}
                <button type="button" class="sa-btn"
                        class:sa-selected={selectedAction === a.action}
                        class:sa-danger={a.action === 'return' || a.action === 'reject' || a.action === 'force_fix'}
                        class:sa-success={a.action === 'approve' || a.action === 'correct' || a.action === 'advance'}
                        on:click={() => selectedAction = a.action}>
                  <span>{a.icon}</span>
                  <span>{a.label}</span>
                </button>
              {/each}
            </div>
            <textarea class="sa-textarea" bind:value={opinion} rows="2"
                      placeholder={opinionPlaceholder(selectedAction)}></textarea>
          </div>
          <div class="sa-right">
            {#if errorMsg}
              <div class="sa-error">⚠️ {errorMsg}</div>
            {/if}
            <button class="btn-submit" on:click={handleProcess} disabled={processing || !selectedAction}>
              {processing ? '提交中...' : '提交处理 (v' + detail.order.version + ' → v' + (detail.order.version + 1) + ')'}
            </button>
          </div>
        </div>
      {:else if selectedItem && isReadonly}
        <div class="sticky-action sa-readonly-bar">
          <div class="sa-ro-content">
            🔒 <b>只读跟踪区</b>：本单由 {selectedItem.current_handler_role_label}「{selectedItem.current_handler_name}」处理补正，
            提交后将自动回到经理工作台办理区。
          </div>
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .loading { text-align: center; padding: 60px; color: #64748b; font-size: 15px; }
  .empty { text-align: center; padding: 80px 20px; color: #94a3b8; background: white; border-radius: 10px; }

  .workbench { max-width: 100%; padding-bottom: 140px; }

  .wb-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
  .page-title { font-size: 22px; font-weight: 700; color: #1e3a5f; margin: 0 0 4px; }
  .wb-subtitle { color: #64748b; font-size: 13px; }
  .wb-subtitle .total { color: #6366f1; font-size: 16px; }
  .wb-subtitle b { color: #475569; }
  .btn-refresh { padding: 8px 14px; border-radius: 6px; background: #e0e7ff; color: #4338ca; border: none; font-size: 13px; cursor: pointer; font-weight: 500; }
  .btn-refresh:hover { background: #c7d2fe; }
  .btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }

  .tabs { display: flex; gap: 8px; margin-bottom: 10px; background: white; padding: 8px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); flex-wrap: wrap; }
  .tab-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border: 2px solid transparent; background: transparent; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: #64748b; font-family: inherit; transition: all 0.15s; }
  .tab-btn:hover { background: #f8fafc; }
  .tab-btn.tab-active { background: var(--tabbg); border-color: var(--tabc); color: var(--tabc); font-weight: 700; }
  .tab-badge { background: rgba(0,0,0,0.06); color: inherit; padding: 2px 10px; border-radius: 10px; font-size: 12px; font-weight: 700; }
  .tab-active .tab-badge { background: var(--tabc); color: white; }

  .tab-desc { margin-bottom: 14px; padding: 8px 14px; background: white; border-left: 4px solid #6366f1; border-radius: 6px; font-size: 12px; color: #475569; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

  .wb-body { display: grid; grid-template-columns: 400px 1fr; gap: 16px; align-items: start; }

  .list-pane { display: flex; flex-direction: column; gap: 8px; }
  .list-header { font-size: 12px; color: #64748b; font-weight: 600; padding: 0 4px; }

  .order-card { background: white; border-radius: 10px; padding: 12px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); cursor: pointer; border: 2px solid transparent; transition: all 0.15s; position: relative; }
  .order-card:hover { border-color: #cbd5e1; }
  .order-card.card-selected { border-color: #6366f1; background: #eef2ff; }
  .order-card.card-high { border-left: 4px solid #dc2626; }
  .order-card.card-readonly { background: linear-gradient(to right, #fffbeb 0%, white 15%); }
  .order-card.card-readonly.card-selected { border-color: #f59e0b; background: #fffbeb; }
  .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .card-no { font-family: 'SF Mono', monospace; font-size: 12px; color: #4338ca; font-weight: 700; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .risk-badge { font-size: 11px; }
  .status-badge { font-size: 11px; margin-left: 2px; }
  .card-product { font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
  .card-supplier { font-size: 12px; color: #64748b; font-weight: 400; }
  .card-meta { display: flex; gap: 8px; font-size: 11px; color: #94a3b8; align-items: center; margin-bottom: 6px; flex-wrap: wrap; }
  .evidence-icons { letter-spacing: 2px; margin-left: auto; }
  .evidence-icons s { opacity: 0.22; text-decoration: none; }
  .tracking-hint { font-size: 11px; padding: 5px 9px; margin-bottom: 6px; border-radius: 4px; background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; line-height: 1.4; }
  .tracking-hint.hint-ro { background: #fffbeb; color: #92400e; border-color: #fde68a; }
  .card-opinion { font-size: 12px; background: #f8fafc; padding: 6px 8px; border-radius: 4px; color: #475569; line-height: 1.5; }
  .op-from { color: #6366f1; font-weight: 600; margin-right: 2px; }
  .card-evidence-req { margin-top: 6px; font-size: 11px; padding: 4px 8px; background: #fff7ed; color: #92400e; border-radius: 4px; border: 1px solid #fed7aa; }
  .card-actions-preview { margin-top: 6px; font-size: 11px; color: #4338ca; padding-top: 6px; border-top: 1px dashed #e0e7ff; }
  .mini-action { font-weight: 600; }
  .card-ro-tag { position: absolute; top: 10px; right: 10px; padding: 2px 8px; background: #fef3c7; color: #92400e; border-radius: 10px; font-size: 10px; font-weight: 700; }

  .detail-pane { background: white; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); min-height: 400px; }
  .select-hint { padding: 120px 20px; text-align: center; color: #94a3b8; font-size: 14px; }
  .d-section { padding: 16px 18px; border-bottom: 1px solid #f1f5f9; }
  .d-section:last-child { border-bottom: none; }
  .d-section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px; }
  .d-section-head h3 { font-size: 15px; font-weight: 700; color: #1e293b; margin: 0; }
  .d-head-badges { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .version-tag { padding: 2px 10px; background: #f1f5f9; border-radius: 4px; font-size: 11px; color: #475569; font-family: 'SF Mono', monospace; font-weight: 600; }
  .ro-tag { padding: 2px 10px; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 11px; font-weight: 700; }
  .d-section h4 { font-size: 13px; font-weight: 700; color: #475569; margin: 0 0 10px; }
  .track-banner { margin-bottom: 12px; padding: 10px 14px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; font-size: 13px; color: #4338ca; font-weight: 500; }
  .track-banner.tb-ro { background: #fffbeb; border-color: #fde68a; color: #92400e; }
  .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 16px; }
  .info-item { display: flex; flex-direction: column; gap: 2px; }
  .info-item span { font-size: 11px; color: #94a3b8; font-weight: 500; }
  .info-item b { font-size: 13px; color: #1e293b; font-weight: 600; }
  .temp-value { font-family: 'SF Mono', monospace; color: #0369a1 !important; font-size: 12px; }

  .evidence-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
  .ev-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 100px; font-size: 12px; font-weight: 500; }
  .ev-ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .ev-miss { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .ev-locked { cursor: default; opacity: 0.85; }
  .ev-pill input { margin-left: 4px; cursor: pointer; }
  .ev-locked input { display: none; }
  .rule-alert { padding: 8px 12px; background: #eef2ff; color: #4338ca; border-radius: 6px; font-size: 12px; border: 1px solid #c7d2fe; }
  .rule-readonly { background: #fffbeb; color: #92400e; border-color: #fde68a; }

  .last-op-section .opinion-box { background: #f0f9ff; border: 1px dashed #bae6fd; border-left: 4px solid #0284c7; padding: 10px 14px; border-radius: 6px; font-size: 13px; color: #0c4a6e; line-height: 1.6; white-space: pre-wrap; }

  .mini-timeline { display: flex; flex-direction: column; gap: 10px; max-height: 260px; overflow-y: auto; padding-right: 4px; }
  .mt-item { display: flex; gap: 10px; }
  .mt-dot { flex-shrink: 0; width: 10px; height: 10px; border-radius: 50%; margin-top: 6px; border: 2px solid white; box-shadow: 0 0 0 1px rgba(0,0,0,0.1); }
  .mt-body { flex: 1; background: #f8fafc; border-radius: 6px; padding: 8px 10px; font-size: 12px; border: 1px solid #e2e8f0; }
  .mt-conflict .mt-body { background: #f5f3ff; border-color: #ddd6fe; }
  .mt-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 3px; }
  .mt-head b { color: #1e293b; }
  .mt-role { font-size: 10px; padding: 1px 6px; background: #e2e8f0; color: #475569; border-radius: 3px; }
  .mt-action { color: #64748b; }
  .mt-result { font-weight: 600; margin-left: 2px; }
  .mt-time { margin-left: auto; color: #94a3b8; font-size: 10px; }
  .mt-opinion { color: #475569; font-size: 11px; line-height: 1.5; }

  .sticky-action { position: fixed; bottom: 0; left: 0; right: 0; background: white; border-top: 2px solid #c7d2fe; box-shadow: 0 -4px 20px rgba(99,102,241,0.15); padding: 12px 24px; display: grid; grid-template-columns: 300px 1fr 300px; gap: 14px; align-items: center; z-index: 200; }
  .sa-title { font-weight: 700; color: #4338ca; font-size: 14px; display: flex; flex-direction: column; gap: 3px; }
  .sa-no { font-family: monospace; font-size: 12px; color: #64748b; font-weight: 500; }
  .sa-role { font-size: 11px; color: #065f46; font-weight: 600; margin-top: 2px; }
  .sa-role-warn { color: #92400e; }
  .sa-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .action-btns { display: flex; gap: 6px; flex-wrap: wrap; }
  .sa-btn { display: inline-flex; gap: 4px; align-items: center; padding: 7px 11px; border: 2px solid #e2e8f0; border-radius: 6px; background: white; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; color: #475569; }
  .sa-btn:hover { border-color: #93c5fd; }
  .sa-btn.sa-selected { border-color: #6366f1; background: #eef2ff; color: #4338ca; font-weight: 700; }
  .sa-btn.sa-danger.sa-selected { border-color: #ef4444; background: #fee2e2; color: #991b1b; }
  .sa-btn.sa-success.sa-selected { border-color: #10b981; background: #d1fae5; color: #065f46; }
  .sa-textarea { padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; resize: vertical; font-family: inherit; }
  .sa-right { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
  .sa-error { font-size: 11px; padding: 4px 8px; background: #fef2f2; color: #dc2626; border-radius: 4px; border: 1px solid #fecaca; text-align: center; }
  .btn-submit { padding: 11px 16px; background: linear-gradient(135deg, #6366f1, #4338ca); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }
  .btn-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.4); }
  .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  .sa-readonly-bar { background: linear-gradient(to right, #fffbeb 0%, white 40%); border-top-color: #f59e0b; padding: 10px 24px; box-shadow: 0 -4px 20px rgba(245,158,11,0.15); }
  .sa-ro-content { text-align: center; font-size: 13px; color: #92400e; font-weight: 500; }
  .sa-ro-content b { color: #78350f; font-size: 14px; }

  @media (max-width: 1024px) {
    .wb-body { grid-template-columns: 1fr; }
    .sticky-action { grid-template-columns: 1fr; gap: 8px; padding: 10px 16px; }
    .info-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
