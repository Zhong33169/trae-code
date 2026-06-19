const state = {
    currentRole: '',
    currentUserID: '',
    currentUserName: '',
    currentPage: 'list',
    orders: [],
    totalOrders: 0,
    currentOrder: null,
    stats: null,
    knowledgeItems: [],
    selectedOrders: new Set(),
    filters: { status: '', is_overdue: '', keyword: '', page: 1, page_size: 10 },
    auditLogs: [],
    auditTotal: 0,
    auditFilters: { order_no: '', actor: '', action: '', start_date: '', end_date: '', page: 1, page_size: 10 }
};

function formatStatus(status) {
    const map = {
        pending_review: '待审核',
        pending_correction: '待补正',
        pending_final_review: '待复核',
        archived: '已归档'
    };
    return map[status] || status;
}

function formatAction(action) {
    const map = {
        create: '创建',
        advance: '推进',
        return: '退回',
        correct: '补正',
        overdue_process: '逾期处理',
        batch_advance: '批量推进',
        batch_return: '批量退回',
        advance_failed: '推进失败',
        return_failed: '退回失败',
        correct_failed: '补正失败'
    };
    return map[action] || action;
}

function formatRole(role) {
    const map = {
        clerk: '知识修登记员',
        supervisor: '知识修审核主管',
        reviewer: '复核负责人'
    };
    return map[role] || role;
}

function formatDateTime(dt) {
    if (!dt) return '-';
    try {
        const d = new Date(dt);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
        return dt;
    }
}

function classifyFailureReason(reason) {
    if (!reason) return { type: '', label: '', text: reason };
    if (reason.startsWith('越权操作：')) {
        return { type: 'unauthorized', label: '越权', text: reason.replace('越权操作：', '') };
    }
    if (reason.startsWith('顺序错误：')) {
        return { type: 'sequence', label: '顺序错误', text: reason.replace('顺序错误：', '') };
    }
    if (reason.startsWith('证据缺失：')) {
        return { type: 'evidence', label: '证据缺失', text: reason.replace('证据缺失：', '') };
    }
    if (reason.startsWith('版本冲突：')) {
        return { type: 'version', label: '版本冲突', text: reason.replace('版本冲突：', '') };
    }
    return { type: 'other', label: '失败', text: reason };
}

function renderFailureTypeTag(reason) {
    const { type, label } = classifyFailureReason(reason);
    if (!type) return '';
    return `<span class="failure-type-tag ${type}">${label}</span>`;
}

function renderFailureBadge(order) {
    if (!order.last_failure_reason) return '';
    const { type, label } = classifyFailureReason(order.last_failure_reason);
    return `<span class="failure-badge" title="${order.last_failure_reason}">⚠ ${label} · ${formatDateTime(order.last_failure_at)}</span>`;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function closeModal() {
    document.getElementById('modal').innerHTML = '';
}

function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('modal');
    modal.innerHTML = `
        <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <p style="margin-bottom:16px;font-size:14px;">${message}</p>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">取消</button>
                    <button class="btn btn-primary" id="modal-confirm-btn">确认</button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('modal-confirm-btn').onclick = async () => {
        closeModal();
        await onConfirm();
    };
}

function showAdvanceModal(orderId, version, isOverdue) {
    const modal = document.getElementById('modal');
    const overdueFields = isOverdue ? `
        <div class="overdue-fields" style="background:#fff5f5;padding:12px;border-radius:8px;margin-bottom:12px;">
            <h5 style="color:var(--danger);margin-bottom:8px;">逾期信息（必填）</h5>
            <div class="form-group">
                <label>逾期原因<span class="required">*</span></label>
                <textarea id="advance-overdue-reason" rows="3" placeholder="请输入逾期原因"></textarea>
            </div>
            <div class="form-group">
                <label>逾期处理措施<span class="required">*</span></label>
                <select id="advance-overdue-action">
                    <option value="">请选择</option>
                    <option value="continue">继续推进</option>
                    <option value="return_for_correction">退回补正</option>
                    <option value="terminate">终止处理</option>
                </select>
            </div>
        </div>
    ` : '';

    modal.innerHTML = `
        <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>确认通过</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="form-group">
                    <label>审批意见<span class="required">*</span></label>
                    <textarea id="advance-opinion" rows="3" placeholder="请输入审批意见（必填）"></textarea>
                </div>
                ${overdueFields}
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">取消</button>
                    <button class="btn btn-primary" onclick="handleAdvanceSubmit('${orderId}', ${version}, ${isOverdue})">确认通过</button>
                </div>
            </div>
        </div>
    `;
}

function showReturnModal(orderId, version) {
    const modal = document.getElementById('modal');
    modal.innerHTML = `
        <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>确认退回</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="form-group">
                    <label>退回原因<span class="required">*</span></label>
                    <textarea id="return-reason" rows="3" placeholder="请输入退回原因（必填）"></textarea>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">取消</button>
                    <button class="btn btn-danger" onclick="handleReturnSubmit('${orderId}', ${version})">确认退回</button>
                </div>
            </div>
        </div>
    `;
}

function showBatchAdvanceModal() {
    if (state.selectedOrders.size === 0) {
        showToast('请先选择修订单', 'warning');
        return;
    }
    const modal = document.getElementById('modal');
    modal.innerHTML = `
        <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>批量通过</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <p style="margin-bottom:16px;font-size:14px;">确认批量通过选中的 <strong>${state.selectedOrders.size}</strong> 个修订单？</p>
                <div class="form-group">
                    <label>审核意见<span class="required">*</span></label>
                    <textarea id="batch-advance-opinion" rows="3" placeholder="请输入审核意见（必填）"></textarea>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">取消</button>
                    <button class="btn btn-primary" onclick="handleBatchAdvanceSubmit()">确认批量通过</button>
                </div>
            </div>
        </div>
    `;
}

function showBatchReturnModal() {
    if (state.selectedOrders.size === 0) {
        showToast('请先选择修订单', 'warning');
        return;
    }
    const modal = document.getElementById('modal');
    modal.innerHTML = `
        <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>批量退回</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <p style="margin-bottom:16px;font-size:14px;">确认批量退回选中的 <strong>${state.selectedOrders.size}</strong> 个修订单？</p>
                <div class="form-group">
                    <label>退回原因<span class="required">*</span></label>
                    <textarea id="batch-return-reason" rows="3" placeholder="请输入退回原因（必填）"></textarea>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">取消</button>
                    <button class="btn btn-danger" onclick="handleBatchReturnSubmit()">确认批量退回</button>
                </div>
            </div>
        </div>
    `;
}

async function handleRoleSwitch(role) {
    try {
        await switchRole(role);
        state.currentRole = currentRole;
        state.currentUserID = currentUserID;
        state.currentUserName = currentUserName;
        document.querySelectorAll('.role-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.role === role);
        });
        document.getElementById('current-user').textContent = `当前用户：${currentUserName}`;
        state.selectedOrders.clear();
        state.filters = { status: '', is_overdue: '', keyword: '', page: 1, page_size: 10 };
        updateBatchBar();
        navigateTo('#list');
        showToast(`已切换为 ${currentUserName}`, 'success');
    } catch (e) {
        showToast(`切换角色失败：${e.message}`, 'error');
    }
}

async function handleAdvanceSubmit(orderId, version, isOverdue) {
    const opinion = document.getElementById('advance-opinion')?.value?.trim() || '';
    const overdueReason = document.getElementById('advance-overdue-reason')?.value?.trim() || '';
    const overdueAction = document.getElementById('advance-overdue-action')?.value || '';

    if (!opinion) {
        showToast('请填写审批意见', 'error');
        return;
    }

    if (isOverdue) {
        if (!overdueReason) {
            showToast('请填写逾期原因', 'error');
            return;
        }
        if (!overdueAction) {
            showToast('请选择逾期处理措施', 'error');
            return;
        }
    }

    try {
        await advanceOrder(orderId, {
            opinion,
            version: version,
            overdue_reason: overdueReason || undefined,
            overdue_action: overdueAction || undefined
        });
        closeModal();
        showToast('操作成功', 'success');
        refreshCurrentPage();
    } catch (e) {
        closeModal();
        if (e.message.includes('版本冲突') || e.message.includes('version')) {
            showToast('版本冲突，请刷新页面后重试', 'error');
        } else {
            showToast(`操作失败：${e.message}`, 'error');
        }
    }
}

async function handleReturnSubmit(orderId, version) {
    const reason = document.getElementById('return-reason')?.value?.trim() || '';
    if (!reason) {
        showToast('请填写退回原因', 'error');
        return;
    }
    try {
        await returnOrder(orderId, { reason, version });
        closeModal();
        showToast('退回成功', 'success');
        refreshCurrentPage();
    } catch (e) {
        closeModal();
        if (e.message.includes('版本冲突') || e.message.includes('version')) {
            showToast('版本冲突，请刷新页面后重试', 'error');
        } else {
            showToast(`退回失败：${e.message}`, 'error');
        }
    }
}

function showBatchResultModal(title, succeeded, failed) {
    const modal = document.getElementById('modal');

    const succeededHtml = succeeded.length > 0 ? `
        <div style="margin-bottom:16px;">
            <h4 style="color:var(--success);margin-bottom:8px;">成功 (${succeeded.length})</h4>
            ${succeeded.map(o => `
                <div class="batch-result-item success">
                    <span class="result-icon">✓</span>
                    <span class="order-no">${o.order_no || o.id}</span>
                    <span>${escapeHtml(o.title || '')}</span>
                </div>
            `).join('')}
        </div>
    ` : '';

    const failedHtml = failed.length > 0 ? `
        <div>
            <h4 style="color:var(--danger);margin-bottom:8px;">失败 (${failed.length})</h4>
            ${failed.map(f => {
                const [orderNo, ...reasonParts] = f.split(': ');
                const reason = reasonParts.join(': ');
                return `
                <div class="batch-result-item failed">
                    <span class="result-icon">✗</span>
                    <span class="order-no">${orderNo}</span>
                    <span>${renderFailureTypeTag(reason)} ${escapeHtml(reason)}</span>
                </div>
            `}).join('')}
        </div>
    ` : '';

    modal.innerHTML = `
        <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="closeModal(); refreshCurrentPage();">&times;</button>
                </div>
                <div style="max-height:60vh;overflow-y:auto;">
                    ${succeededHtml}
                    ${failedHtml}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="closeModal(); refreshCurrentPage();">确定</button>
                </div>
            </div>
        </div>
    `;
}

async function handleBatchAdvanceSubmit() {
    const opinion = document.getElementById('batch-advance-opinion')?.value?.trim() || '';
    if (!opinion) {
        showToast('请填写审核意见', 'error');
        return;
    }
    const ids = Array.from(state.selectedOrders);
    try {
        const result = await batchAdvance({ order_ids: ids, opinion_or_reason: opinion });
        const data = result.data || {};
        const failed = data.failed || [];
        const succeeded = data.succeeded || [];
        closeModal();
        state.selectedOrders.clear();
        updateBatchBar();
        showBatchResultModal('批量通过结果', succeeded, failed);
    } catch (e) {
        closeModal();
        showToast(`批量通过失败：${e.message}`, 'error');
    }
}

async function handleBatchReturnSubmit() {
    const reason = document.getElementById('batch-return-reason')?.value?.trim() || '';
    if (!reason) {
        showToast('请填写退回原因', 'error');
        return;
    }
    const ids = Array.from(state.selectedOrders);
    try {
        const result = await batchReturn({ order_ids: ids, opinion_or_reason: reason });
        const data = result.data || {};
        const failed = data.failed || [];
        const succeeded = data.succeeded || [];
        closeModal();
        state.selectedOrders.clear();
        updateBatchBar();
        showBatchResultModal('批量退回结果', succeeded, failed);
    } catch (e) {
        closeModal();
        showToast(`批量退回失败：${e.message}`, 'error');
    }
}

function handleBatchAdvance() {
    showBatchAdvanceModal();
}

function handleBatchReturn() {
    showBatchReturnModal();
}

function toggleOrderSelection(id) {
    if (state.selectedOrders.has(id)) {
        state.selectedOrders.delete(id);
    } else {
        state.selectedOrders.add(id);
    }
    updateBatchBar();
}

function toggleSelectAll(checked) {
    if (checked) {
        state.orders.forEach(o => state.selectedOrders.add(o.id));
    } else {
        state.selectedOrders.clear();
    }
    updateBatchBar();
    document.querySelectorAll('.order-checkbox').forEach(cb => { cb.checked = checked; });
}

function clearSelection() {
    state.selectedOrders.clear();
    updateBatchBar();
    document.querySelectorAll('.order-checkbox').forEach(cb => { cb.checked = false; });
    const selectAll = document.querySelector('.select-all-checkbox');
    if (selectAll) selectAll.checked = false;
}

function updateBatchBar() {
    const bar = document.getElementById('batch-bar');
    const count = document.getElementById('batch-count');
    if (state.selectedOrders.size > 0) {
        bar.classList.add('visible');
        count.textContent = state.selectedOrders.size;
    } else {
        bar.classList.remove('visible');
    }
}

function navigateTo(hash) {
    window.location.hash = hash;
}

function refreshCurrentPage() {
    const hash = window.location.hash || '#list';
    handleRoute(hash);
}

function handleRoute(hash) {
    const app = document.getElementById('app');
    app.style.animation = 'none';
    app.offsetHeight;
    app.style.animation = 'fadeIn 0.3s ease';

    if (hash === '#list' || hash === '' || hash === '#') {
        state.currentPage = 'list';
        renderListPage();
    } else if (hash.startsWith('#detail/')) {
        const id = hash.split('/')[1];
        state.currentPage = 'detail';
        renderDetailPage(id);
    } else if (hash === '#create') {
        state.currentPage = 'create';
        renderCreatePage();
    } else if (hash.startsWith('#correct/')) {
        const id = hash.split('/')[1];
        state.currentPage = 'correct';
        renderCorrectPage(id);
    } else if (hash === '#stats') {
        state.currentPage = 'stats';
        renderStatsPage();
    } else {
        state.currentPage = 'list';
        renderListPage();
    }
}

async function renderListPage() {
    const app = document.getElementById('app');

    let statsHtml = '';
    try {
        const statsData = await getStats();
        const s = statsData.data || statsData;
        state.stats = s;
        statsHtml = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${s.pending_review || 0}</div>
                    <div class="stat-label">待审核</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${s.pending_correction || 0}</div>
                    <div class="stat-label">待补正</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${s.pending_final_review || 0}</div>
                    <div class="stat-label">待复核</div>
                </div>
                <div class="stat-card overdue">
                    <div class="stat-number">${s.overdue || 0}</div>
                    <div class="stat-label">逾期</div>
                </div>
            </div>
        `;
    } catch (e) {
        statsHtml = '<div class="stats-grid"><div class="stat-card"><div class="stat-label">统计信息加载失败</div></div></div>';
    }

    const createBtn = state.currentRole === 'clerk'
        ? '<button class="btn btn-primary" onclick="navigateTo(\'#create\')">+ 发起修订单</button>'
        : '';

    app.innerHTML = `
        <div class="page-header">
            <h2>修订单列表</h2>
            <div class="btn-group">
                ${createBtn}
                <button class="btn btn-outline" onclick="navigateTo('#stats')">审计日志</button>
            </div>
        </div>
        ${statsHtml}
        <div class="filter-bar">
            <span class="filter-label">状态：</span>
            <select id="filter-status" onchange="handleFilterChange()">
                <option value="">全部</option>
                <option value="pending_review">待审核</option>
                <option value="pending_correction">待补正</option>
                <option value="pending_final_review">待复核</option>
                <option value="archived">已归档</option>
            </select>
            <span class="filter-label">逾期：</span>
            <select id="filter-overdue" onchange="handleFilterChange()">
                <option value="">全部</option>
                <option value="true">仅逾期</option>
            </select>
            <input type="text" id="filter-keyword" placeholder="搜索修订单号/标题..." onkeydown="if(event.key==='Enter')handleFilterChange()">
            <button class="btn btn-primary btn-small" onclick="handleFilterChange()">搜索</button>
        </div>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width:40px;"><label class="checkbox-wrapper"><input type="checkbox" class="select-all-checkbox" onchange="toggleSelectAll(this.checked)"></label></th>
                        <th>修订单号</th>
                        <th>标题</th>
                        <th>关联知识条目</th>
                        <th>状态</th>
                        <th>失败留痕</th>
                        <th>发起人</th>
                        <th>当前处理人</th>
                        <th>时限(小时)</th>
                        <th>逾期</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody id="order-tbody">
                    <tr><td colspan="11" class="empty-state"><p>加载中...</p></td></tr>
                </tbody>
            </table>
        </div>
        <div id="pagination-container"></div>
    `;

    document.getElementById('filter-status').value = state.filters.status;
    document.getElementById('filter-overdue').value = state.filters.is_overdue;
    document.getElementById('filter-keyword').value = state.filters.keyword;

    await fetchAndRenderOrders();
}

async function fetchAndRenderOrders() {
    const tbody = document.getElementById('order-tbody');
    if (!tbody) return;
    try {
        const params = { ...state.filters };
        if (state.currentRole) {
            params.role = state.currentRole;
        }
        const data = await listOrders(params);
        const respData = data.data || {};
        const orders = respData.list || [];
        const total = respData.total || 0;
        state.orders = orders;
        state.totalOrders = total;

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="empty-state"><div class="empty-icon">📋</div><p>暂无修订单数据</p></td></tr>';
            renderPagination(0);
            return;
        }

        tbody.innerHTML = orders.map(o => {
            const isSelected = state.selectedOrders.has(o.id);
            let actionsHtml = `<button class="btn btn-outline btn-small" onclick="navigateTo('#detail/${o.id}')">查看</button>`;

            if (state.currentRole === 'supervisor' && o.status === 'pending_review') {
                actionsHtml += ` <button class="btn btn-primary btn-small" onclick="showAdvanceModal('${o.id}', ${o.version}, ${o.is_overdue})">审核通过</button>`;
                actionsHtml += ` <button class="btn btn-danger btn-small" onclick="showReturnModal('${o.id}', ${o.version})">退回</button>`;
            }
            if (state.currentRole === 'reviewer' && o.status === 'pending_final_review') {
                actionsHtml += ` <button class="btn btn-primary btn-small" onclick="showAdvanceModal('${o.id}', ${o.version}, ${o.is_overdue})">复核通过</button>`;
                actionsHtml += ` <button class="btn btn-danger btn-small" onclick="showReturnModal('${o.id}', ${o.version})">退回</button>`;
            }
            if (state.currentRole === 'clerk' && o.status === 'pending_correction') {
                actionsHtml += ` <button class="btn btn-warning btn-small" onclick="navigateTo('#correct/${o.id}')">补正</button>`;
            }

            const overdueHtml = o.is_overdue
                ? '<span class="status-badge overdue">逾期</span>'
                : '<span style="color:var(--success);">✓</span>';

            const statusBadge = `<span class="status-badge ${o.status}">${formatStatus(o.status)}</span>`;
            const failureHtml = renderFailureBadge(o);

            return `<tr>
                <td><label class="checkbox-wrapper"><input type="checkbox" class="order-checkbox" ${isSelected ? 'checked' : ''} onchange="toggleOrderSelection('${o.id}')"></label></td>
                <td>${o.order_no || o.id}</td>
                <td>${escapeHtml(o.title)}</td>
                <td>${escapeHtml(o.knowledge_item_title || o.knowledge_item_id || '-')}</td>
                <td>${statusBadge}</td>
                <td>${failureHtml || '<span style="color:var(--text-light);">-</span>'}</td>
                <td>${escapeHtml(o.creator_name || o.creator_id || '-')}</td>
                <td>${escapeHtml(o.current_handler_name || o.current_handler_id || '-')}</td>
                <td>${o.time_limit_hours || '-'}</td>
                <td>${overdueHtml}</td>
                <td><div class="btn-group">${actionsHtml}</div></td>
            </tr>`;
        }).join('');

        renderPagination(total);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="11" class="empty-state"><p>加载失败：${escapeHtml(e.message)}</p></td></tr>`;
    }
}

function handleFilterChange() {
    state.filters.status = document.getElementById('filter-status')?.value || '';
    state.filters.is_overdue = document.getElementById('filter-overdue')?.value || '';
    state.filters.keyword = document.getElementById('filter-keyword')?.value || '';
    state.filters.page = 1;
    fetchAndRenderOrders();
}

function renderPagination(total) {
    const container = document.getElementById('pagination-container');
    if (!container) return;

    const pageSize = state.filters.page_size;
    const totalPages = Math.ceil(total / pageSize);
    const currentPage = state.filters.page;

    if (totalPages <= 1) {
        container.innerHTML = total > 0
            ? `<div class="pagination"><span class="page-info">共 ${total} 条记录</span></div>`
            : '';
        return;
    }

    let pagesHtml = '';
    pagesHtml += `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">上一页</button>`;

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        pagesHtml += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) pagesHtml += '<span class="page-info">...</span>';
    }

    for (let i = startPage; i <= endPage; i++) {
        pagesHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) pagesHtml += '<span class="page-info">...</span>';
        pagesHtml += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }

    pagesHtml += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">下一页</button>`;

    container.innerHTML = `<div class="pagination">${pagesHtml}<span class="page-info" style="margin-left:12px;">共 ${total} 条</span></div>`;
}

async function goToPage(page) {
    state.filters.page = page;
    await fetchAndRenderOrders();
    window.scrollTo(0, 0);
}

async function renderDetailPage(orderId) {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="empty-state"><p>加载中...</p></div>';

    try {
        const data = await getOrder(orderId);
        const order = data.data || data;
        state.currentOrder = order;

        const overdueWarning = order.is_overdue ? `
            <div class="overdue-warning">
                <div class="overdue-icon">⚠️</div>
                <div class="overdue-text">
                    <strong>该修订单已逾期 ${order.overdue_days || '-'} 天</strong>
                    ${order.overdue_reason ? `<br>逾期原因：${escapeHtml(order.overdue_reason)}` : ''}
                    ${order.overdue_action ? `<br>逾期处理动作：${escapeHtml(order.overdue_action)}` : ''}
                </div>
            </div>
        ` : '';

        const failureWarning = order.last_failure_reason ? `
            <div class="failure-warning-card">
                <h4>⚠️ 最近操作失败</h4>
                ${renderFailureTypeTag(order.last_failure_reason)}
                <p>${escapeHtml(classifyFailureReason(order.last_failure_reason).text)}</p>
                <div class="failure-time">失败时间：${formatDateTime(order.last_failure_at)}</div>
            </div>
        ` : '';

        let actionHtml = '';
        if (state.currentRole === 'supervisor' && order.status === 'pending_review') {
            actionHtml = `
                <div class="detail-card">
                    <div class="section-header">审核操作</div>
                    <div class="form-group">
                        <label>审核意见<span class="required">*</span></label>
                        <textarea id="detail-opinion" rows="3" placeholder="请输入审核意见（必填）"></textarea>
                    </div>
                    ${order.is_overdue ? `
                        <div style="background:#fff5f5;padding:12px;border-radius:8px;margin-bottom:12px;">
                            <h5 style="color:var(--danger);margin-bottom:8px;">逾期信息（必填）</h5>
                            <div class="form-group">
                                <label>逾期原因<span class="required">*</span></label>
                                <textarea id="detail-overdue-reason" rows="2" placeholder="请输入逾期原因"></textarea>
                            </div>
                            <div class="form-group">
                                <label>逾期处理措施<span class="required">*</span></label>
                                <select id="detail-overdue-action">
                                    <option value="">请选择</option>
                                    <option value="continue">继续推进</option>
                                    <option value="return_for_correction">退回补正</option>
                                    <option value="terminate">终止处理</option>
                                </select>
                            </div>
                        </div>
                    ` : ''}
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="handleDetailAdvance('${order.id}', ${order.version}, ${order.is_overdue})">审核通过</button>
                        <button class="btn btn-danger" onclick="showReturnModal('${order.id}', ${order.version})">退回</button>
                    </div>
                </div>
            `;
        } else if (state.currentRole === 'reviewer' && order.status === 'pending_final_review') {
            actionHtml = `
                <div class="detail-card">
                    <div class="section-header">复核操作</div>
                    <div class="form-group">
                        <label>复核意见<span class="required">*</span></label>
                        <textarea id="detail-opinion" rows="3" placeholder="请输入复核意见（必填）"></textarea>
                    </div>
                    ${order.is_overdue ? `
                        <div style="background:#fff5f5;padding:12px;border-radius:8px;margin-bottom:12px;">
                            <h5 style="color:var(--danger);margin-bottom:8px;">逾期信息（必填）</h5>
                            <div class="form-group">
                                <label>逾期原因<span class="required">*</span></label>
                                <textarea id="detail-overdue-reason" rows="2" placeholder="请输入逾期原因"></textarea>
                            </div>
                            <div class="form-group">
                                <label>逾期处理措施<span class="required">*</span></label>
                                <select id="detail-overdue-action">
                                    <option value="">请选择</option>
                                    <option value="continue">继续推进</option>
                                    <option value="return_for_correction">退回补正</option>
                                    <option value="terminate">终止处理</option>
                                </select>
                            </div>
                        </div>
                    ` : ''}
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="handleDetailAdvance('${order.id}', ${order.version}, ${order.is_overdue})">复核通过</button>
                        <button class="btn btn-danger" onclick="showReturnModal('${order.id}', ${order.version})">退回</button>
                    </div>
                </div>
            `;
        } else if (state.currentRole === 'clerk' && order.status === 'pending_correction') {
            actionHtml = `
                <div class="detail-card">
                    <div class="section-header">补正操作</div>
                    <p style="margin-bottom:12px;font-size:14px;color:var(--text-light);">请前往补正页面进行补正操作</p>
                    <button class="btn btn-warning" onclick="navigateTo('#correct/${order.id}')">前往补正</button>
                </div>
            `;
        }

        let materialsHtml = '';
        if (order.materials && order.materials.length > 0) {
            materialsHtml = `
                <table class="material-table">
                    <thead><tr><th>名称</th><th>文件类型</th><th>是否完整</th><th>上传时间</th></tr></thead>
                    <tbody>
                        ${order.materials.map(m => `<tr>
                            <td>${escapeHtml(m.name)}</td>
                            <td>${m.file_type || '-'}</td>
                            <td>${m.is_complete ? '<span style="color:var(--success);">✓ 完整</span>' : '<span style="color:var(--danger);">✗ 不完整</span>'}</td>
                            <td>${formatDateTime(m.uploaded_at)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            `;
        } else {
            materialsHtml = '<p style="color:var(--text-light);font-size:14px;">暂无材料</p>';
        }

        let feedbacksHtml = '';
        if (order.feedbacks && order.feedbacks.length > 0) {
            feedbacksHtml = order.feedbacks.map(f => `
                <div class="feedback-item">
                    <div class="feedback-content">${escapeHtml(f.content)}</div>
                    <div class="feedback-status">${f.is_resolved ? '<span style="color:var(--success);">已解决</span>' : '<span style="color:var(--warning);">未解决</span>'}</div>
                </div>
            `).join('');
        } else {
            feedbacksHtml = '<p style="color:var(--text-light);font-size:14px;">暂无反馈</p>';
        }

        let timelineHtml = '';
        try {
            const logsData = await getOrderAuditLogs(orderId);
            const logs = Array.isArray(logsData.data) ? logsData.data : [];
            if (logs.length > 0) {
                timelineHtml = logs.map(log => {
                    const isFailed = log.failure_reason && log.failure_reason !== '';
                    const failedClass = isFailed ? ' failed' : '';
                    return `
                    <div class="timeline-item action-${log.action}${failedClass}">
                        <div class="timeline-dot"></div>
                        <div class="timeline-content">
                            <div class="timeline-time">${formatDateTime(log.created_at)}</div>
                            <div class="timeline-action">
                                ${isFailed ? '⚠️ ' : ''}${formatAction(log.action)}
                                ${isFailed ? renderFailureTypeTag(log.failure_reason) : ''}
                            </div>
                            <div class="timeline-actor">${escapeHtml(log.actor_name || log.actor_id || '-')} (${formatRole(log.actor_role || '')})</div>
                            ${log.opinion ? `<div class="timeline-detail">意见：${escapeHtml(log.opinion)}</div>` : ''}
                            ${log.reason ? `<div class="timeline-detail">原因：${escapeHtml(log.reason)}</div>` : ''}
                            ${log.failure_reason ? `<div class="failure-reason-text">${escapeHtml(log.failure_reason)}</div>` : ''}
                        </div>
                    </div>
                `}).join('');
            } else {
                timelineHtml = '<p style="color:var(--text-light);font-size:14px;">暂无审计记录</p>';
            }
        } catch (e) {
            timelineHtml = `<p style="color:var(--danger);font-size:14px;">审计记录加载失败：${escapeHtml(e.message)}</p>`;
        }

        app.innerHTML = `
            <button class="back-btn" onclick="navigateTo('#list')">← 返回列表</button>
            ${failureWarning}
            ${overdueWarning}
            <div class="detail-card">
                <div class="section-header">修订单信息</div>
                <div class="detail-row"><div class="detail-label">修订单号</div><div class="detail-value">${order.order_no || order.id}</div></div>
                <div class="detail-row"><div class="detail-label">标题</div><div class="detail-value">${escapeHtml(order.title)}</div></div>
                <div class="detail-row"><div class="detail-label">关联知识条目</div><div class="detail-value">${escapeHtml(order.knowledge_item_title || order.knowledge_item_id || '-')}</div></div>
                <div class="detail-row"><div class="detail-label">状态</div><div class="detail-value"><span class="status-badge ${order.status}">${formatStatus(order.status)}</span>${order.is_overdue ? ' <span class="status-badge overdue">逾期</span>' : ''}</div></div>
                <div class="detail-row"><div class="detail-label">发起人</div><div class="detail-value">${escapeHtml(order.creator_name || order.creator_id || '-')}</div></div>
                <div class="detail-row"><div class="detail-label">当前处理人</div><div class="detail-value">${escapeHtml(order.current_handler_name || order.current_handler_id || '-')}</div></div>
                <div class="detail-row"><div class="detail-label">时限</div><div class="detail-value">${order.time_limit_hours || '-'} 小时</div></div>
                <div class="detail-row"><div class="detail-label">截止时间</div><div class="detail-value">${formatDateTime(order.deadline)}</div></div>
            </div>
            <div class="detail-card">
                <div class="section-header">关联材料</div>
                ${materialsHtml}
            </div>
            <div class="detail-card">
                <div class="section-header">反馈信息</div>
                ${feedbacksHtml}
            </div>
            <div class="detail-card">
                <div class="section-header">修订内容</div>
                <div class="revision-content">
                    <div class="revision-block">
                        <h5>修订前</h5>
                        <pre>${escapeHtml(order.revision_before || '-')}</pre>
                    </div>
                    <div class="revision-block">
                        <h5>修订后</h5>
                        <pre>${escapeHtml(order.revision_after || '-')}</pre>
                    </div>
                </div>
                ${order.revision_description ? `<div style="margin-top:12px;"><strong>修订说明：</strong>${escapeHtml(order.revision_description)}</div>` : ''}
            </div>
            ${actionHtml}
            <div class="detail-card">
                <div class="section-header">审计记录</div>
                <div class="timeline">
                    ${timelineHtml}
                </div>
            </div>
        `;
    } catch (e) {
        app.innerHTML = `
            <button class="back-btn" onclick="navigateTo('#list')">← 返回列表</button>
            <div class="detail-card"><p style="color:var(--danger);">加载失败：${escapeHtml(e.message)}</p></div>
        `;
    }
}

async function handleDetailAdvance(orderId, version, isOverdue) {
    const opinion = document.getElementById('detail-opinion')?.value?.trim() || '';
    const overdueReason = document.getElementById('detail-overdue-reason')?.value?.trim() || '';
    const overdueAction = document.getElementById('detail-overdue-action')?.value || '';

    if (!opinion) {
        showToast('请填写审批意见', 'error');
        return;
    }

    if (isOverdue) {
        if (!overdueReason) {
            showToast('请填写逾期原因', 'error');
            return;
        }
        if (!overdueAction) {
            showToast('请选择逾期处理措施', 'error');
            return;
        }
    }

    try {
        await advanceOrder(orderId, {
            opinion,
            version: version,
            overdue_reason: overdueReason || undefined,
            overdue_action: overdueAction || undefined
        });
        showToast('操作成功', 'success');
        renderDetailPage(orderId);
    } catch (e) {
        if (e.message.includes('版本冲突') || e.message.includes('version')) {
            showToast('版本冲突，数据已被其他人修改，请刷新页面后重试', 'error');
        } else {
            showToast(`操作失败：${e.message}`, 'error');
        }
    }
}

async function renderCreatePage() {
    if (state.currentRole !== 'clerk') {
        showToast('只有知识修登记员可以发起修订单', 'warning');
        navigateTo('#list');
        return;
    }

    let knowledgeOptions = '<option value="">请选择</option>';
    try {
        const kiData = await getKnowledgeItems();
        const items = Array.isArray(kiData.data) ? kiData.data : [];
        state.knowledgeItems = items;
        knowledgeOptions += items.map(item =>
            `<option value="${item.id}">${escapeHtml(item.title || item.id)}</option>`
        ).join('');
    } catch (e) {
        showToast('知识条目加载失败：' + e.message, 'error');
    }

    const app = document.getElementById('app');
    app.innerHTML = `
        <button class="back-btn" onclick="navigateTo('#list')">← 返回列表</button>
        <div class="page-header"><h2>发起修订单</h2></div>
        <div class="detail-card">
            <div class="section-header">基本信息</div>
            <div class="form-group">
                <label>标题<span class="required">*</span></label>
                <input type="text" id="create-title" placeholder="请输入修订单标题">
            </div>
            <div class="form-group">
                <label>关联知识条目<span class="required">*</span></label>
                <select id="create-knowledge-item">${knowledgeOptions}</select>
            </div>
            <div class="form-group">
                <label>时限(小时)<span class="required">*</span></label>
                <input type="number" id="create-time-limit" value="72" min="1">
            </div>
        </div>
        <div class="detail-card">
            <div class="section-header">修订内容</div>
            <div class="form-group">
                <label>修订前内容<span class="required">*</span></label>
                <textarea id="create-revision-before" rows="4" placeholder="请输入修订前内容"></textarea>
            </div>
            <div class="form-group">
                <label>修订后内容<span class="required">*</span></label>
                <textarea id="create-revision-after" rows="4" placeholder="请输入修订后内容"></textarea>
            </div>
            <div class="form-group">
                <label>修订说明</label>
                <textarea id="create-revision-description" rows="3" placeholder="请输入修订说明（可选）"></textarea>
            </div>
        </div>
        <div class="detail-card">
            <div class="section-header">关联材料</div>
            <div id="materials-container"></div>
            <button class="add-entry-btn" onclick="addMaterialEntry()">+ 添加材料</button>
        </div>
        <div class="detail-card">
            <div class="section-header">反馈信息</div>
            <div id="feedbacks-container"></div>
            <button class="add-entry-btn" onclick="addFeedbackEntry()">+ 添加反馈</button>
        </div>
        <div style="display:flex;gap:12px;margin-top:20px;">
            <button class="btn btn-primary" onclick="handleCreateSubmit()">提交修订单</button>
            <button class="btn btn-outline" onclick="navigateTo('#list')">取消</button>
        </div>
    `;
}

let materialEntryCount = 0;
let feedbackEntryCount = 0;

function addMaterialEntry() {
    materialEntryCount++;
    const container = document.getElementById('materials-container');
    const div = document.createElement('div');
    div.className = 'material-entry';
    div.id = `material-entry-${materialEntryCount}`;
    div.innerHTML = `
        <div class="form-group">
            <label>名称<span class="required">*</span></label>
            <input type="text" class="material-name" placeholder="材料名称">
        </div>
        <div class="form-group">
            <label>文件类型</label>
            <select class="material-file-type">
                <option value="document">文档</option>
                <option value="image">图片</option>
                <option value="video">视频</option>
                <option value="audio">音频</option>
            </select>
        </div>
        <div class="form-group" style="flex:0;">
            <label>完整</label>
            <label class="checkbox-wrapper"><input type="checkbox" class="material-is-complete" checked></label>
        </div>
        <button class="btn btn-danger btn-small btn-remove" onclick="removeEntry('material-entry-${materialEntryCount}')">删除</button>
    `;
    container.appendChild(div);
}

function addFeedbackEntry() {
    feedbackEntryCount++;
    const container = document.getElementById('feedbacks-container');
    const div = document.createElement('div');
    div.className = 'feedback-entry';
    div.id = `feedback-entry-${feedbackEntryCount}`;
    div.innerHTML = `
        <div class="form-group">
            <label>反馈内容<span class="required">*</span></label>
            <input type="text" class="feedback-content-input" placeholder="反馈内容">
        </div>
        <div class="form-group" style="flex:0;">
            <label>已解决</label>
            <label class="checkbox-wrapper"><input type="checkbox" class="feedback-is-resolved"></label>
        </div>
        <button class="btn btn-danger btn-small btn-remove" onclick="removeEntry('feedback-entry-${feedbackEntryCount}')">删除</button>
    `;
    container.appendChild(div);
}

function removeEntry(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

async function handleCreateSubmit() {
    const title = document.getElementById('create-title')?.value?.trim();
    const knowledgeItemId = document.getElementById('create-knowledge-item')?.value;
    const timeLimit = document.getElementById('create-time-limit')?.value;
    const revisionBefore = document.getElementById('create-revision-before')?.value?.trim();
    const revisionAfter = document.getElementById('create-revision-after')?.value?.trim();
    const revisionDescription = document.getElementById('create-revision-description')?.value?.trim();

    if (!title) { showToast('请填写标题', 'error'); return; }
    if (!knowledgeItemId) { showToast('请选择关联知识条目', 'error'); return; }
    if (!timeLimit) { showToast('请填写时限', 'error'); return; }
    if (!revisionBefore) { showToast('请填写修订前内容', 'error'); return; }
    if (!revisionAfter) { showToast('请填写修订后内容', 'error'); return; }

    const materials = [];
    document.querySelectorAll('.material-entry').forEach(el => {
        const name = el.querySelector('.material-name')?.value?.trim();
        if (name) {
            materials.push({
                name,
                file_type: el.querySelector('.material-file-type')?.value || 'document',
                is_complete: el.querySelector('.material-is-complete')?.checked || false
            });
        }
    });

    const feedbacks = [];
    document.querySelectorAll('.feedback-entry').forEach(el => {
        const content = el.querySelector('.feedback-content-input')?.value?.trim();
        if (content) {
            feedbacks.push({
                content,
                is_resolved: el.querySelector('.feedback-is-resolved')?.checked || false
            });
        }
    });

    try {
        await createOrder({
            title,
            knowledge_item_id: knowledgeItemId,
            revision_before: revisionBefore,
            revision_after: revisionAfter,
            revision_description: revisionDescription || undefined,
            time_limit_hours: parseInt(timeLimit),
            materials,
            feedbacks
        });
        showToast('修订单创建成功', 'success');
        navigateTo('#list');
    } catch (e) {
        showToast(`创建失败：${e.message}`, 'error');
    }
}

async function renderCorrectPage(orderId) {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="empty-state"><p>加载中...</p></div>';

    try {
        const data = await getOrder(orderId);
        const order = data.data || data;
        state.currentOrder = order;

        let materialsEntries = '';
        if (order.materials && order.materials.length > 0) {
            order.materials.forEach(m => {
                materialEntryCount++;
                materialsEntries += `
                    <div class="material-entry" id="material-entry-${materialEntryCount}">
                        <div class="form-group">
                            <label>名称<span class="required">*</span></label>
                            <input type="text" class="material-name" value="${escapeHtml(m.name)}">
                        </div>
                        <div class="form-group">
                            <label>文件类型</label>
                            <select class="material-file-type">
                                <option value="document" ${m.file_type === 'document' ? 'selected' : ''}>文档</option>
                                <option value="image" ${m.file_type === 'image' ? 'selected' : ''}>图片</option>
                                <option value="video" ${m.file_type === 'video' ? 'selected' : ''}>视频</option>
                                <option value="audio" ${m.file_type === 'audio' ? 'selected' : ''}>音频</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex:0;">
                            <label>完整</label>
                            <label class="checkbox-wrapper"><input type="checkbox" class="material-is-complete" ${m.is_complete ? 'checked' : ''}></label>
                        </div>
                        <button class="btn btn-danger btn-small btn-remove" onclick="removeEntry('material-entry-${materialEntryCount}')">删除</button>
                    </div>
                `;
            });
        }

        let feedbacksEntries = '';
        if (order.feedbacks && order.feedbacks.length > 0) {
            order.feedbacks.forEach(f => {
                feedbackEntryCount++;
                feedbacksEntries += `
                    <div class="feedback-entry" id="feedback-entry-${feedbackEntryCount}">
                        <div class="form-group">
                            <label>反馈内容<span class="required">*</span></label>
                            <input type="text" class="feedback-content-input" value="${escapeHtml(f.content)}">
                        </div>
                        <div class="form-group" style="flex:0;">
                            <label>已解决</label>
                            <label class="checkbox-wrapper"><input type="checkbox" class="feedback-is-resolved" ${f.is_resolved ? 'checked' : ''}></label>
                        </div>
                        <button class="btn btn-danger btn-small btn-remove" onclick="removeEntry('feedback-entry-${feedbackEntryCount}')">删除</button>
                    </div>
                `;
            });
        }

        app.innerHTML = `
            <button class="back-btn" onclick="navigateTo('#detail/${orderId}')">← 返回详情</button>
            <div class="page-header"><h2>补正修订单</h2></div>
            <div class="detail-card">
                <div class="section-header">基本信息</div>
                <div class="detail-row"><div class="detail-label">修订单号</div><div class="detail-value">${order.order_no}</div></div>
                <div class="detail-row"><div class="detail-label">标题</div><div class="detail-value">${escapeHtml(order.title)}</div></div>
                <div class="detail-row"><div class="detail-label">关联知识条目</div><div class="detail-value">${escapeHtml(order.knowledge_item_title || order.knowledge_item_id || '-')}</div></div>
            </div>
            <div class="detail-card">
                <div class="section-header">修订内容</div>
                <div class="form-group">
                    <label>修订前内容<span class="required">*</span></label>
                    <textarea id="correct-revision-before" rows="4">${escapeHtml(order.revision_before || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>修订后内容<span class="required">*</span></label>
                    <textarea id="correct-revision-after" rows="4">${escapeHtml(order.revision_after || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>修订说明</label>
                    <textarea id="correct-revision-description" rows="3">${escapeHtml(order.revision_description || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>补正说明<span class="required">*</span></label>
                    <textarea id="correct-correction-note" rows="3" placeholder="请输入补正说明（必填）"></textarea>
                </div>
            </div>
            <div class="detail-card">
                <div class="section-header">关联材料</div>
                <div id="materials-container">${materialsEntries}</div>
                <button class="add-entry-btn" onclick="addMaterialEntry()">+ 添加材料</button>
            </div>
            <div class="detail-card">
                <div class="section-header">反馈信息</div>
                <div id="feedbacks-container">${feedbacksEntries}</div>
                <button class="add-entry-btn" onclick="addFeedbackEntry()">+ 添加反馈</button>
            </div>
            <div style="display:flex;gap:12px;margin-top:20px;">
                <button class="btn btn-warning" onclick="handleCorrectSubmit('${orderId}', ${order.version})">提交补正</button>
                <button class="btn btn-outline" onclick="navigateTo('#detail/${orderId}')">取消</button>
            </div>
        `;
    } catch (e) {
        app.innerHTML = `
            <button class="back-btn" onclick="navigateTo('#list')">← 返回列表</button>
            <div class="detail-card"><p style="color:var(--danger);">加载失败：${escapeHtml(e.message)}</p></div>
        `;
    }
}

async function handleCorrectSubmit(orderId, version) {
    const revisionBefore = document.getElementById('correct-revision-before')?.value?.trim();
    const revisionAfter = document.getElementById('correct-revision-after')?.value?.trim();
    const revisionDescription = document.getElementById('correct-revision-description')?.value?.trim();
    const correctionNote = document.getElementById('correct-correction-note')?.value?.trim();

    if (!revisionBefore) { showToast('请填写修订前内容', 'error'); return; }
    if (!revisionAfter) { showToast('请填写修订后内容', 'error'); return; }
    if (!correctionNote) { showToast('请填写补正说明', 'error'); return; }

    const materials = [];
    document.querySelectorAll('.material-entry').forEach(el => {
        const name = el.querySelector('.material-name')?.value?.trim();
        if (name) {
            materials.push({
                name,
                file_type: el.querySelector('.material-file-type')?.value || 'document',
                is_complete: el.querySelector('.material-is-complete')?.checked || false
            });
        }
    });

    const feedbacks = [];
    document.querySelectorAll('.feedback-entry').forEach(el => {
        const content = el.querySelector('.feedback-content-input')?.value?.trim();
        if (content) {
            feedbacks.push({
                content,
                is_resolved: el.querySelector('.feedback-is-resolved')?.checked || false
            });
        }
    });

    try {
        await correctOrder(orderId, {
            revision_before: revisionBefore,
            revision_after: revisionAfter,
            revision_description: revisionDescription || undefined,
            correction_note: correctionNote,
            version: version,
            materials,
            feedbacks
        });
        showToast('补正提交成功', 'success');
        navigateTo('#detail/' + orderId);
    } catch (e) {
        if (e.message.includes('版本冲突') || e.message.includes('version')) {
            showToast('版本冲突，数据已被其他人修改，请刷新页面后重试', 'error');
        } else {
            showToast(`补正失败：${e.message}`, 'error');
        }
    }
}

async function renderStatsPage() {
    const app = document.getElementById('app');

    let statsHtml = '';
    try {
        const statsData = await getStats();
        const s = statsData.data || statsData;
        statsHtml = `
            <div class="stats-page-grid">
                <div class="stat-mini">
                    <div class="stat-number">${s.total || 0}</div>
                    <div class="stat-label">总数</div>
                </div>
                <div class="stat-mini">
                    <div class="stat-number">${s.pending_review || 0}</div>
                    <div class="stat-label">待审核</div>
                </div>
                <div class="stat-mini">
                    <div class="stat-number">${s.pending_correction || 0}</div>
                    <div class="stat-label">待补正</div>
                </div>
                <div class="stat-mini">
                    <div class="stat-number">${s.pending_final_review || 0}</div>
                    <div class="stat-label">待复核</div>
                </div>
                <div class="stat-mini">
                    <div class="stat-number">${s.archived || 0}</div>
                    <div class="stat-label">已归档</div>
                </div>
                <div class="stat-mini" style="${(s.overdue || 0) > 0 ? 'border-left:4px solid var(--danger);' : ''}">
                    <div class="stat-number" style="${(s.overdue || 0) > 0 ? 'color:var(--danger);' : ''}">${s.overdue || 0}</div>
                    <div class="stat-label">逾期</div>
                </div>
            </div>
        `;
    } catch (e) {
        statsHtml = '<p style="color:var(--danger);">统计数据加载失败</p>';
    }

    app.innerHTML = `
        <button class="back-btn" onclick="navigateTo('#list')">← 返回列表</button>
        <div class="page-header"><h2>统计与审计日志</h2></div>
        ${statsHtml}
        <div class="detail-card">
            <div class="section-header">审计日志查询</div>
            <div class="filter-bar">
                <input type="text" id="audit-order-no" placeholder="修订单号" value="${escapeHtml(state.auditFilters.order_no)}">
                <input type="text" id="audit-actor" placeholder="操作人" value="${escapeHtml(state.auditFilters.actor)}">
                <select id="audit-action">
                    <option value="">全部操作</option>
                    <option value="create">创建</option>
                    <option value="advance">推进</option>
                    <option value="return">退回</option>
                    <option value="correct">补正</option>
                    <option value="overdue_process">逾期处理</option>
                    <option value="advance_failed">推进失败</option>
                    <option value="return_failed">退回失败</option>
                    <option value="correct_failed">补正失败</option>
                </select>
                <input type="date" id="audit-start-date" value="${state.auditFilters.start_date}">
                <input type="date" id="audit-end-date" value="${state.auditFilters.end_date}">
                <button class="btn btn-primary btn-small" onclick="handleAuditSearch()">查询</button>
            </div>
        </div>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>修订单号</th>
                        <th>操作类型</th>
                        <th>操作人</th>
                        <th>角色</th>
                        <th>原状态</th>
                        <th>新状态</th>
                        <th>意见/原因</th>
                        <th>失败原因</th>
                        <th>时间</th>
                    </tr>
                </thead>
                <tbody id="audit-tbody">
                    <tr><td colspan="9" class="empty-state"><p>加载中...</p></td></tr>
                </tbody>
            </table>
        </div>
        <div id="audit-pagination-container"></div>
    `;

    document.getElementById('audit-action').value = state.auditFilters.action;

    await fetchAndRenderAuditLogs();
}

async function handleAuditSearch() {
    state.auditFilters.order_no = document.getElementById('audit-order-no')?.value?.trim() || '';
    state.auditFilters.actor = document.getElementById('audit-actor')?.value?.trim() || '';
    state.auditFilters.action = document.getElementById('audit-action')?.value || '';
    state.auditFilters.start_date = document.getElementById('audit-start-date')?.value || '';
    state.auditFilters.end_date = document.getElementById('audit-end-date')?.value || '';
    state.auditFilters.page = 1;
    await fetchAndRenderAuditLogs();
}

async function fetchAndRenderAuditLogs() {
    const tbody = document.getElementById('audit-tbody');
    if (!tbody) return;

    try {
        const data = await getAuditLogs(state.auditFilters);
        const respData = data.data || {};
        const logs = respData.list || [];
        const total = respData.total || 0;
        state.auditLogs = logs;
        state.auditTotal = total;

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><div class="empty-icon">📋</div><p>暂无审计日志</p></td></tr>';
            renderAuditPagination(0);
            return;
        }

        tbody.innerHTML = logs.map(log => {
            const isFailed = log.failure_reason && log.failure_reason !== '';
            const rowClass = isFailed ? 'style="background:#fff5f5;"' : '';
            const actionBadgeClass = isFailed ? 'status-badge failed' : `status-badge ${log.action === 'return' ? 'pending_correction' : log.action === 'advance' || log.action === 'overdue_process' ? 'pending_final_review' : log.action === 'create' ? 'pending_review' : 'archived'}`;
            const failureContent = isFailed 
                ? `${renderFailureTypeTag(log.failure_reason)}<span style="color:var(--danger);">${escapeHtml(classifyFailureReason(log.failure_reason).text)}</span>`
                : '-';
            return `
            <tr ${rowClass}>
                <td>${escapeHtml(log.order_no || '-')}</td>
                <td><span class="${actionBadgeClass}">${formatAction(log.action)}</span></td>
                <td>${escapeHtml(log.actor_name || '-')}</td>
                <td>${formatRole(log.actor_role || '')}</td>
                <td>${formatStatus(log.from_status) || '-'}</td>
                <td>${formatStatus(log.to_status) || '-'}</td>
                <td>${escapeHtml(log.opinion || log.reason || '-')}</td>
                <td>${failureContent}</td>
                <td>${formatDateTime(log.created_at)}</td>
            </tr>
        `}).join('');

        renderAuditPagination(total);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty-state"><p>加载失败：${escapeHtml(e.message)}</p></td></tr>`;
    }
}

function renderAuditPagination(total) {
    const container = document.getElementById('audit-pagination-container');
    if (!container) return;

    const pageSize = state.auditFilters.page_size;
    const totalPages = Math.ceil(total / pageSize);
    const currentPage = state.auditFilters.page;

    if (totalPages <= 1) {
        container.innerHTML = total > 0
            ? `<div class="pagination"><span class="page-info">共 ${total} 条记录</span></div>`
            : '';
        return;
    }

    let pagesHtml = '';
    pagesHtml += `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="goToAuditPage(${currentPage - 1})">上一页</button>`;

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        pagesHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToAuditPage(${i})">${i}</button>`;
    }

    pagesHtml += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="goToAuditPage(${currentPage + 1})">下一页</button>`;

    container.innerHTML = `<div class="pagination">${pagesHtml}<span class="page-info" style="margin-left:12px;">共 ${total} 条</span></div>`;
}

async function goToAuditPage(page) {
    state.auditFilters.page = page;
    await fetchAndRenderAuditLogs();
    window.scrollTo(0, 0);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.addEventListener('hashchange', () => {
    handleRoute(window.location.hash);
});

window.addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash || '#list';
    if (!state.currentRole) {
        handleRoleSwitch('clerk');
    } else {
        handleRoute(hash);
    }
});
