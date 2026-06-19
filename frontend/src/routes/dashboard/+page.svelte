<script>
	import { onMount, onDestroy } from 'svelte';
	import { api } from '$lib/api';
	import { auth, statusNames, statusColors, roleNames, evidenceTypeNames } from '$lib/store';
	import { goto } from '$app/navigation';

	let todoList = [];
	let allPlans = [];
	let selectedPlan = null;
	let selectedPlanDetail = null;
	let selectedIds = new Set();
	let loading = true;
	let detailLoading = false;
	let batchLoading = false;
	let currentTab = 'todo';
	let statusFilter = '';
	let batchAction = '';
	let batchRemark = '';
	let showBatchModal = false;
	let batchResult = null;
	let errorMessage = '';

	const statusOptions = [
		{ value: '', label: '全部状态' },
		{ value: 'draft', label: '草稿' },
		{ value: 'pending_audit', label: '待审核' },
		{ value: 'audit_approved', label: '审核通过' },
		{ value: 'audit_rejected', label: '审核驳回' },
		{ value: 'pending_review', label: '待复核' },
		{ value: 'review_approved', label: '复核通过' },
		{ value: 'review_rejected', label: '复核驳回' },
		{ value: 'archived', label: '已归档' }
	];

	async function loadTodoList() {
		try {
			const data = await api.getTodoList();
			todoList = data;
		} catch (e) {
			console.error('加载待办列表失败:', e);
		}
	}

	async function loadAllPlans() {
		try {
			const url = statusFilter ? `/plans?status=${statusFilter}` : '/plans';
			const data = await api.listPlans(statusFilter);
			allPlans = data;
		} catch (e) {
			console.error('加载计划单列表失败:', e);
		}
	}

	async function loadPlanDetail(id) {
		detailLoading = true;
		selectedPlanDetail = null;
		try {
			const data = await api.getPlan(id);
			selectedPlanDetail = data;
		} catch (e) {
			errorMessage = e.message;
		} finally {
			detailLoading = false;
		}
	}

	function selectPlan(plan) {
		selectedPlan = plan;
		loadPlanDetail(plan.id);
	}

	function toggleSelect(id) {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	}

	function toggleSelectAll() {
		const currentList = currentTab === 'todo' ? todoList : allPlans;
		if (selectedIds.size === currentList.length) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(currentList.map(p => p.id));
		}
	}

	function openBatchModal(action) {
		batchAction = action;
		batchRemark = '';
		batchResult = null;
		showBatchModal = true;
	}

	function closeBatchModal() {
		showBatchModal = false;
		batchResult = null;
	}

	async function executeBatch() {
		if (selectedIds.size === 0) return;

		batchLoading = true;
		errorMessage = '';

		try {
			const result = await api.batchReview({
				plan_ids: Array.from(selectedIds),
				action: batchAction,
				remark: batchRemark || null
			});
			batchResult = result;

			await loadTodoList();
			await loadAllPlans();

			selectedIds = new Set();
			if (selectedPlan) {
				const stillExists = todoList.find(p => p.id === selectedPlan.id) ||
					allPlans.find(p => p.id === selectedPlan.id);
				if (stillExists) {
					selectedPlan = stillExists;
					await loadPlanDetail(selectedPlan.id);
				} else {
					selectedPlan = null;
					selectedPlanDetail = null;
				}
			}
		} catch (e) {
			errorMessage = e.message;
		} finally {
			batchLoading = false;
		}
	}

	function getActionLabel(action) {
		const labels = {
			submit: '批量提交',
			approve: '批量审核通过',
			reject: '批量审核驳回',
			review: '批量复核通过'
		};
		return labels[action] || action;
	}

	function canBatchSubmit() {
		return $auth.user?.role === 'registrar' && selectedIds.size > 0;
	}

	function canBatchApprove() {
		return $auth.user?.role === 'auditor' && selectedIds.size > 0;
	}

	function canBatchReview() {
		return $auth.user?.role === 'reviewer' && selectedIds.size > 0;
	}

	function goToDetail(id) {
		goto(`/plans/${id}`);
	}

	function formatDate(dateStr) {
		if (!dateStr) return '-';
		try {
			const d = new Date(dateStr);
			return d.toLocaleString('zh-CN', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return dateStr;
		}
	}

	async function refreshAll() {
		loading = true;
		await Promise.all([loadTodoList(), loadAllPlans()]);
		loading = false;
	}

	onMount(async () => {
		if (!$auth.token) {
			goto('/');
			return;
		}
		await refreshAll();
	});
</script>

<div class="dashboard">
	<div class="dashboard-header">
		<div class="tabs">
			<button
				class={`tab-btn ${currentTab === 'todo' ? 'active' : ''}`}
				on:click={() => { currentTab = 'todo'; selectedPlan = null; selectedPlanDetail = null; }}
			>
				📋 待办事项
				{#if todoList.length > 0}
					<span class="badge">{todoList.length}</span>
				{/if}
			</button>
			<button
				class={`tab-btn ${currentTab === 'all' ? 'active' : ''}`}
				on:click={() => { currentTab = 'all'; selectedPlan = null; selectedPlanDetail = null; }}
			>
				📁 全部计划单
			</button>
		</div>

		<div class="header-actions">
			{#if currentTab === 'all'}
				<select bind:value={statusFilter} on:change={loadAllPlans} class="filter-select">
					{#each statusOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			{/if}

			<button class="refresh-btn" on:click={refreshAll}>🔄 刷新</button>
		</div>
	</div>

	{#if canBatchSubmit() || canBatchApprove() || canBatchReview()}
		<div class="batch-toolbar">
			<span class="selected-count">已选择 {selectedIds.size} 项</span>
			<div class="batch-actions">
				{#if $auth.user?.role === 'registrar'}
					<button class="batch-btn submit" on:click={() => openBatchModal('submit')}>
						📤 批量提交审核
					</button>
				{/if}
				{#if $auth.user?.role === 'auditor'}
					<button class="batch-btn approve" on:click={() => openBatchModal('approve')}>
						✅ 批量审核通过
					</button>
					<button class="batch-btn reject" on:click={() => openBatchModal('reject')}>
						❌ 批量审核驳回
					</button>
				{/if}
				{#if $auth.user?.role === 'reviewer'}
					<button class="batch-btn review" on:click={() => openBatchModal('review')}>
						📝 批量复核通过
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<div class="dashboard-content">
		<div class="plan-list-panel">
			<div class="panel-header">
				<label class="select-all">
					<input
						type="checkbox"
						checked={selectedIds.size > 0 && selectedIds.size === (currentTab === 'todo' ? todoList.length : allPlans.length)}
						on:change={toggleSelectAll}
					/>
					全选
				</label>
				<span class="list-count">
					共 {currentTab === 'todo' ? todoList.length : allPlans.length} 条
				</span>
			</div>

			{#if loading}
				<div class="loading">加载中...</div>
			{:else}
				<div class="plan-list">
					{#each (currentTab === 'todo' ? todoList : allPlans) as plan (plan.id)}
						<div
							class={`plan-item ${selectedPlan?.id === plan.id ? 'selected' : ''}`}
							on:click={() => selectPlan(plan)}
						>
							<div class="item-checkbox" on:click|stopPropagation={() => toggleSelect(plan.id)}>
								<input
									type="checkbox"
									checked={selectedIds.has(plan.id)}
									on:change={() => {}}
								/>
							</div>
							<div class="item-content">
								<div class="item-header">
									<span class="plan-no">{plan.plan_no}</span>
									<span
										class="status-badge"
										style="background: {statusColors[plan.status]}20; color: {statusColors[plan.status]}"
									>
										{statusNames[plan.status]}
									</span>
								</div>
								<div class="item-title">{plan.title}</div>
								<div class="item-meta">
									<span>👤 {plan.client_name}</span>
									<span>📌 v{plan.version}</span>
								</div>
								<div class="item-time">更新于 {formatDate(plan.updated_at)}</div>
							</div>
						</div>
					{:else}
						<div class="empty-state">
							<div class="empty-icon">📭</div>
							<p>暂无数据</p>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="detail-panel">
			{#if !selectedPlan}
				<div class="detail-placeholder">
					<div class="placeholder-icon">👈</div>
					<p>请从左侧选择一条计划单查看详情</p>
				</div>
			{:else if detailLoading}
				<div class="loading">加载详情中...</div>
			{:else if selectedPlanDetail}
				<div class="detail-content">
					<div class="detail-header">
						<div>
							<h2>{selectedPlanDetail.plan.title}</h2>
							<div class="detail-meta">
								<span class="plan-no">{selectedPlanDetail.plan.plan_no}</span>
								<span
									class="status-badge large"
									style="background: {statusColors[selectedPlanDetail.plan.status]}20; color: {statusColors[selectedPlanDetail.plan.status]}"
								>
									{statusNames[selectedPlanDetail.plan.status]}
								</span>
							</div>
						</div>
						<button class="detail-btn" on:click={() => goToDetail(selectedPlanDetail.plan.id)}>
							进入办理 →
						</button>
					</div>

					<div class="detail-section">
						<h3>📊 媒介排期</h3>
						<div class="evidence-list">
							{#each selectedPlanDetail.schedules as sched (sched.id)}
								<div class="evidence-item">
									<div class="evidence-title">{sched.media_name}</div>
									<div class="evidence-desc">
										{sched.ad_position} · {sched.start_date} ~ {sched.end_date}
									</div>
									<div class="evidence-sub">频次: {sched.frequency}</div>
								</div>
							{:else}
								<p class="empty-text">暂无排期数据</p>
							{/each}
						</div>
					</div>

					<div class="detail-section">
						<h3>💰 预算核对</h3>
						<div class="budget-summary">
							<span class="budget-total">
								总计: ¥{selectedPlanDetail.budgets.reduce((sum, b) => sum + b.amount, 0).toLocaleString()}
							</span>
						</div>
						<div class="budget-list">
							{#each selectedPlanDetail.budgets as budget (budget.id)}
								<div class="budget-item">
									<span>{budget.item_name}</span>
									<span class="budget-amount">¥{budget.amount.toLocaleString()}</span>
								</div>
							{:else}
								<p class="empty-text">暂无预算数据</p>
							{/each}
						</div>
					</div>

					<div class="detail-section">
						<h3>📎 关键证据</h3>
						<div class="evidence-list">
							{#each selectedPlanDetail.evidences as ev (ev.id)}
								<div class="evidence-item">
									<div class="evidence-icon">📄</div>
									<div class="evidence-info">
										<div class="evidence-title">{ev.name}</div>
										<div class="evidence-type">{evidenceTypeNames[ev.evidence_type] || ev.evidence_type}</div>
									</div>
								</div>
							{:else}
								<p class="empty-text warning">⚠️ 暂无证据材料</p>
							{/each}
						</div>
					</div>

					<div class="detail-footer">
						<div class="footer-info">
							<div>创建人: {selectedPlanDetail.created_by_name}</div>
							<div>版本: v{selectedPlanDetail.plan.version}</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>

	{#if showBatchModal}
		<div class="modal-overlay" on:click={closeBatchModal}>
			<div class="modal" on:click|stopPropagation>
				<div class="modal-header">
					<h3>{getActionLabel(batchAction)}</h3>
					<button class="close-btn" on:click={closeBatchModal}>✕</button>
				</div>

				{#if !batchResult}
					<div class="modal-body">
						<p>确认对 <strong>{selectedIds.size}</strong> 条计划单执行此操作？</p>

						{#if batchAction === 'reject'}
							<div class="form-group">
								<label>驳回原因</label>
								<textarea bind:value={batchRemark} rows="3" placeholder="请输入驳回原因"></textarea>
							</div>
						{:else}
							<div class="form-group">
								<label>备注（可选）</label>
								<textarea bind:value={batchRemark} rows="2" placeholder="请输入备注信息"></textarea>
							</div>
						{/if}

						{#if errorMessage}
							<div class="error-message">{errorMessage}</div>
						{/if}
					</div>

					<div class="modal-footer">
						<button class="btn secondary" on:click={closeBatchModal}>取消</button>
						<button class="btn primary" on:click={executeBatch} disabled={batchLoading}>
							{batchLoading ? '处理中...' : '确认执行'}
						</button>
					</div>
				{:else}
					<div class="modal-body">
						<div class="batch-summary">
							<div class="summary-item success">
								<span class="count">{batchResult.success}</span>
								<span class="label">成功</span>
							</div>
							<div class="summary-item failed">
								<span class="count">{batchResult.failed}</span>
								<span class="label">失败</span>
							</div>
							<div class="summary-item retry">
								<span class="count">{batchResult.need_retry}</span>
								<span class="label">需重试</span>
							</div>
						</div>

						<div class="batch-results">
							<h4>详细结果</h4>
							<div class="result-list">
								{#each batchResult.results as item (item.plan_id)}
									<div class={`result-item ${item.success ? 'success' : item.need_retry ? 'retry' : 'failed'}`}>
										<div class="result-header">
											<span class="result-icon">
												{#if item.success}✅
												{:else if item.need_retry}🔄
												{:else}❌{/if}
											</span>
											<span class="result-no">{item.plan_no}</span>
											<span class="result-status">{statusNames[item.status] || item.status}</span>
										</div>
										<div class="result-message">{item.message}</div>
									</div>
								{/each}
							</div>
						</div>
					</div>

					<div class="modal-footer">
						<button class="btn primary" on:click={closeBatchModal}>
							完成
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.dashboard {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 100px);
	}

	.dashboard-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.tabs {
		display: flex;
		gap: 8px;
	}

	.tab-btn {
		padding: 10px 20px;
		border: none;
		background: white;
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		color: #64748b;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.2s;
	}

	.tab-btn:hover {
		background: #f8fafc;
	}

	.tab-btn.active {
		background: #2563eb;
		color: white;
	}

	.badge {
		background: rgba(255, 255, 255, 0.2);
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 12px;
	}

	.header-actions {
		display: flex;
		gap: 10px;
		align-items: center;
	}

	.filter-select {
		padding: 8px 12px;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		font-size: 13px;
		background: white;
	}

	.refresh-btn {
		padding: 8px 16px;
		background: white;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		cursor: pointer;
		font-size: 13px;
	}

	.refresh-btn:hover {
		background: #f8fafc;
	}

	.batch-toolbar {
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 8px;
		padding: 12px 16px;
		margin-bottom: 16px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.selected-count {
		font-size: 14px;
		color: #1e40af;
		font-weight: 500;
	}

	.batch-actions {
		display: flex;
		gap: 8px;
	}

	.batch-btn {
		padding: 8px 16px;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		transition: all 0.2s;
	}

	.batch-btn.submit {
		background: #3b82f6;
		color: white;
	}

	.batch-btn.approve {
		background: #10b981;
		color: white;
	}

	.batch-btn.reject {
		background: #ef4444;
		color: white;
	}

	.batch-btn.review {
		background: #8b5cf6;
		color: white;
	}

	.batch-btn:hover {
		opacity: 0.9;
		transform: translateY(-1px);
	}

	.dashboard-content {
		display: flex;
		gap: 16px;
		flex: 1;
		min-height: 0;
	}

	.plan-list-panel {
		width: 380px;
		background: white;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.panel-header {
		padding: 14px 16px;
		border-bottom: 1px solid #e2e8f0;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.select-all {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: #475569;
		cursor: pointer;
	}

	.list-count {
		font-size: 12px;
		color: #94a3b8;
	}

	.plan-list {
		flex: 1;
		overflow-y: auto;
	}

	.plan-item {
		display: flex;
		gap: 12px;
		padding: 14px 16px;
		border-bottom: 1px solid #f1f5f9;
		cursor: pointer;
		transition: background 0.15s;
	}

	.plan-item:hover {
		background: #f8fafc;
	}

	.plan-item.selected {
		background: #eff6ff;
		border-left: 3px solid #2563eb;
	}

	.item-checkbox {
		flex-shrink: 0;
		padding-top: 2px;
	}

	.item-content {
		flex: 1;
		min-width: 0;
	}

	.item-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
	}

	.plan-no {
		font-size: 12px;
		color: #64748b;
		font-family: monospace;
	}

	.status-badge {
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 500;
	}

	.status-badge.large {
		padding: 4px 10px;
		font-size: 12px;
	}

	.item-title {
		font-size: 14px;
		font-weight: 500;
		color: #1e293b;
		margin-bottom: 6px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-meta {
		display: flex;
		gap: 12px;
		font-size: 12px;
		color: #64748b;
		margin-bottom: 4px;
	}

	.item-time {
		font-size: 11px;
		color: #94a3b8;
	}

	.detail-panel {
		flex: 1;
		background: white;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		overflow-y: auto;
	}

	.detail-placeholder {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: #94a3b8;
	}

	.placeholder-icon {
		font-size: 48px;
		margin-bottom: 16px;
	}

	.loading {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #64748b;
	}

	.detail-content {
		padding: 24px;
	}

	.detail-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 24px;
		padding-bottom: 20px;
		border-bottom: 1px solid #e2e8f0;
	}

	.detail-header h2 {
		margin: 0 0 8px 0;
		font-size: 20px;
		color: #1e293b;
	}

	.detail-meta {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.detail-btn {
		padding: 10px 20px;
		background: #2563eb;
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
	}

	.detail-btn:hover {
		background: #1d4ed8;
	}

	.detail-section {
		margin-bottom: 24px;
	}

	.detail-section h3 {
		margin: 0 0 12px 0;
		font-size: 15px;
		color: #334155;
		font-weight: 600;
	}

	.evidence-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.evidence-item {
		display: flex;
		gap: 12px;
		padding: 12px;
		background: #f8fafc;
		border-radius: 8px;
		align-items: center;
	}

	.evidence-icon {
		font-size: 24px;
	}

	.evidence-info {
		flex: 1;
	}

	.evidence-title {
		font-size: 14px;
		color: #1e293b;
		font-weight: 500;
		margin-bottom: 2px;
	}

	.evidence-desc {
		font-size: 13px;
		color: #64748b;
		margin-bottom: 4px;
	}

	.evidence-type {
		font-size: 12px;
		color: #94a3b8;
	}

	.evidence-sub {
		font-size: 12px;
		color: #94a3b8;
	}

	.budget-summary {
		margin-bottom: 12px;
	}

	.budget-total {
		font-size: 18px;
		font-weight: 600;
		color: #059669;
	}

	.budget-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.budget-item {
		display: flex;
		justify-content: space-between;
		padding: 10px 12px;
		background: #f8fafc;
		border-radius: 6px;
		font-size: 13px;
	}

	.budget-amount {
		font-weight: 500;
		color: #059669;
	}

	.empty-state {
		padding: 40px 20px;
		text-align: center;
		color: #94a3b8;
	}

	.empty-icon {
		font-size: 36px;
		margin-bottom: 8px;
	}

	.empty-text {
		color: #94a3b8;
		font-size: 13px;
	}

	.empty-text.warning {
		color: #f59e0b;
	}

	.detail-footer {
		margin-top: 24px;
		padding-top: 16px;
		border-top: 1px solid #e2e8f0;
	}

	.footer-info {
		display: flex;
		gap: 24px;
		font-size: 13px;
		color: #64748b;
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: white;
		border-radius: 12px;
		width: 100%;
		max-width: 560px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		padding: 16px 20px;
		border-bottom: 1px solid #e2e8f0;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-header h3 {
		margin: 0;
		font-size: 16px;
		color: #1e293b;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 20px;
		cursor: pointer;
		color: #94a3b8;
	}

	.modal-body {
		padding: 20px;
		overflow-y: auto;
		flex: 1;
	}

	.form-group {
		margin-top: 16px;
	}

	.form-group label {
		display: block;
		margin-bottom: 6px;
		font-size: 13px;
		color: #475569;
		font-weight: 500;
	}

	.form-group textarea {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		font-size: 14px;
		font-family: inherit;
		resize: vertical;
	}

	.error-message {
		margin-top: 12px;
		padding: 10px 14px;
		background: #fef2f2;
		color: #dc2626;
		border-radius: 8px;
		font-size: 13px;
		border: 1px solid #fecaca;
	}

	.modal-footer {
		padding: 16px 20px;
		border-top: 1px solid #e2e8f0;
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}

	.btn {
		padding: 10px 20px;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
	}

	.btn.primary {
		background: #2563eb;
		color: white;
	}

	.btn.secondary {
		background: #f1f5f9;
		color: #475569;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.batch-summary {
		display: flex;
		gap: 16px;
		margin-bottom: 20px;
	}

	.summary-item {
		flex: 1;
		padding: 16px;
		border-radius: 8px;
		text-align: center;
	}

	.summary-item.success {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
	}

	.summary-item.failed {
		background: #fef2f2;
		border: 1px solid #fecaca;
	}

	.summary-item.retry {
		background: #fffbeb;
		border: 1px solid #fde68a;
	}

	.summary-item .count {
		display: block;
		font-size: 24px;
		font-weight: 600;
		margin-bottom: 4px;
	}

	.summary-item.success .count { color: #16a34a; }
	.summary-item.failed .count { color: #dc2626; }
	.summary-item.retry .count { color: #d97706; }

	.summary-item .label {
		font-size: 13px;
		color: #64748b;
	}

	.batch-results h4 {
		margin: 0 0 12px 0;
		font-size: 14px;
		color: #334155;
	}

	.result-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 300px;
		overflow-y: auto;
	}

	.result-item {
		padding: 12px;
		border-radius: 8px;
		border-left: 3px solid;
	}

	.result-item.success {
		background: #f0fdf4;
		border-color: #22c55e;
	}

	.result-item.failed {
		background: #fef2f2;
		border-color: #ef4444;
	}

	.result-item.retry {
		background: #fffbeb;
		border-color: #f59e0b;
	}

	.result-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}

	.result-icon {
		font-size: 16px;
	}

	.result-no {
		font-size: 13px;
		font-weight: 500;
		color: #1e293b;
		font-family: monospace;
	}

	.result-status {
		font-size: 11px;
		padding: 2px 6px;
		background: white;
		border-radius: 4px;
		color: #64748b;
	}

	.result-message {
		font-size: 12px;
		color: #475569;
		padding-left: 24px;
	}
</style>
