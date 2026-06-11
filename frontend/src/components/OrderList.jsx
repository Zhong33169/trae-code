import { useState, useEffect, useMemo } from 'preact/hooks';
import { api } from '../api.js';
import OrderForm from './OrderForm.jsx';
import BatchActionModal from './BatchActionModal.jsx';

function formatAmount(n) {
  return '¥' + Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch (e) { return iso; }
}

function computeDeadline(order, stageTimeoutHours) {
  const timeout = stageTimeoutHours?.[order.status];
  if (!timeout || !order.stageEnteredAt) return { hasDeadline: false };
  const entered = new Date(order.stageEnteredAt);
  const deadline = new Date(entered.getTime() + timeout * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = deadline - now;
  const diffHours = diffMs / (60 * 60 * 1000);
  return {
    hasDeadline: true,
    deadline,
    remainingHours: diffHours,
    timeoutHours: timeout,
    overdue: diffMs <= 0,
  };
}

export default function OrderList({ meta, user, navigate, showToast }) {
  const [filters, setFilters] = useState({ status: '', store: '', overdue: '', keyword: '' });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [listResult, setListResult] = useState({ total: 0, data: [] });
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [lockTokens, setLockTokens] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [batchAction, setBatchAction] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const role = user.role;

  const visibleStatuses = useMemo(() => {
    if (!meta) return [];
    const all = meta.statuses || [];
    const map = {
      registrar: ['draft', 'pending_verification', 'verification_rejected', 'pending_review', 'review_rejected', 'archived', 'cancelled'],
      supervisor: ['pending_verification', 'verification_rejected', 'pending_review', 'review_rejected', 'archived'],
      reviewer: ['pending_review', 'review_rejected', 'archived'],
    };
    const allow = map[role] || [];
    return all.filter(s => allow.includes(s.value));
  }, [meta, role]);

  async function loadData() {
    setLoading(true);
    try {
      const [list, stats] = await Promise.all([
        api.listOrders({ ...filters, page, pageSize }),
        api.statistics(),
      ]);
      setListResult(list);
      setStatistics(stats);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [filters, page, refreshKey, role]);

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === listResult.data.length && listResult.data.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(listResult.data.map(o => o.id)));
    }
  }

  async function ensureLocks(orderIds) {
    const newTokens = {};
    const arr = Array.isArray(orderIds) ? orderIds : [orderIds];
    for (const id of arr) {
      if (lockTokens[id]) {
        newTokens[id] = lockTokens[id];
        continue;
      }
      try {
        const res = await api.lockOrder(id);
        newTokens[id] = res.lockToken;
      } catch (e) {
        showToast(`单据锁定失败：${e.message}`, 'error');
      }
    }
    setLockTokens(prev => ({ ...prev, ...newTokens }));
    return newTokens;
  }

  async function openDetail(id) {
    await ensureLocks(id);
    navigate('detail', { id });
  }

  function openBatch(action) {
    setBatchAction(action);
    setShowBatch(true);
  }

  async function handleBatchDone({ action, opinion }) {
    const ids = Array.from(selected);
    const tokens = await ensureLocks(ids);
    try {
      const res = await api.batch({
        action,
        orderIds: ids,
        opinion,
        lockTokens: ids.map(id => tokens[id]),
      });
      if (res.success.length > 0) {
        showToast(`批量${action.startsWith('approve') ? '通过' : action.startsWith('reject') ? '退回' : '提交'} ${res.success.length} 条成功`, 'success');
      }
      if (res.failed.length > 0) {
        const reasons = res.failed.slice(0, 3).map(f => `${f.orderNo || f.orderId.slice(0,8)}：${f.reason}`).join('；');
        showToast(`失败 ${res.failed.length} 条：${reasons}${res.failed.length > 3 ? '...' : ''}`, 'error');
      }
      setSelected(new Set());
      setShowBatch(false);
      setBatchAction(null);
      setRefreshKey(k => k + 1);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  const myToDoStatuses = {
    registrar: ['draft', 'verification_rejected'],
    supervisor: ['pending_verification', 'review_rejected'],
    reviewer: ['pending_review'],
  }[role] || [];

  const batchAllowed = useMemo(() => {
    const statusCounts = {};
    for (const id of selected) {
      const o = listResult.data.find(x => x.id === id);
      if (o) statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    }
    const statuses = Object.keys(statusCounts);
    const actions = new Set();
    if (role === 'supervisor') {
      if (statuses.includes('pending_verification') || statuses.includes('review_rejected')) {
        actions.add('approve_verify');
        actions.add('reject_verify');
      }
    }
    if (role === 'reviewer') {
      if (statuses.includes('pending_review')) {
        actions.add('approve_review');
        actions.add('reject_review');
      }
    }
    if (role === 'registrar') {
      if (statuses.every(s => s === 'draft' || s === 'verification_rejected')) {
        actions.add('submit');
      }
    }
    return Array.from(actions);
  }, [selected, listResult.data, role]);

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card primary">
          <div className="stat-label">我的待办</div>
          <div className="stat-value">{statistics?.myToDo ?? 0}</div>
          <div className="stat-sub">当前角色需要处理的单据</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">逾期单据</div>
          <div className="stat-value">{statistics?.overdueCount ?? 0}</div>
          <div className="stat-sub">超过时限需立即处理或延期</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">单据总数</div>
          <div className="stat-value">{statistics?.total ?? 0}</div>
          <div className="stat-sub">累计录入订货单</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">已归档</div>
          <div className="stat-value">{statistics?.byStatus?.archived ?? 0}</div>
          <div className="stat-sub">复核通过完成归档</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">订货总金额</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{formatAmount(statistics?.totalAmount)}</div>
          <div className="stat-sub">所有单据累计</div>
        </div>
      </div>

      <div className="page-title-row">
        <h2>门店订货单列表</h2>
        <div>
          {role === 'registrar' && (
            <button className="btn-primary" onClick={() => setShowCreate(true)}>＋ 新建订货单</button>
          )}
          <button onClick={() => setRefreshKey(k => k + 1)} style={{ marginLeft: 8 }}>🔄 刷新</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-item">
          <label>状态：</label>
          <select value={filters.status} onChange={(e) => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}>
            <option value="">全部</option>
            {visibleStatuses.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <label>门店：</label>
          <select value={filters.store} onChange={(e) => { setFilters(f => ({ ...f, store: e.target.value })); setPage(1); }}>
            <option value="">全部</option>
            {(meta?.stores || []).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <label>逾期：</label>
          <select value={filters.overdue} onChange={(e) => { setFilters(f => ({ ...f, overdue: e.target.value })); setPage(1); }}>
            <option value="">全部</option>
            <option value="true">仅逾期</option>
            <option value="false">未逾期</option>
          </select>
        </div>
        <div className="filter-item">
          <label>搜索：</label>
          <input
            placeholder="单号 / 标题 / 门店"
            value={filters.keyword}
            onChange={(e) => { setFilters(f => ({ ...f, keyword: e.target.value })); setPage(1); }}
          />
        </div>
        <div className="spacer" />
        <button onClick={() => { setFilters({ status: '', store: '', overdue: '', keyword: '' }); setPage(1); }}>重置筛选</button>
        <button onClick={() => setFilters(f => ({ ...f, status: myToDoStatuses[0] || '', overdue: '' }))} className="btn-sm">看我的待办</button>
      </div>

      {selected.size > 0 && (
        <div className="batch-bar">
          <div className="selected-info">
            已选 {selected.size} 张单据
          </div>
          <div className="batch-actions">
            {batchAllowed.length === 0 ? (
              <span style={{ color: 'var(--gray-500)', fontSize: 12 }}>所选单据状态不一致或当前角色无权批量处理</span>
            ) : (
              batchAllowed.map(action => (
                <button
                  key={action}
                  className={action.startsWith('approve') ? 'btn-success' : action.startsWith('reject') ? 'btn-warning' : 'btn-primary'}
                  onClick={() => openBatch(action)}
                >
                  {action === 'approve_verify' && '批量核验通过'}
                  {action === 'reject_verify' && '批量核验退回'}
                  {action === 'approve_review' && '批量复核归档'}
                  {action === 'reject_review' && '批量复核退回'}
                  {action === 'submit' && '批量提交'}
                </button>
              ))
            )}
            <button className="btn-sm" onClick={() => setSelected(new Set())}>取消选择</button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={listResult.data.length > 0 && selected.size === listResult.data.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>单号</th>
              <th>标题 / 门店</th>
              <th>品类 / 供应商</th>
              <th>金额</th>
              <th>状态 / 阶段</th>
              <th>时限 / 逾期</th>
              <th>推进情况</th>
              <th style={{ width: 160 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="9" className="empty">加载中...</td></tr>
            )}
            {!loading && listResult.data.length === 0 && (
              <tr><td colSpan="9" className="empty">暂无数据</td></tr>
            )}
            {!loading && listResult.data.map(o => {
              const dl = computeDeadline(o, meta?.stageTimeoutHours);
              const statusLabel = meta?.statusNames?.[o.status] || o.status;
              const colorMap = {
                draft: 'gray', pending_verification: 'blue', verification_rejected: 'orange',
                pending_review: 'purple', review_rejected: 'red', archived: 'green', cancelled: 'gray',
              };
              const isMyTodo = myToDoStatuses.includes(o.status);
              return (
                <tr key={o.id} className={o.overdue ? 'overdue-row' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggleSelect(o.id)}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.orderNo}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                      更新 {formatTime(o.updatedAt)}
                    </div>
                  </td>
                  <td>
                    <div>
                      {isMyTodo && <span className="tag blue" style={{ marginRight: 4 }}>待我</span>}
                      <a onClick={() => openDetail(o.id)}>{o.title}</a>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 2 }}>{o.store}</div>
                  </td>
                  <td>
                    <div>{o.category}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{o.supplier}</div>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--danger)' }}>
                    {formatAmount(o.totalAmount)}
                  </td>
                  <td>
                    <span className={`tag ${colorMap[o.status] || 'gray'}`}>{statusLabel}</span>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 3 }}>
                      当前：{o.currentStage}
                    </div>
                  </td>
                  <td>
                    {dl.hasDeadline ? (
                      <div>
                        <div className={`stage-time-card ${o.overdue ? 'overdue' : ''}`} style={{ padding: '4px 6px' }}>
                          <div>
                            <div className="time-label">截止 {formatTime(dl.deadline.toISOString())}</div>
                            <div className="time-deadline">
                              {o.overdue
                                ? `已逾期 ${Math.abs(Math.floor(dl.remainingHours))} 小时`
                                : dl.remainingHours < 2
                                  ? `剩 ${(dl.remainingHours * 60).toFixed(0)} 分钟`
                                  : `剩 ${dl.remainingHours.toFixed(1)} 小时`
                              }
                            </div>
                          </div>
                        </div>
                        {o.overdue && o.overdueReason && (
                          <div className="overdue-reason">⚠ {o.overdueReason}</div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>无时限</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {o.overdue ? (
                      <div className="alert warning" style={{ padding: '6px 8px', margin: 0 }}>
                        ❌ 无法推进：已超过时限，需先申请延期或在详情页立即处理
                      </div>
                    ) : (
                      <ProgressHint order={o} meta={meta} role={role} />
                    )}
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn-sm btn-primary" onClick={() => openDetail(o.id)}>查看 / 处理</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="pagination">
          <div>共 {listResult.total} 条，第 {page} / {listResult.totalPages || 1} 页</div>
          <div className="pages">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>上一页</button>
            <button disabled={page >= (listResult.totalPages || 1)} onClick={() => setPage(p => p + 1)}>下一页</button>
          </div>
        </div>
      </div>

      {showCreate && (
        <OrderForm
          mode="create"
          meta={meta}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            showToast('订货单已创建', 'success');
            setRefreshKey(k => k + 1);
          }}
          showToast={showToast}
        />
      )}

      {showBatch && (
        <BatchActionModal
          action={batchAction}
          selectedCount={selected.size}
          role={role}
          meta={meta}
          onClose={() => { setShowBatch(false); setBatchAction(null); }}
          onConfirm={handleBatchDone}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function ProgressHint({ order, meta, role }) {
  const roleActions = {
    registrar: {
      draft: { ok: true, label: '可提交核验，材料齐全即可推进' },
      verification_rejected: { ok: true, label: '按退回原因补正后可重新提交' },
      pending_verification: { ok: false, label: '等待审核主管核验' },
      pending_review: { ok: false, label: '等待总部复核负责人归档' },
      review_rejected: { ok: false, label: '复核退回，等待主管重核' },
      archived: { ok: false, label: '已归档，流程结束' },
      cancelled: { ok: false, label: '已作废' },
    },
    supervisor: {
      pending_verification: { ok: true, label: '核验材料齐全即可推进至复核或退回' },
      review_rejected: { ok: true, label: '复核退回，需重核后再次提交' },
      verification_rejected: { ok: false, label: '等待登记员补正' },
      pending_review: { ok: false, label: '等待总部复核归档' },
      archived: { ok: false, label: '已归档' },
    },
    reviewer: {
      pending_review: { ok: true, label: '复核材料齐全即可归档或退回' },
      review_rejected: { ok: false, label: '退回中，等待主管重核' },
      archived: { ok: false, label: '已归档' },
    },
  };
  const h = roleActions[role]?.[order.status];
  if (!h) return <span style={{ color: 'var(--gray-400)' }}>-</span>;
  return (
    <div style={{
      padding: '5px 8px',
      borderRadius: 4,
      background: h.ok ? '#f0fdf4' : '#f3f4f6',
      color: h.ok ? '#166534' : 'var(--gray-600)',
      border: `1px solid ${h.ok ? '#bbf7d0' : 'var(--gray-200)'}`,
      fontSize: 11,
      lineHeight: 1.5,
    }}>
      {h.ok ? '✅ ' : '⏳ '}{h.label}
    </div>
  );
}
