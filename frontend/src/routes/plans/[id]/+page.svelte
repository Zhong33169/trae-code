<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import { auth, statusNames, statusColors, evidenceTypeNames, roleNames, operationNames, operationColors } from '$lib/store';

	let planId = $page.params.id ?? '';
	let planDetail = null;
	let loading = true;
	let error = '';
	let actionLoading = false;
	let showRejectModal = false;
	let rejectReason = '';
	let showRemarkModal = false;
	let remarkText = '';
	let currentAction = '';
	let logStatusFilter = '';
	let logOperationFilter = '';

	$effect(() => {
		planId = $page.params.id ?? '';
		if (planId && $auth.token) {
			loadDetail();
		}
	});

	async function loadDetail() {
		loading = true;
		error = '';
		try {
			const data = await api.getPlan(planId);
			planDetail = data;
		} catch (e) {
			error = e.message;
		} finally {
			loading = false;
		}
	}

	function canSubmit() {
		if (!$auth.user || !planDetail) return false;
		return $auth.user.role === 'registrar' &&
			planDetail.plan.created_by === $auth.user.id &&
			(planDetail.plan.status === 'draft' || planDetail.plan.status === 'audit_rejected');
	}

	function canEdit() {
		if (!$auth.user || !planDetail) return false;
		return $auth.user.role === 'registrar' &&
			planDetail.plan.created_by === $auth.user.id &&
			(planDetail.plan.status === 'draft' || planDetail.plan.status === 'audit_rejected');
	}

	function canApprove() {
		if (!$auth.user || !planDetail) return false;
		return $auth.user.role === 'auditor' &&
			(planDetail.plan.status === 'pending_audit' || planDetail.plan.status === 'review_rejected');
	}

	function canReject() {
		if (!$auth.user || !planDetail) return false;
		return $auth.user.role === 'auditor' &&
			(planDetail.plan.status === 'pending_audit' || planDetail.plan.status === 'review_rejected');
	}

	function canReview() {
		if (!$auth.user || !planDetail) return false;
		return $auth.user.role === 'reviewer' && planDetail.plan.status === 'pending_review';
	}

	function canArchive() {
		if (!$auth.user || !planDetail) return false;
		return $auth.user.role === 'reviewer' && planDetail.plan.status === 'review_approved';
	}

	async function handleSubmit() {
		actionLoading = true;
		error = '';
		try {
			await api.submitPlan(planId, planDetail.plan.version);
			await loadDetail();
		} catch (e) {
			error = e.message;
		} finally {
			actionLoading = false;
		}
	}

	function openApproveModal() {
		currentAction = 'approve';
		remarkText = '';
		showRemarkModal = true;
	}

	async function handleApprove() {
		actionLoading = true;
		error = '';
		try {
			await api.approvePlan(planId, {
				version: planDetail.plan.version,
				remark: remarkText || null
			});

			await api.reviewPlan(planId, {
				version: planDetail.plan.version + 1,
				remark: '自动送复核'
			}).catch(() => {});

			await loadDetail();
			showRemarkModal = false;
		} catch (e) {
			error = e.message;
		} finally {
			actionLoading = false;
		}
	}

	function openRejectModal() {
		rejectReason = '';
		showRejectModal = true;
	}

	async function handleReject() {
		if (!rejectReason.trim()) {
			error = '请输入驳回原因';
			return;
		}
		actionLoading = true;
		error = '';
		try {
			await api.rejectPlan(planId, {
				version: planDetail.plan.version,
				reason: rejectReason
			});
			await loadDetail();
			showRejectModal = false;
		} catch (e) {
			error = e.message;
		} finally {
			actionLoading = false;
		}
	}

	function openReviewModal() {
		currentAction = 'review';
		remarkText = '';
		showRemarkModal = true;
	}

	async function handleReview() {
		actionLoading = true;
		error = '';
		try {
			await api.reviewPlan(planId, {
				version: planDetail.plan.version,
				remark: remarkText || null
			});
			await loadDetail();
			showRemarkModal = false;
		} catch (e) {
			error = e.message;
		} finally {
			actionLoading = false;
		}
	}

	async function handleArchive() {
		if (!confirm('确认归档此计划单吗？归档后不可修改。')) return;
		actionLoading = true;
		error = '';
		try {
			await api.archivePlan(planId, planDetail.plan.version);
			await loadDetail();
		} catch (e) {
			error = e.message;
		} finally {
			actionLoading = false;
		}
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
				minute: '2-digit',
				second: '2-digit'
			});
		} catch {
			return dateStr;
		}
	}

	function getBatchResultLabel(op) {
		if (op.endsWith('_failed')) return '❌ 失败';
		if (op.endsWith('_retry')) return '🔄 需重试';
		return '✅ 成功';
	}

	function getBatchResultClass(op) {
		if (op.endsWith('_failed')) return 'failed';
		if (op.endsWith('_retry')) return 'retry';
		return 'success';
	}

	const filteredLogs = $derived((() => {
		if (!planDetail?.operation_logs) return [];
		return planDetail.operation_logs.filter(log => {
			if (logStatusFilter === 'success' && (log.operation.endsWith('_failed') || log.operation.endsWith('_retry'))) return false;
			if (logStatusFilter === 'failed' && !log.operation.endsWith('_failed')) return false;
			if (logStatusFilter === 'retry' && !log.operation.endsWith('_retry')) return false;
			if (logStatusFilter === 'abnormal' && !log.operation.endsWith('_failed') && !log.operation.endsWith('_retry')) return false;
			if (logOperationFilter === 'batch' && !log.operation.startsWith('batch_')) return false;
			if (logOperationFilter === 'normal' && log.operation.startsWith('batch_')) return false;
			return true;
		});
	})());

	const retryLogs = $derived(filteredLogs.filter(l => l.operation.endsWith('_retry')));
	const failedLogs = $derived(filteredLogs.filter(l => l.operation.endsWith('_failed')));

	function getLogHandleAction(log) {
		const msg = (log.remark || '').toLowerCase();
		if (msg.includes('证据') || msg.includes('材料')) {
			return { label: '📄 补充证据材料', enabled: canSubmit() };
		}
		if (msg.includes('版本') || log.operation.endsWith('_retry')) {
			return { label: '🔄 刷新获取最新版本', enabled: true };
		}
		if (msg.includes('状态')) {
			return { label: 'ℹ️ 查看状态流转', enabled: true };
		}
		return null;
	}

	function handleLogAction(log) {
		const msg = log.remark || '';
		if (msg.includes('版本') || log.operation.endsWith('_retry')) {
			loadDetail();
		} else if (msg.includes('状态')) {
			document.querySelector('.info-card')?.scrollIntoView({ behavior: 'smooth' });
		}
	}

	function goBack() {
		goto('/dashboard?refresh=1');
	}

	function getTotalBudget() {
		if (!planDetail) return 0;
		return planDetail.budgets.reduce((sum, b) => sum + b.amount, 0);
	}

	onMount(() => {
		if (!$auth.token) {
			goto('/');
		}
	});
</script>

<div class="detail-page">
	<div class="page-header">
		<button class="back-btn" on:click={goBack}>← 返回</button>
		<h1>媒介计划单详情</h1>
	</div>

	{#if loading}
		<div class="loading">加载中...</div>
	{:else if error && !planDetail}
		<div class="error-state">
			<div class="error-icon">❌</div>
			<h3>加载失败</h3>
			<p>{error}</p>
			<button on:click={loadDetail}>重试</button>
		</div>
	{:else if planDetail}
		<div class="detail-container">
			<div class="main-section">
				<div class="info-card">
					<div class="card-header">
						<h2>基本信息</h2>
						<span
							class="status-badge large"
							style="background: {statusColors[planDetail.plan.status]}20; color: {statusColors[planDetail.plan.status]}"
						>
							{statusNames[planDetail.plan.status]}
						</span>
					</div>

					<div class="info-grid">
						<div class="info-item">
							<label>计划单编号</label>
							<span class="value mono">{planDetail.plan.plan_no}</span>
						</div>
						<div class="info-item">
							<label>当前版本</label>
							<span class="value">v{planDetail.plan.version}</span>
						</div>
						<div class="info-item full">
							<label>计划标题</label>
							<span class="value">{planDetail.plan.title}</span>
						</div>
						<div class="info-item">
							<label>客户名称</label>
							<span class="value">{planDetail.plan.client_name}</span>
						</div>
						<div class="info-item">
							<label>创建人</label>
							<span class="value">{planDetail.created_by_name}</span>
						</div>
						<div class="info-item">
							<label>创建时间</label>
							<span class="value">{formatDate(planDetail.plan.created_at)}</span>
						</div>
						<div class="info-item">
							<label>更新时间</label>
							<span class="value">{formatDate(planDetail.plan.updated_at)}</span>
						</div>
						<div class="info-item full">
							<label>备注</label>
							<span class="value">{planDetail.plan.remark || '无'}</span>
						</div>
					</div>

					{#if planDetail.plan.reject_reason}
						<div class="reject-reason">
							<div class="reason-label">⚠️ 驳回原因</div>
							<div class="reason-text">{planDetail.plan.reject_reason}</div>
						</div>
					{/if}
				</div>

				<div class="info-card">
					<div class="card-header">
						<h2>📊 媒介排期</h2>
						<span class="count-badge">{planDetail.schedules.length} 项</span>
					</div>
					<div class="schedule-table">
						<table>
							<thead>
								<tr>
									<th>媒体名称</th>
									<th>广告位置</th>
									<th>开始日期</th>
									<th>结束日期</th>
									<th>投放频次</th>
								</tr>
							</thead>
							<tbody>
								{#each planDetail.schedules as sched (sched.id)}
									<tr>
										<td>{sched.media_name}</td>
										<td>{sched.ad_position}</td>
										<td>{sched.start_date}</td>
										<td>{sched.end_date}</td>
										<td>{sched.frequency}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>

				<div class="info-card">
					<div class="card-header">
						<h2>💰 预算明细</h2>
						<span class="total-budget">总计: ¥{getTotalBudget().toLocaleString()}</span>
					</div>
					<div class="budget-table">
						<table>
							<thead>
								<tr>
									<th>费用项目</th>
									<th>类别</th>
									<th class="amount-col">金额</th>
								</tr>
							</thead>
							<tbody>
								{#each planDetail.budgets as budget (budget.id)}
									<tr>
										<td>{budget.item_name}</td>
										<td><span class="category-tag">{budget.category}</span></td>
										<td class="amount-col">¥{budget.amount.toLocaleString()}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>

				<div class="info-card">
					<div class="card-header">
						<h2>📎 证据材料</h2>
						<span class="count-badge">{planDetail.evidences.length} 份</span>
					</div>
					{#if planDetail.evidences.length === 0}
						<div class="empty-evidence">
							<span class="warning-icon">⚠️</span>
							<span>暂无证据材料，提交前请上传相关证据</span>
						</div>
					{:else}
						<div class="evidence-grid">
							{#each planDetail.evidences as ev (ev.id)}
								<div class="evidence-card">
									<div class="ev-icon">📄</div>
									<div class="ev-info">
										<div class="ev-name">{ev.name}</div>
										<div class="ev-type">{evidenceTypeNames[ev.evidence_type] || ev.evidence_type}</div>
										<div class="ev-time">上传于 {formatDate(ev.uploaded_at)}</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="info-card">
					<div class="card-header">
						<h2>📋 办理记录</h2>
						<span class="count-badge">
							{filteredLogs.length} 条
							{#if retryLogs.length > 0}
								<span class="warn-pill">🔄 {retryLogs.length} 需处理</span>
							{/if}
							{#if failedLogs.length > 0}
								<span class="fail-pill">❌ {failedLogs.length} 失败</span>
							{/if}
						</span>
					</div>

					<div class="log-filters">
						<select bind:value={logOperationFilter} class="filter-select small">
							<option value="">全部操作</option>
							<option value="batch">批量操作</option>
							<option value="normal">单条操作</option>
						</select>
						<select bind:value={logStatusFilter} class="filter-select small">
							<option value="">全部结果</option>
							<option value="success">✅ 成功</option>
							<option value="abnormal">⚠️ 异常（失败+重试）</option>
							<option value="failed">❌ 失败</option>
							<option value="retry">🔄 需重试</option>
						</select>
					</div>

					<div class="audit-timeline">
						{#each filteredLogs as log (log.id)}
							<div class="audit-item">
								<div
									class="audit-dot"
									style="background: {operationColors[log.operation] || '#94a3b8'}"
								></div>
								<div class="audit-content">
									<div class="audit-header">
										<span class="audit-op" style="color: {operationColors[log.operation] || '#64748b'}">
											{operationNames[log.operation] || log.operation}
										</span>
										{#if log.operation.startsWith('batch_')}
											<span class={`op-result ${getBatchResultClass(log.operation)}`}>
												{getBatchResultLabel(log.operation)}
											</span>
										{/if}
										<span class="audit-operator">{log.operator_name}</span>
									</div>
									<div class="audit-status">
										{#if log.old_status && log.new_status && log.old_status !== log.new_status}
											<span class="status-old">{statusNames[log.old_status] || log.old_status}</span>
											<span class="status-arrow">→</span>
											<span class="status-new">{statusNames[log.new_status] || log.new_status}</span>
										{/if}
										{#if log.old_status && log.new_status && log.old_status === log.new_status}
											<span class="status-same">状态未变更</span>
										{/if}
									</div>
									{#if log.remark}
										<div class="audit-remark">{log.remark}</div>
									{/if}
									{#if getLogHandleAction(log)}
										{@const action = getLogHandleAction(log)}
										<button
											class="log-handle-btn"
											class:disabled={!action.enabled}
											on:click={() => handleLogAction(log)}
											disabled={!action.enabled}
										>
											{action.label}
										</button>
									{/if}
									<div class="audit-time">{formatDate(log.created_at)}</div>
								</div>
							</div>
						{:else}
							<div class="empty-log">暂无办理记录</div>
						{/each}
					</div>
				</div>
			</div>

			<div class="side-section">
				<div class="action-card">
					<h3>办理操作</h3>

					{#if error}
						<div class="error-alert">
							<strong>操作失败</strong>
							<p>{error}</p>
						</div>
					{/if}

					<div class="action-buttons">
						{#if canSubmit()}
							<button class="action-btn primary" on:click={handleSubmit} disabled={actionLoading}>
								{actionLoading ? '提交中...' : '📤 提交审核'}
							</button>
						{/if}

						{#if canApprove()}
							<button class="action-btn success" on:click={openApproveModal} disabled={actionLoading}>
								✅ 审核通过
							</button>
						{/if}

						{#if canReject()}
							<button class="action-btn danger" on:click={openRejectModal} disabled={actionLoading}>
								❌ 审核驳回
							</button>
						{/if}

						{#if canReview()}
							<button class="action-btn primary" on:click={openReviewModal} disabled={actionLoading}>
								📝 复核通过
							</button>
						{/if}

						{#if canArchive()}
							<button class="action-btn secondary" on:click={handleArchive} disabled={actionLoading}>
								📦 归档
							</button>
						{/if}

						{#if !canSubmit() && !canApprove() && !canReject() && !canReview() && !canArchive()}
							<div class="no-action">
								<p>当前状态下您没有可执行的操作</p>
								<p class="hint">当前角色: {roleNames[$auth.user?.role]}</p>
							</div>
						{/if}
					</div>

					<div class="version-hint">
						<div class="hint-title">💡 提示</div>
						<ul>
							<li>每次操作会自动递增版本号</li>
							<li>如果版本不匹配请刷新页面</li>
							<li>提交前请确保已上传证据材料</li>
						</ul>
					</div>
				</div>

				<div class="timeline-card">
					<h3>流程节点</h3>
					<div class="timeline">
						<div class="timeline-item done">
							<div class="timeline-dot"></div>
							<div class="timeline-content">
								<div class="timeline-title">创建草稿</div>
								<div class="timeline-time">{formatDate(planDetail.plan.created_at)}</div>
							</div>
						</div>

						<div class={`timeline-item ${planDetail.plan.submitted_at ? 'done' : ''}`}>
							<div class="timeline-dot"></div>
							<div class="timeline-content">
								<div class="timeline-title">提交审核</div>
								<div class="timeline-time">{planDetail.plan.submitted_at ? formatDate(planDetail.plan.submitted_at) : '待处理'}</div>
							</div>
						</div>

						<div class={`timeline-item ${planDetail.plan.approved_at ? 'done' : ''}`}>
							<div class="timeline-dot"></div>
							<div class="timeline-content">
								<div class="timeline-title">主管审核</div>
								<div class="timeline-time">{planDetail.plan.approved_at ? formatDate(planDetail.plan.approved_at) : '待处理'}</div>
							</div>
						</div>

						<div class={`timeline-item ${planDetail.plan.reviewed_at ? 'done' : ''}`}>
							<div class="timeline-dot"></div>
							<div class="timeline-content">
								<div class="timeline-title">代理复核</div>
								<div class="timeline-time">{planDetail.plan.reviewed_at ? formatDate(planDetail.plan.reviewed_at) : '待处理'}</div>
							</div>
						</div>

						<div class={`timeline-item ${planDetail.plan.archived_at ? 'done' : ''}`}>
							<div class="timeline-dot"></div>
							<div class="timeline-content">
								<div class="timeline-title">归档完成</div>
								<div class="timeline-time">{planDetail.plan.archived_at ? formatDate(planDetail.plan.archived_at) : '待处理'}</div>
							</div>
						</div>
				 </div>
				</div>
			</div>
		</div>
	{/if}

	{#if showRejectModal}
		<div class="modal-overlay" on:click={() => { showRejectModal = false; }}>
			<div class="modal" on:click|stopPropagation>
				<div class="modal-header">
					<h3>审核驳回</h3>
					<button class="close-btn" on:click={() => { showRejectModal = false; }}>✕</button>
				</div>
				<div class="modal-body">
					<p>请填写驳回原因，登记员将收到驳回通知并进行修改。</p>
					<div class="form-group">
						<label>驳回原因</label>
						<textarea bind:value={rejectReason} rows="4" placeholder="请详细说明驳回原因..."></textarea>
					</div>
					{#if error}
						<div class="error-message">{error}</div>
					{/if}
				</div>
				<div class="modal-footer">
					<button class="btn secondary" on:click={() => { showRejectModal = false; }}>取消</button>
					<button class="btn danger" on:click={handleReject} disabled={actionLoading}>
						{actionLoading ? '处理中...' : '确认驳回'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if showRemarkModal}
		<div class="modal-overlay" on:click={() => { showRemarkModal = false; }}>
			<div class="modal" on:click|stopPropagation>
				<div class="modal-header">
					<h3>{currentAction === 'approve' ? '审核通过' : '复核通过'}</h3>
					<button class="close-btn" on:click={() => { showRemarkModal = false; }}>✕</button>
				</div>
				<div class="modal-body">
					<p>确认通过此计划单？</p>
					<div class="form-group">
						<label>备注（可选）</label>
						<textarea bind:value={remarkText} rows="3" placeholder="请输入备注信息..."></textarea>
					</div>
					{#if error}
						<div class="error-message">{error}</div>
					{/if}
				</div>
				<div class="modal-footer">
					<button class="btn secondary" on:click={() => { showRemarkModal = false; }}>取消</button>
					<button class="btn primary" on:click={currentAction === 'approve' ? handleApprove : handleReview} disabled={actionLoading}>
						{actionLoading ? '处理中...' : '确认通过'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.detail-page {
		max-width: 1200px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 20px;
	}

	.back-btn {
		padding: 8px 16px;
		background: white;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
	}

	.back-btn:hover {
		background: #f8fafc;
	}

	.page-header h1 {
		margin: 0;
		font-size: 22px;
		color: #1e293b;
	}

	.loading {
		text-align: center;
		padding: 60px;
		color: #64748b;
	}

	.error-state {
		text-align: center;
		padding: 60px;
	}

	.error-icon {
		font-size: 48px;
		margin-bottom: 16px;
	}

	.detail-container {
		display: flex;
		gap: 20px;
	}

	.main-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.side-section {
		width: 320px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.info-card {
		background: white;
		border-radius: 12px;
		padding: 20px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
		padding-bottom: 12px;
		border-bottom: 1px solid #e2e8f0;
	}

	.card-header h2 {
		margin: 0;
		font-size: 16px;
		color: #1e293b;
	}

	.status-badge.large {
		padding: 6px 12px;
		font-size: 13px;
		border-radius: 6px;
		font-weight: 500;
	}

	.count-badge {
		background: #f1f5f9;
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 12px;
		color: #64748b;
	}

	.total-budget {
		font-size: 15px;
		font-weight: 600;
		color: #059669;
	}

	.info-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.info-item.full {
		grid-column: 1 / -1;
	}

	.info-item label {
		display: block;
		font-size: 12px;
		color: #94a3b8;
		margin-bottom: 4px;
	}

	.info-item .value {
		font-size: 14px;
		color: #334155;
	}

	.info-item .value.mono {
		font-family: monospace;
	}

	.reject-reason {
		margin-top: 16px;
		padding: 12px 16px;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
	}

	.reason-label {
		font-size: 13px;
		font-weight: 500;
		color: #dc2626;
		margin-bottom: 4px;
	}

	.reason-text {
		font-size: 14px;
		color: #991b1b;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th, td {
		text-align: left;
		padding: 10px 12px;
		border-bottom: 1px solid #f1f5f9;
		font-size: 13px;
	}

	th {
		background: #f8fafc;
		font-weight: 500;
		color: #64748b;
		font-size: 12px;
	}

	.amount-col {
		text-align: right;
	}

	.category-tag {
		display: inline-block;
		padding: 2px 8px;
		background: #eff6ff;
		color: #2563eb;
		border-radius: 4px;
		font-size: 11px;
	}

	.empty-evidence {
		padding: 20px;
		text-align: center;
		background: #fffbeb;
		border: 1px dashed #fcd34d;
		border-radius: 8px;
		color: #92400e;
		font-size: 13px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.warning-icon {
		font-size: 18px;
	}

	.evidence-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 12px;
	}

	.evidence-card {
		display: flex;
		gap: 12px;
		padding: 12px;
		background: #f8fafc;
		border-radius: 8px;
		align-items: flex-start;
	}

	.ev-icon {
		font-size: 28px;
		flex-shrink: 0;
	}

	.ev-info {
		flex: 1;
		min-width: 0;
	}

	.ev-name {
		font-size: 13px;
		font-weight: 500;
		color: #1e293b;
		margin-bottom: 2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ev-type {
		font-size: 12px;
		color: #64748b;
		margin-bottom: 2px;
	}

	.ev-time {
		font-size: 11px;
		color: #94a3b8;
	}

	.action-card {
		background: white;
		border-radius: 12px;
		padding: 20px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.action-card h3 {
		margin: 0 0 16px 0;
		font-size: 16px;
		color: #1e293b;
	}

	.action-buttons {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.action-btn {
		width: 100%;
		padding: 12px;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s;
	}

	.action-btn.primary {
		background: #2563eb;
		color: white;
	}

	.action-btn.success {
		background: #10b981;
		color: white;
	}

	.action-btn.danger {
		background: #ef4444;
		color: white;
	}

	.action-btn.secondary {
		background: #f1f5f9;
		color: #475569;
	}

	.action-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.action-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.no-action {
		text-align: center;
		padding: 20px 0;
		color: #94a3b8;
	}

	.no-action p {
		margin: 4px 0;
		font-size: 13px;
	}

	.no-action .hint {
		font-size: 12px;
		color: #cbd5e1;
	}

	.error-alert {
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
		padding: 12px;
		margin-bottom: 16px;
	}

	.error-alert strong {
		color: #dc2626;
		font-size: 13px;
	}

	.error-alert p {
		margin: 4px 0 0 0;
		font-size: 12px;
		color: #991b1b;
	}

	.version-hint {
		margin-top: 20px;
		padding: 12px;
		background: #f8fafc;
		border-radius: 8px;
	}

	.hint-title {
		font-size: 13px;
		font-weight: 500;
		color: #475569;
		margin-bottom: 8px;
	}

	.version-hint ul {
		margin: 0;
		padding-left: 18px;
	}

	.version-hint li {
		font-size: 12px;
		color: #64748b;
		margin-bottom: 4px;
	}

	.timeline-card {
		background: white;
		border-radius: 12px;
		padding: 20px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.timeline-card h3 {
		margin: 0 0 16px 0;
		font-size: 16px;
		color: #1e293b;
	}

	.timeline {
		position: relative;
	}

	.timeline-item {
		display: flex;
		gap: 12px;
		padding-bottom: 20px;
		position: relative;
	}

	.timeline-item:not(:last-child)::after {
		content: '';
		position: absolute;
		left: 7px;
		top: 20px;
		bottom: 0;
		width: 2px;
		background: #e2e8f0;
	}

	.timeline-item.done:not(:last-child)::after {
		background: #22c55e;
	}

	.timeline-dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #cbd5e1;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.timeline-item.done .timeline-dot {
		background: #22c55e;
	}

	.timeline-content {
		flex: 1;
	}

	.timeline-title {
		font-size: 13px;
		font-weight: 500;
		color: #334155;
		margin-bottom: 2px;
	}

	.timeline-item.done .timeline-title {
		color: #166534;
	}

	.timeline-time {
		font-size: 11px;
		color: #94a3b8;
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
		max-width: 440px;
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
	}

	.form-group {
		margin-top: 12px;
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
		box-sizing: border-box;
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

	.btn.danger {
		background: #ef4444;
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

	.audit-timeline {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.audit-item {
		display: flex;
		gap: 12px;
		position: relative;
	}

	.audit-item:not(:last-child)::after {
		content: '';
		position: absolute;
		left: 6px;
		top: 20px;
		bottom: -8px;
		width: 2px;
		background: #e2e8f0;
	}

	.audit-dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		flex-shrink: 0;
		margin-top: 3px;
		box-shadow: 0 0 0 3px white, 0 0 0 4px #e2e8f0;
	}

	.audit-content {
		flex: 1;
		min-width: 0;
	}

	.audit-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.audit-op {
		font-size: 14px;
		font-weight: 600;
	}

	.audit-operator {
		font-size: 12px;
		color: #64748b;
	}

	.audit-status {
		font-size: 12px;
		color: #64748b;
		margin-bottom: 4px;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.status-old {
		color: #94a3b8;
	}

	.status-arrow {
		color: #cbd5e1;
	}

	.status-new {
		color: #10b981;
		font-weight: 500;
	}

	.status-same {
		color: #f59e0b;
	}

	.audit-remark {
		font-size: 12px;
		color: #475569;
		background: #f8fafc;
		padding: 6px 10px;
		border-radius: 6px;
		margin-bottom: 4px;
		line-height: 1.5;
	}

	.audit-time {
		font-size: 11px;
		color: #94a3b8;
	}

	.empty-log {
		text-align: center;
		padding: 30px;
		color: #94a3b8;
		font-size: 13px;
	}

	.op-result {
		font-size: 11px;
		padding: 2px 8px;
		border-radius: 10px;
		font-weight: 500;
		margin-left: 8px;
	}

	.op-result.success {
		background: #d1fae5;
		color: #059669;
	}

	.op-result.failed {
		background: #fee2e2;
		color: #dc2626;
	}

	.op-result.retry {
		background: #fef3c7;
		color: #d97706;
	}

	.warn-pill {
		background: #fef3c7;
		color: #92400e;
		font-size: 11px;
		padding: 2px 8px;
		border-radius: 10px;
		margin-left: 6px;
	}

	.fail-pill {
		background: #fee2e2;
		color: #991b1b;
		font-size: 11px;
		padding: 2px 8px;
		border-radius: 10px;
		margin-left: 6px;
	}

	.log-filters {
		display: flex;
		gap: 10px;
		margin-bottom: 16px;
		padding: 10px;
		background: #f8fafc;
		border-radius: 8px;
	}

	.filter-select.small {
		font-size: 12px;
		padding: 5px 10px;
	}

	.log-handle-btn {
		margin: 4px 0;
		padding: 5px 12px;
		font-size: 12px;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		background: #f59e0b;
		color: white;
		font-weight: 500;
		transition: background 0.2s;
	}

	.log-handle-btn:hover {
		background: #d97706;
	}

	.log-handle-btn.disabled,
	.log-handle-btn:disabled {
		background: #cbd5e1;
		cursor: not-allowed;
	}
</style>
