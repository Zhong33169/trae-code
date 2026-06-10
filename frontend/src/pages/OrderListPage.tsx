import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import * as api from '../api';
import type { CrossBorderOrder, Statistics, BlockReason } from '../types';
import {
  STATUS_TEXT,
  STATUS_COLOR,
  LISTING_TEXT,
  LISTING_COLOR,
  INVENTORY_TEXT,
  INVENTORY_COLOR,
  BLOCK_FIELD_TEXT,
} from '../types';
import { BatchModal } from '../components/BatchModal';

export function OrderListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<CrossBorderOrder[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [overdueFilter, setOverdueFilter] = useState('');
  const [blockedFilter, setBlockedFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchMode, setBatchMode] = useState<'submit' | 'supervisor' | 'reviewer'>('submit');
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersData, statsData] = await Promise.all([
        api.getOrders({
          status: statusFilter || undefined,
          overdue: overdueFilter || undefined,
          blocked: blockedFilter || undefined,
        }),
        api.getStatistics(),
      ]);
      setOrders(ordersData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setStats(statsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, overdueFilter, blockedFilter]);

  const getDeadlineStatus = (order: CrossBorderOrder) => {
    if (order.status === 'archived') return 'normal';
    if (order.isOverdue) return 'overdue';
    const now = new Date();
    const deadline = new Date(order.deadline);
    const diffMs = deadline.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours <= order.warningHours && diffHours > 0) return 'warning';
    return 'normal';
  };

  const formatDeadline = (deadline: string) => {
    const d = new Date(deadline);
    const now = new Date();
    let diffMs = d.getTime() - now.getTime();
    let diffHours = diffMs / (1000 * 60 * 60);

    let prefix = '';
    if (diffMs < 0) {
      prefix = '已逾期 ';
      diffHours = Math.abs(diffHours);
    } else {
      prefix = '剩余 ';
    }

    if (Math.abs(diffHours) < 1) {
      return `${prefix}${Math.floor(Math.abs(diffHours) * 60)} 分钟`;
    } else if (Math.abs(diffHours) < 24) {
      return `${prefix}${Math.floor(Math.abs(diffHours))} 小时`;
    } else {
      return `${prefix}${Math.floor(Math.abs(diffHours) / 24)} 天 ${Math.floor(Math.abs(diffHours) % 24)} 小时`;
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)));
    }
  };

  const toggleBlocksExpand = (id: string) => {
    const newExp = new Set(expandedBlocks);
    if (newExp.has(id)) {
      newExp.delete(id);
    } else {
      newExp.add(id);
    }
    setExpandedBlocks(newExp);
  };

  const canBatchSubmit = user?.role === 'registrar' && selectedIds.size > 0 &&
    orders.filter(o => selectedIds.has(o.id)).every(o => o.status === 'draft' || o.status === 'returned');

  const canBatchSupervisor = user?.role === 'supervisor' && selectedIds.size > 0 &&
    orders.filter(o => selectedIds.has(o.id)).every(o => o.status === 'pending');

  const canBatchReviewer = user?.role === 'reviewer' && selectedIds.size > 0 &&
    orders.filter(o => selectedIds.has(o.id)).every(o => o.status === 'processing');

  const openBatchModal = (mode: 'submit' | 'supervisor' | 'reviewer') => {
    setBatchMode(mode);
    setBatchModalOpen(true);
  };

  const getSelectedOrders = () => {
    return orders.filter(o => selectedIds.has(o.id));
  };

  const selectedOrders = getSelectedOrders();
  const selectedBlockedCount = selectedOrders.filter(o => o.blockReasons?.some(b => b.level === 'error')).length;
  const selectedOverdueCount = selectedOrders.filter(o => o.isOverdue).length;

  const selectedAllowedActions: string[] = [];
  const selectedForbiddenActions: { action: string; reason: string }[] = [];

  if (user?.role === 'registrar') {
    const allDraftOrReturned = selectedOrders.every(o => o.status === 'draft' || o.status === 'returned');
    const hasBlocked = selectedOrders.some(o => o.blockReasons?.some(b => b.level === 'error'));
    if (allDraftOrReturned) {
      if (hasBlocked) {
        selectedForbiddenActions.push({ action: '批量提交', reason: `${selectedBlockedCount}单有阻断项，需解除后再提交` });
      } else {
        selectedAllowedActions.push('批量提交');
      }
    } else {
      selectedForbiddenActions.push({ action: '批量提交', reason: '存在非草稿/已退回状态的订单' });
    }
  }

  if (user?.role === 'supervisor') {
    const allPending = selectedOrders.every(o => o.status === 'pending');
    const hasBlocked = selectedOrders.some(o => o.blockReasons?.some(b => b.level === 'error'));
    const hasOverdue = selectedOrders.some(o => o.isOverdue);
    if (allPending) {
      if (hasBlocked || hasOverdue) {
        const reasons: string[] = [];
        if (hasOverdue) reasons.push(`${selectedOverdueCount}单逾期`);
        if (hasBlocked) reasons.push(`${selectedBlockedCount}单有阻断`);
        selectedForbiddenActions.push({ action: '批量通过', reason: reasons.join('、') + '，请逐单退回或人工处置' });
        selectedAllowedActions.push('批量退回');
      } else {
        selectedAllowedActions.push('批量通过');
        selectedAllowedActions.push('批量退回');
      }
    } else {
      selectedForbiddenActions.push({ action: '批量审核', reason: '存在非待审核状态的订单' });
    }
  }

  if (user?.role === 'reviewer') {
    const allProcessing = selectedOrders.every(o => o.status === 'processing');
    const hasBlocked = selectedOrders.some(o => o.blockReasons?.some(b => b.level === 'error'));
    if (allProcessing) {
      if (hasBlocked) {
        selectedForbiddenActions.push({ action: '批量通过', reason: `${selectedBlockedCount}单有阻断，需逐单人工处置` });
        selectedAllowedActions.push('批量退回');
      } else {
        selectedAllowedActions.push('批量通过');
        selectedAllowedActions.push('批量退回');
      }
      selectedAllowedActions.push('人工处置（逐单）');
    } else {
      selectedForbiddenActions.push({ action: '批量复核', reason: '存在非待复核状态的订单' });
    }
  }

  const renderBlockBadges = (blocks: BlockReason[]) => {
    const errors = blocks.filter(b => b.level === 'error');
    if (errors.length === 0) return null;
    return (
      <div className="block-badges">
        {errors.slice(0, 2).map((b, i) => (
          <span key={i} className="block-badge block-error">
            {BLOCK_FIELD_TEXT[b.field]}
          </span>
        ))}
        {errors.length > 2 && (
          <span className="block-badge block-error">+{errors.length - 2}</span>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">跨境订单列表</h1>
        <div className="page-actions">
          {user?.role === 'registrar' && (
            <button className="btn btn-primary" onClick={() => navigate('/orders/new')}>
              + 新建订单
            </button>
          )}
          {canBatchSubmit && (
            <button className="btn btn-primary" onClick={() => openBatchModal('submit')}>
              批量提交 ({selectedIds.size})
            </button>
          )}
          {canBatchSupervisor && (
            <button className="btn btn-primary" onClick={() => openBatchModal('supervisor')}>
              批量审核 ({selectedIds.size})
            </button>
          )}
          {canBatchReviewer && (
            <button className="btn btn-primary" onClick={() => openBatchModal('reviewer')}>
              批量复核 ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {stats && (
        <div className="stats-bar">
          <div className="stat-card info">
            <div className="stat-card-title">全部订单</div>
            <div className="stat-card-value">{stats.totalCount}</div>
          </div>
          {user?.role === 'supervisor' && (
            <div className="stat-card">
              <div className="stat-card-title">待审核</div>
              <div className="stat-card-value">{stats.pendingCount}</div>
            </div>
          )}
          {user?.role === 'reviewer' && (
            <div className="stat-card">
              <div className="stat-card-title">待复核</div>
              <div className="stat-card-value">{stats.processingCount}</div>
            </div>
          )}
          <div className="stat-card danger">
            <div className="stat-card-title">阻断推进</div>
            <div className="stat-card-value">{stats.blockedCount}</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-card-title">即将到期</div>
            <div className="stat-card-value">{stats.warningCount}</div>
          </div>
          <div className="stat-card danger">
            <div className="stat-card-title">已逾期</div>
            <div className="stat-card-value">{stats.overdueCount}</div>
          </div>
          <div className="stat-card success">
            <div className="stat-card-title">已归档</div>
            <div className="stat-card-value">{stats.archivedCount}</div>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">状态：</span>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">全部状态</option>
            {user?.role === 'registrar' && <option value="draft">草稿</option>}
            <option value="pending">待审核</option>
            <option value="returned">已退回</option>
            <option value="processing">待复核</option>
            <option value="archived">已归档</option>
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">时限：</span>
          <select
            className="filter-select"
            value={overdueFilter}
            onChange={(e) => setOverdueFilter(e.target.value)}
          >
            <option value="">全部</option>
            <option value="true">仅看逾期</option>
            <option value="false">未逾期</option>
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">阻断：</span>
          <select
            className="filter-select"
            value={blockedFilter}
            onChange={(e) => setBlockedFilter(e.target.value)}
          >
            <option value="">全部</option>
            <option value="true">有阻断</option>
            <option value="false">无阻断</option>
          </select>
        </div>
        <div className="filter-group">
          <button className="btn btn-default btn-sm" onClick={loadData}>
            刷新
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="card selection-summary">
          <div className="card-title" style={{ marginBottom: '8px' }}>
            已选中 {selectedIds.size} 单
            {selectedBlockedCount > 0 && (
              <span style={{ color: '#cf1322', marginLeft: '12px', fontSize: '13px' }}>
                其中 {selectedBlockedCount} 单存在阻断项
              </span>
            )}
            {selectedOverdueCount > 0 && (
              <span style={{ color: '#cf1322', marginLeft: '8px', fontSize: '13px' }}>
                {selectedOverdueCount} 单已逾期
              </span>
            )}
          </div>
          {selectedAllowedActions.length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              <span style={{ color: '#389e0d', fontWeight: 500, marginRight: '8px' }}>✓ 允许动作：</span>
              {selectedAllowedActions.map((a, i) => (
                <span key={i} style={{ marginRight: '16px', color: '#389e0d' }}>{a}</span>
              ))}
            </div>
          )}
          {selectedForbiddenActions.length > 0 && (
            <div>
              <span style={{ color: '#cf1322', fontWeight: 500, marginRight: '8px' }}>✕ 禁止动作：</span>
              {selectedForbiddenActions.map((a, i) => (
                <span key={i} style={{ marginRight: '16px', color: '#cf1322' }}>
                  {a.action}（{a.reason}）
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="order-table">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={orders.length > 0 && selectedIds.size === orders.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>订单号</th>
              <th>商品名称</th>
              <th>刊登状态</th>
              <th>库存状态</th>
              <th>金额</th>
              <th>状态</th>
              <th>阻断原因</th>
              <th>处理时限</th>
              <th>后续动作</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="empty-state">加载中...</td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={11} className="empty-state">暂无订单</td>
              </tr>
            ) : (
              orders.map((order) => {
                const deadlineStatus = getDeadlineStatus(order);
                const blocksExpanded = expandedBlocks.has(order.id);
                return (
                  <Fragment key={order.id}>
                    <tr
                      key={order.id}
                      className={deadlineStatus === 'overdue' ? 'overdue' : deadlineStatus === 'warning' ? 'warning' : ''}
                    >
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selectedIds.has(order.id)}
                          onChange={() => toggleSelect(order.id)}
                        />
                      </td>
                      <td>
                        <a onClick={() => navigate(`/orders/${order.id}`)} style={{ cursor: 'pointer' }}>
                          {order.orderNo}
                        </a>
                      </td>
                      <td>{order.productName}</td>
                      <td>
                        <span
                          className="status-tag"
                          style={{
                            background: LISTING_COLOR[order.listingStatus] + '20',
                            color: LISTING_COLOR[order.listingStatus],
                            border: `1px solid ${LISTING_COLOR[order.listingStatus]}40`,
                          }}
                        >
                          {LISTING_TEXT[order.listingStatus]}
                        </span>
                      </td>
                      <td>
                        <span
                          className="status-tag"
                          style={{
                            background: INVENTORY_COLOR[order.inventoryStatus] + '20',
                            color: INVENTORY_COLOR[order.inventoryStatus],
                            border: `1px solid ${INVENTORY_COLOR[order.inventoryStatus]}40`,
                          }}
                        >
                          {INVENTORY_TEXT[order.inventoryStatus]}
                        </span>
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                          {order.inventoryQuantity}/{order.quantity}
                        </div>
                      </td>
                      <td>
                        {order.currency} {order.amount.toFixed(2)}
                      </td>
                      <td>
                        <span
                          className="status-tag"
                          style={{
                            background: STATUS_COLOR[order.status] + '20',
                            color: STATUS_COLOR[order.status],
                            border: `1px solid ${STATUS_COLOR[order.status]}40`,
                          }}
                        >
                          {STATUS_TEXT[order.status]}
                        </span>
                        {order.isOverdue && (
                          <span className="status-tag overdue" style={{ marginLeft: '4px' }}>
                            已逾期
                          </span>
                        )}
                      </td>
                      <td>
                        {order.blockReasons && order.blockReasons.length > 0 ? (
                          <>
                            {renderBlockBadges(order.blockReasons)}
                            <button
                              className="link-btn"
                              onClick={() => toggleBlocksExpand(order.id)}
                              style={{ marginTop: '4px' }}
                            >
                              {blocksExpanded ? '收起' : '展开原因'}
                            </button>
                          </>
                        ) : (
                          <span style={{ color: '#999' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ color: deadlineStatus === 'overdue' ? '#ff4d4f' : deadlineStatus === 'warning' ? '#faad14' : '#333' }}>
                          {formatDeadline(order.deadline)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {new Date(order.deadline).toLocaleString('zh-CN')}
                        </div>
                      </td>
                      <td>
                        {order.nextAction ? (
                          <div style={{
                            padding: '6px 10px',
                            background: order.isOverdue ? '#fff1f0' : '#e6f7ff',
                            border: `1px solid ${order.isOverdue ? '#ffa39e' : '#91d5ff'}`,
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: order.isOverdue ? '#cf1322' : '#096dd9',
                            maxWidth: '200px',
                          }}>
                            {order.nextAction}
                          </div>
                        ) : (
                          <span style={{ color: '#999' }}>—</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-default btn-sm"
                          onClick={() => navigate(`/orders/${order.id}`)}
                        >
                          详情
                        </button>
                      </td>
                    </tr>
                    {blocksExpanded && order.blockReasons && order.blockReasons.length > 0 && (
                      <tr className="blocks-expand-row">
                        <td colSpan={11}>
                          <div className="blocks-expand-box">
                            <div style={{ fontWeight: 600, marginBottom: '8px' }}>阻断原因明细：</div>
                            {order.blockReasons.map((b, i) => (
                              <div
                                key={i}
                                className={`block-row ${b.level === 'error' ? 'block-row-error' : b.level === 'warning' ? 'block-row-warn' : ''}`}
                              >
                                <span className="block-field-tag" style={{
                                  background: b.level === 'error' ? '#ff4d4f20' : '#faad1420',
                                  color: b.level === 'error' ? '#cf1322' : '#d46b08',
                                  border: `1px solid ${b.level === 'error' ? '#ffa39e' : '#ffd591'}`,
                                }}>
                                  {BLOCK_FIELD_TEXT[b.field]}
                                </span>
                                <span style={{ marginLeft: '8px' }}>{b.reason}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {batchModalOpen && (
        <BatchModal
          mode={batchMode}
          orders={getSelectedOrders()}
          onClose={() => setBatchModalOpen(false)}
          onSuccess={() => {
            setSelectedIds(new Set());
            loadData();
          }}
        />
      )}
    </div>
  );
}
