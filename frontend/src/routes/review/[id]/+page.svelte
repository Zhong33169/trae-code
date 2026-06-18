<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/userStore';
  import { api } from '$lib/api';
  import type { TradeReview, ReviewRecord } from '$lib/types';
  import {
    STATUS_LABEL, RISK_LABEL, ROLE_LABEL, ACTION_LABEL, statusColor, riskColor,
    fmtMoney, fmtDate, parseEvidence, RISK_REQUIRED_EVIDENCE,
  } from '$lib/types';

  let review: TradeReview | null = null;
  let records: ReviewRecord[] = [];
  let loading = true;
  let errorMsg = '';
  let successMsg = '';
  let lastUserId = '';

  let opinion = '';
  let result = '';
  let selectedEvidence: string[] = [];
  let showActionPanel = false;
  let currentAction = '';

  onMount(async () => {
    if ($userStore.currentUserId) {
      lastUserId = $userStore.currentUserId;
      await loadDetail();
    }
  });

  afterUpdate(() => {
    if ($userStore.currentUserId && $userStore.currentUserId !== lastUserId && !$userStore.loading) {
      lastUserId = $userStore.currentUserId;
      loadDetail();
      showActionPanel = false;
    }
  });

  async function loadDetail() {
    loading = true;
    errorMsg = '';
    successMsg = '';
    try {
      const id = $page.params.id;
      const d = await api.getDetail(id);
      review = d.review;
      records = d.records;
      selectedEvidence = parseEvidence(review.evidence_json);
    } catch (e: any) {
      errorMsg = e.message || '加载失败';
    }
    loading = false;
  }

  $: currentUser = $userStore.users.find(u => u.id === $userStore.currentUserId);
  $: requiredEvidence = review ? (RISK_REQUIRED_EVIDENCE[review.risk_level] || []) : [];
  $: missingEvidence = requiredEvidence.filter(r => !selectedEvidence.some(e => e && e.includes(r)));

  $: canDo = {
    submitReview: !!(currentUser?.role === 'COMPLIANCE_OFFICER'
      && review?.current_role === 'COMPLIANCE_OFFICER'
      && (review.status === 'REGISTERED' || review.status === 'PENDING_CORRECTION')),
    requestCorrection: !!(currentUser?.role === 'COMPLIANCE_OFFICER'
      && (review?.status === 'REGISTERED' || review?.status === 'REVIEWING')),
    correct: !!(currentUser?.role === 'FINANCIAL_ADVISOR'
      && review?.current_role === 'FINANCIAL_ADVISOR'
      && review.status === 'PENDING_CORRECTION'),
    confirmComplete: !!(currentUser?.role === 'BRANCH_MANAGER'
      && review?.current_role === 'BRANCH_MANAGER'
      && review.status === 'REVIEWING'),
    rejectReview: !!(currentUser?.role === 'BRANCH_MANAGER'
      && review?.current_role === 'BRANCH_MANAGER'
      && review.status === 'REVIEWING'),
  };

  function openAction(action: string) {
    currentAction = action;
    showActionPanel = true;
    opinion = '';
    result = '';
    errorMsg = '';
    successMsg = '';
    if (review) {
      selectedEvidence = parseEvidence(review.evidence_json);
    }
  }

  function toggleEvidence(ev: string) {
    if (selectedEvidence.includes(ev)) {
      selectedEvidence = selectedEvidence.filter(e => e !== ev);
    } else {
      selectedEvidence = [...selectedEvidence, ev];
    }
  }

  async function doAction() {
    if (!review || !currentUser) return;
    errorMsg = '';
    successMsg = '';
    try {
      const body = {
        review_id: review.id,
        operator_id: $userStore.currentUserId,
        operator_role: currentUser.role,
        expected_version: review.version,
        opinion,
        result,
        evidence: selectedEvidence,
      };
      let res: any;
      switch (currentAction) {
        case 'submitReview': res = await api.submitReview(body); break;
        case 'requestCorrection': res = await api.requestCorrection(body); break;
        case 'correct': res = await api.correct(body); break;
        case 'confirmComplete': res = await api.confirmComplete(body); break;
        case 'rejectReview': res = await api.rejectReview(body); break;
      }
      successMsg = '操作成功！正在刷新...';
      showActionPanel = false;
      setTimeout(loadDetail, 800);
    } catch (e: any) {
      errorMsg = e.message || '操作失败';
      setTimeout(loadDetail, 800);
    }
  }

  function getPrevRecord(): ReviewRecord | null {
    if (records.length < 2) return null;
    const notReject = records.filter(r => r.action !== 'REJECT');
    return notReject.length >= 2 ? notReject[1] : records[1];
  }

  function getHandlerName(id: string | null): string {
    if (!id) return '-';
    return $userStore.users.find(u => u.id === id)?.name || '-';
  }

  const actionLabelMap: Record<string, string> = {
    submitReview: '核验通过 · 提交复核',
    requestCorrection: '退回补正',
    correct: '补正提交',
    confirmComplete: '确认办结',
    rejectReview: '驳回复核',
  };
</script>

<div class="breadcrumb">
  <a href="/">核查队列</a> / <span>核查单详情</span>
</div>

{#if loading}
  <div class="card"><div style="padding:40px; text-align:center; color:var(--text-muted)">加载中...</div></div>
{:else if !review}
  <div class="card"><div class="alert error">{errorMsg || '未找到核查单'}</div></div>
{:else}
  {#if errorMsg}
    <div class="alert error">{errorMsg}</div>
  {/if}
  {#if successMsg}
    <div class="alert success">{successMsg}</div>
  {/if}

  <div class="card">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px">
      <div>
        <h3 style="border:none; padding:0; margin-bottom:8px">
          {review.code}
          {#if review.is_overdue}
            <span class="tag overdue" style="margin-left:8px">逾期</span>
          {/if}
          <span class="tag" style="margin-left:8px; background:{riskColor(review.risk_level)}20; color:{riskColor(review.risk_level)}; border:1px solid {riskColor(review.risk_level)}50">
            {RISK_LABEL[review.risk_level]}（优先级 {review.priority}）
          </span>
          <span class="tag" style="margin-left:8px; background:{statusColor(review.status)}20; color:{statusColor(review.status)}; border:1px solid {statusColor(review.status)}50">
            {STATUS_LABEL[review.status]}
          </span>
          {#if review.current_handler_id === $userStore.currentUserId && review.status !== 'COMPLETED'}
            <span class="tag" style="margin-left:8px; background:#dbeafe; color:#1e40af; border:1px solid #93c5fd">待我处理</span>
          {/if}
        </h3>
        <div style="color:var(--text-muted); font-size:13px">
          版本 v{review.version} · 登记于 {fmtDate(review.created_at)} · 最后更新 {fmtDate(review.updated_at)}
        </div>
      </div>
      <div>
        <button class="refresh-btn" on:click={loadDetail} title="刷新详情">↻ 刷新</button>
      </div>
    </div>
  </div>

  <div class="detail-grid">
    <div class="card">
      <h3>基本信息</h3>
      <div class="field"><div class="label">客户姓名</div><div class="value">{review.customer_name}</div></div>
      <div class="field"><div class="label">资金账号</div><div class="value">{review.account_no}</div></div>
      <div class="field"><div class="label">交易类型</div><div class="value">{review.trade_type}</div></div>
      <div class="field"><div class="label">交易金额</div><div class="value">{fmtMoney(review.trade_amount)}</div></div>
      <div class="field"><div class="label">交易日期</div><div class="value">{review.trade_date}</div></div>
      <div class="field"><div class="label">截止日期</div><div class="value" style="color:{review.is_overdue ? 'var(--danger)' : 'inherit'}">{fmtDate(review.deadline)}</div></div>
    </div>
    <div class="card">
      <h3>处理信息</h3>
      <div class="field">
        <div class="label">当前处理人</div>
        <div class="value">
          {#if review.current_role}
            {getHandlerName(review.current_handler_id)}（{ROLE_LABEL[review.current_role]}）
          {:else}
            -（已办结）
          {/if}
        </div>
      </div>
      <div class="field">
        <div class="label">当前版本</div>
        <div class="value">v{review.version}</div>
      </div>
      <div class="field">
        <div class="label">登记人</div>
        <div class="value">{getHandlerName(review.created_by)}</div>
      </div>

      {#if getPrevRecord()}
        {@const prev = getPrevRecord()!}
        <div style="margin-top:10px; padding:10px 12px; background:#f8fafc; border-radius:6px">
          <div style="font-weight:600; margin-bottom:4px; color:var(--text-muted); font-size:13px">上一处理人意见</div>
          <div>
            <strong>{prev.operator_name}（{ROLE_LABEL[prev.operator_role]}）</strong>
            · {ACTION_LABEL[prev.action]} · v{prev.version}
          </div>
          <div style="margin-top:4px; color:var(--text-muted); font-size:13px">{fmtDate(prev.created_at)}</div>
          {#if prev.opinion}
            <div style="margin-top:6px">意见：{prev.opinion}</div>
          {/if}
          {#if prev.result}
            <div style="margin-top:2px; color:var(--text-muted)">结果：{prev.result}</div>
          {/if}
        </div>
      {/if}
    </div>
    <div class="card">
      <h3>证据材料 {#if missingEvidence.length > 0 && review.status !== 'COMPLETED'}
        <span class="tag" style="background:#fff7ed; color:#c2410c; border:1px solid #fed7aa; margin-left:8px">缺 {missingEvidence.length} 项</span>
      {/if}</h3>
      <div style="font-size:13px; color:var(--text-muted); margin-bottom:10px">
        {RISK_LABEL[review.risk_level]}必填：{requiredEvidence.join('、')}
      </div>
      {#if parseEvidence(review.evidence_json).length === 0}
        <div style="color:var(--text-muted)">暂无证据材料</div>
      {:else}
        <ul style="list-style:none; padding:0">
          {#each parseEvidence(review.evidence_json) as ev}
            <li style="padding:4px 0">
              <span style="color:var(--success)">✓</span> {ev}
            </li>
          {/each}
        </ul>
      {/if}
      {#if missingEvidence.length > 0 && review.status !== 'COMPLETED'}
        <div style="margin-top:10px; color:var(--danger); font-size:13px">
          缺失：{missingEvidence.join('、')}
        </div>
      {/if}
    </div>
  </div>

  <div class="card">
    <h3>处理操作</h3>
    {#if review.status === 'COMPLETED'}
      <div class="alert success">该核查单已办结归档，不可再操作</div>
    {:else if !currentUser}
      <div style="color:var(--text-muted)">请在右上角选择当前身份后进行操作</div>
    {:else if !canDo.submitReview && !canDo.requestCorrection && !canDo.correct && !canDo.confirmComplete && !canDo.rejectReview}
      <div class="alert warning">
        当前身份为 <strong>{currentUser.name}（{ROLE_LABEL[currentUser.role]}）</strong>，
        当前单据由 {review.current_role ? ROLE_LABEL[review.current_role] : '-'} 处理，暂无可执行操作。
      </div>
    {/if}
    <div class="actions-bar">
      {#if canDo.submitReview}
        <button class="primary" on:click={() => openAction('submitReview')}>核验通过 · 提交复核</button>
      {/if}
      {#if canDo.requestCorrection}
        <button class="warning" on:click={() => openAction('requestCorrection')}>退回补正</button>
      {/if}
      {#if canDo.correct}
        <button class="primary" on:click={() => openAction('correct')}>补正提交</button>
      {/if}
      {#if canDo.confirmComplete}
        <button class="success" on:click={() => openAction('confirmComplete')}>确认办结</button>
      {/if}
      {#if canDo.rejectReview}
        <button class="danger" on:click={() => openAction('rejectReview')}>驳回复核</button>
      {/if}
      <button on:click={() => goto('/')}>返回队列</button>
    </div>
  </div>

  {#if showActionPanel}
    <div class="card">
      <h3>{actionLabelMap[currentAction] || currentAction}</h3>

      {#if (currentAction === 'submitReview' || currentAction === 'correct' || currentAction === 'confirmComplete')}
        <div style="margin-bottom:14px">
          <label>证据材料（必填：{requiredEvidence.join('、')}）</label>
          <div class="evidence-list" style="margin-top:6px">
            {#each requiredEvidence as ev}
              <label class="evidence-item">
                <input type="checkbox" checked={selectedEvidence.includes(ev)} on:change={() => toggleEvidence(ev)} />
                <span style="color:var(--danger)">*</span> {ev}
              </label>
            {/each}
            <div style="color:var(--text-muted); font-size:13px">
              已选 {selectedEvidence.length} / {requiredEvidence.length}
              {#if missingEvidence.length > 0 && (currentAction === 'submitReview' || currentAction === 'correct' || currentAction === 'confirmComplete')}
                <span style="color:var(--danger)"> · 缺少：{missingEvidence.join('、')}</span>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <div class="form-grid">
        <div>
          <label>处理意见</label>
          <textarea bind:value={opinion} rows="3" placeholder="请输入处理意见..."></textarea>
        </div>
        <div>
          <label>处理结果</label>
          <textarea bind:value={result} rows="3" placeholder="请输入处理结果（可选）..."></textarea>
        </div>
      </div>

      <div style="margin-top:14px; color:var(--text-muted); font-size:13px">
        提交时将校验：处理人 {currentUser?.name}、角色 {currentUser ? ROLE_LABEL[currentUser.role] : '-'}、当前版本 v{review.version}、证据完整性。校验失败将保留原状态并写操作记录。
      </div>

      <div style="margin-top:14px; display:flex; gap:10px">
        <button
          class="primary"
          on:click={doAction}
          disabled={(currentAction === 'submitReview' || currentAction === 'correct' || currentAction === 'confirmComplete') && missingEvidence.length > 0}
        >
          确认提交
        </button>
        <button on:click={() => showActionPanel = false}>取消</button>
      </div>
    </div>
  {/if}

  <div class="card">
    <h3>操作记录（倒查痕迹 · 共 {records.length} 条）</h3>
    <div class="timeline">
      {#each records as rec}
        <div class="timeline-item" class:failed={rec.action === 'REJECT' && rec.from_status === rec.to_status}>
          <div class="head">
            <span class="actor">
              {rec.operator_name}（{ROLE_LABEL[rec.operator_role]}）
              <span class="tag" style="margin-left:8px; background:{rec.action === 'REJECT' && rec.from_status === rec.to_status ? 'var(--danger)' : 'var(--primary)'}; color:#fff">
                {ACTION_LABEL[rec.action] || rec.action}
              </span>
            </span>
            <span class="time">{fmtDate(rec.created_at)} · v{rec.version}</span>
          </div>
          <div class="meta">
            {#if rec.from_status || rec.to_status}
              状态：{rec.from_status ? STATUS_LABEL[rec.from_status] : '无'}
              → <strong>{rec.to_status ? STATUS_LABEL[rec.to_status] : '-'}</strong>
            {/if}
            {#if rec.action === 'REJECT' && rec.from_status === rec.to_status}
              <span style="color:var(--danger); margin-left:10px">（校验失败，未变更状态）</span>
            {/if}
          </div>
          <div class="body">
            {#if rec.opinion}
              <div class="opinion"><strong>意见：</strong>{rec.opinion}</div>
            {/if}
            {#if rec.result}
              <div class="result"><strong>结果：</strong>{rec.result}</div>
            {/if}
            {#if rec.evidence_json && parseEvidence(rec.evidence_json).length > 0}
              <div class="result" style="margin-top:4px">
                <strong>证据：</strong>{parseEvidence(rec.evidence_json).join('、')}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .timeline-item.failed::before {
    background: var(--danger) !important;
    box-shadow: 0 0 0 2px var(--danger) !important;
  }
  .timeline-item.failed .body {
    background: #fef2f2 !important;
    border: 1px solid #fecaca;
  }
</style>
