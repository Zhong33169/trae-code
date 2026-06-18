<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import type { User } from '$lib/types';
  import { ROLE_LABEL, RISK_REQUIRED_EVIDENCE } from '$lib/types';

  let users: User[] = [];
  let currentUserId = '';
  let errorMsg = '';
  let successMsg = '';

  let customer_name = '';
  let trade_type = '股票买入';
  let trade_amount = 0;
  let trade_date = new Date().toISOString().slice(0, 10);
  let account_no = '';
  let risk_level = 'MEDIUM';
  let deadline = '';
  let selectedEvidence: string[] = [];

  onMount(async () => {
    if (browser) currentUserId = localStorage.getItem('currentUserId') || '';
    users = await api.getUsers();
    if (!currentUserId && users.length > 0) {
      currentUserId = users.find(u => u.role === 'FINANCIAL_ADVISOR')?.id || users[0].id;
    }
    $: requiredEvidence = RISK_REQUIRED_EVIDENCE[risk_level] || [];
  });

  $: requiredEvidence = RISK_REQUIRED_EVIDENCE[risk_level] || [];
  $: currentUser = users.find(u => u.id === currentUserId);
  $: canRegister = currentUser?.role === 'FINANCIAL_ADVISOR';

  function toggleEvidence(ev: string) {
    if (selectedEvidence.includes(ev)) {
      selectedEvidence = selectedEvidence.filter(e => e !== ev);
    } else {
      selectedEvidence = [...selectedEvidence, ev];
    }
  }

  async function submit() {
    errorMsg = '';
    successMsg = '';
    if (!canRegister) {
      errorMsg = '仅理财顾问可以登记交易核查单，请切换身份';
      return;
    }
    try {
      const body: any = {
        customer_name,
        trade_type,
        trade_amount: Number(trade_amount),
        trade_date,
        account_no,
        risk_level,
        created_by: currentUserId,
        evidence: selectedEvidence,
      };
      if (deadline) body.deadline = deadline + ' 23:59:59';
      const r = await api.register(body);
      successMsg = `登记成功！单号 ${r.code}，即将跳转详情...`;
      setTimeout(() => goto(`/review/${r.id}`), 1200);
    } catch (e: any) {
      errorMsg = e.message || '登记失败';
    }
  }
</script>

<div class="card">
  <h3>交易核查单登记</h3>

  {#if !canRegister}
    <div class="alert warning">
      当前身份为 <strong>{currentUser?.name}（{currentUser ? ROLE_LABEL[currentUser.role] : ''}）</strong>，
      仅理财顾问可以登记交易核查单，请在右上角切换身份。
    </div>
  {/if}

  {#if errorMsg}
    <div class="alert error">{errorMsg}</div>
  {/if}
  {#if successMsg}
    <div class="alert success">{successMsg}</div>
  {/if}

  <div class="form-grid">
    <div>
      <label>客户姓名 *</label>
      <input bind:value={customer_name} placeholder="请输入客户姓名" />
    </div>
    <div>
      <label>资金账号 *</label>
      <input bind:value={account_no} placeholder="请输入资金账号" />
    </div>
    <div>
      <label>交易类型 *</label>
      <select bind:value={trade_type}>
        <option>股票买入</option>
        <option>股票卖出</option>
        <option>基金申购</option>
        <option>基金赎回</option>
        <option>融资融券</option>
        <option>期权交易</option>
        <option>理财产品购买</option>
      </select>
    </div>
    <div>
      <label>交易金额 (元) *</label>
      <input type="number" bind:value={trade_amount} min="0" step="0.01" />
    </div>
    <div>
      <label>交易日期 *</label>
      <input type="date" bind:value={trade_date} />
    </div>
    <div>
      <label>风险等级 *</label>
      <select bind:value={risk_level}>
        <option value="LOW">低风险（优先级 10）</option>
        <option value="MEDIUM">中风险（优先级 50）</option>
        <option value="HIGH">高风险（优先级 100）</option>
      </select>
    </div>
    <div>
      <label>截止日期（留空则不设）</label>
      <input type="date" bind:value={deadline} />
    </div>
  </div>

  <div class="card" style="margin-top:20px; padding:0; box-shadow:none; margin-bottom:0">
    <h3 style="margin-top:20px">证据材料
      <span style="font-size:12px; color:var(--text-muted); font-weight:normal">（根据风险等级自动列出必填项）</span>
    </h3>
    <div class="evidence-list">
      {#each requiredEvidence as ev}
        <label class="evidence-item">
          <input type="checkbox" checked={selectedEvidence.includes(ev)} on:change={() => toggleEvidence(ev)} />
          <span style="color:var(--danger)">*</span>
          {ev}
        </label>
      {/each}
      {#if requiredEvidence.length === 0}
        <div style="color:var(--text-muted)">该风险等级暂无需证据</div>
      {/if}
      <div style="margin-top:10px; color:var(--text-muted); font-size:13px">
        已选择 {selectedEvidence.length} / {requiredEvidence.length} 项必填证据
      </div>
    </div>
  </div>

  <div style="margin-top:20px; display:flex; gap:10px">
    <button class="primary" on:click={submit} disabled={!canRegister || !customer_name || !account_no || !trade_amount || !trade_date}>
      提交登记
    </button>
    <button on:click={() => goto('/')}>返回队列</button>
  </div>
</div>
