<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { currentUser, currentRole, STATUS_LABELS, STATUS_COLORS, ROLE_LABELS, users } from '$lib/store';

  let orders = [];
  let stats = {};
  let loading = true;
  let filterStatus = '';
  let filterOverdue = '';
  let searchQuery = '';
  let showCreateModal = false;
  let createForm = {
    order_no: '',
    title: '',
    material_code: '',
    material_name: '',
    change_type: '',
    description: ''
  };
  let errorMsg = '';
  let supervisors = [];

  async function loadData() {
    loading = true;
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterOverdue !== '') params.is_overdue = filterOverdue;
      if (searchQuery) params.q = searchQuery;
      if ($currentUser) {
        params.user_id = $currentUser.id;
        params.role = $currentRole;
      }

      const [ordersData, statsData, usersData] = await Promise.all([
        api.listOrders(params),
        api.getStats($currentUser ? { user_id: $currentUser.id, role: $currentRole } : {}),
        api.getUsers()
      ]);
      orders = ordersData;
      stats = statsData;
      supervisors = usersData.filter(u => u.role === 'supervisor');
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadData();
  });

  $: if ($currentUser || $currentRole) {
    loadData();
  }

  $: filterStatus, filterOverdue, searchQuery, setTimeout(() => loadData(), 100);

  function viewDetail(order) {
    goto(`/orders/${order.id}`);
  }

  async function createOrder() {
    errorMsg = '';
    try {
      if (!createForm.order_no || !createForm.title || !createForm.material_code || !createForm.material_name || !createForm.change_type || !createForm.description) {
        throw new Error('请填写所有必填字段');
      }
      const res = await api.createOrder({
        ...createForm,
        registrar_id: $currentUser.id
      });
      showCreateModal = false;
      createForm = { order_no: '', title: '', material_code: '', material_name: '', change_type: '', description: '' };
      goto(`/orders/${res.id}`);
    } catch (e) {
      errorMsg = e.message;
    }
  }

  function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleString('zh-CN', { hour12: false });
  }

  function canCreate() {
    return $currentRole === 'registrar';
  }

  function getRoleTitle() {
    if ($currentRole === 'registrar') return '我的登记单';
    if ($currentRole === 'supervisor') return '我办理的单';
    if ($currentRole === 'reviewer') return '我复核的单';
    return '全部单据';
  }
</script>

<div>
  <div class="page-title">{getRoleTitle()}</div>
  <div class="page-subtitle">
    {#if $currentUser}
      当前操作人：<strong>{$currentUser.name}</strong>（{ROLE_LABELS[$currentRole]}）
    {/if}
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="label">全部</div>
      <div class="value">{stats.total || 0}</div>
    </div>
    <div class="stat-card">
      <div class="label">草稿</div>
      <div class="value" style="color:{STATUS_COLORS.draft}">{stats.draft || 0}</div>
    </div>
    <div class="stat-card">
      <div class="label">待审核主管办理</div>
      <div class="value" style="color:{STATUS_COLORS.pending_review}">{stats.pending_review || 0}</div>
    </div>
    <div class="stat-card">
      <div class="label">需补正附件</div>
      <div class="value" style="color:{STATUS_COLORS.supplement_required}">{stats.supplement_required || 0}</div>
    </div>
    <div class="stat-card">
      <div class="label">待复核归档</div>
      <div class="value" style="color:{STATUS_COLORS.pending_final}">{stats.pending_final || 0}</div>
    </div>
    <div class="stat-card">
      <div class="label">已退回</div>
      <div class="value" style="color:{STATUS_COLORS.returned}">{stats.returned || 0}</div>
    </div>
    <div class="stat-card">
      <div class="label">已归档</div>
      <div class="value" style="color:{STATUS_COLORS.archived}">{stats.archived || 0}</div>
    </div>
    <div class="stat-card">
      <div class="label">超时</div>
      <div class="value" style="color:{STATUS_COLORS.overdue}">{stats.overdue || 0}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">
      <span>单据列表</span>
      <div class="actions-bar">
        {#if canCreate()}
          <button class="btn-primary" on:click={() => showCreateModal = true}>+ 新建物料变更单</button>
        {/if}
      </div>
    </div>

    <div class="filter-bar">
      <input type="text" placeholder="搜索单号/标题/物料编码/物料名称" bind:value={searchQuery} />
      <select bind:value={filterStatus}>
        <option value="">全部状态</option>
        {#each Object.entries(STATUS_LABELS) as [value, label]}
          <option value={value}>{label}</option>
        {/each}
      </select>
      <select bind:value={filterOverdue}>
        <option value="">是否超时</option>
        <option value="true">是（异常）</option>
        <option value="false">否</option>
      </select>
      <button on:click={loadData}>刷新</button>
    </div>

    {#if loading}
      <div class="empty-state">加载中...</div>
    {:else if orders.length === 0}
      <div class="empty-state">暂无数据</div>
    {:else}
      <table class="table">
        <thead>
          <tr>
            <th>单号</th>
            <th>标题</th>
            <th>物料</th>
            <th>变更类型</th>
            <th>状态</th>
            <th>登记人</th>
            <th>审核主管</th>
            <th>创建时间</th>
            <th>截止时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {#each orders as order}
            <tr>
              <td><strong>{order.order_no}</strong></td>
              <td>{order.title}</td>
              <td>
                <div>{order.material_code}</div>
                <div style="font-size:12px;color:#6b7280">{order.material_name}</div>
              </td>
              <td>{order.change_type}</td>
              <td>
                <span class="badge" style="background:{STATUS_COLORS[order.status]}">
                  {#if order.is_overdue}⚠️ {/if}
                  {STATUS_LABELS[order.status]}
                </span>
              </td>
              <td>{order.registrar}</td>
              <td>{order.supervisor || '-'}</td>
              <td>{formatDate(order.created_at)}</td>
              <td style="color:{order.deadline && new Date(order.deadline) < new Date() ? '#dc2626' : ''}">
                {formatDate(order.deadline)}
              </td>
              <td>
                <button class="btn-sm" on:click={() => viewDetail(order)}>查看详情</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

{#if showCreateModal}
  <div class="modal-backdrop" on:click|self={() => showCreateModal = false}>
    <div class="modal">
      <div class="modal-header">
        新建物料变更单
        <button class="link-btn" on:click={() => showCreateModal = false}>✕</button>
      </div>
      <div class="modal-body">
        {#if errorMsg}
          <div class="alert alert-danger">{errorMsg}</div>
        {/if}
        <div class="form-row">
          <div class="form-item">
            <label>变更单号 *</label>
            <input type="text" bind:value={createForm.order_no} placeholder="例：MCO-2026-0001" />
          </div>
          <div class="form-item">
            <label>变更类型 *</label>
            <input type="text" bind:value={createForm.change_type} placeholder="例：参数变更/封装变更/型号替换" />
          </div>
        </div>
        <div class="form-item">
          <label>标题 *</label>
          <input type="text" bind:value={createForm.title} placeholder="简要说明变更内容" />
        </div>
        <div class="form-row">
          <div class="form-item">
            <label>物料编码 *</label>
            <input type="text" bind:value={createForm.material_code} />
          </div>
          <div class="form-item">
            <label>物料名称 *</label>
            <input type="text" bind:value={createForm.material_name} />
          </div>
        </div>
        <div class="form-item">
          <label>变更说明 *</label>
          <textarea bind:value={createForm.description} placeholder="详细说明变更原因、内容、影响范围"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button on:click={() => showCreateModal = false}>取消</button>
        <button class="btn-primary" on:click={createOrder}>创建（草稿）</button>
      </div>
    </div>
  </div>
{/if}
