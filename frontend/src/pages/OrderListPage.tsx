import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import * as api from '../api';
import type { CrossBorderOrder, Statistics } from '../types';
import { STATUS_TEXT, STATUS_COLOR } from '../types';
import { BatchModal } from '../components/BatchModal';

export function OrderListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<CrossBorderOrder[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [overdueFilter, setOverdueFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchMode, setBatchMode] = useState<'submit' | 'supervisor' | 'reviewer'>('submit');

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersData, statsData] = await Promise.all([
        api.getOrders({ status: statusFilter || undefined, overdue: overdueFilter || undefined }),
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
  }, [statusFilter, overdueFilter]);

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
    const diffMs = d.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
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
          {user?.role === 'registrar' && (
            <div className="stat-card warning">
              <div className="stat-card-title">已退回</div>
              <div className="stat-card-value">{stats.overdueCount > 0 ? Math.floor(stats.overdueCount / 2) : 0}</div>
            </div>
          )}
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
          <button className="btn btn-default btn-sm" onClick={loadData}>
            刷新
          </button>
        </div>
      </div>

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
              <th>平台</th>
              <th>目的国</th>
              <th>金额</th>
              <th>状态</th>
              <th>处理时限</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="empty-state">加载中...</td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-state">暂无订单</td>
              </tr>
            ) : (
              orders.map((order) => {
                const deadlineStatus = getDeadlineStatus(order);
                return (
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
                    <td>{order.platform}</td>
                    <td>{order.buyerCountry}</td>
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
                      <div style={{ color: deadlineStatus === 'overdue' ? '#ff4d4f' : deadlineStatus === 'warning' ? '#faad14' : '#333' }}>
                        {formatDeadline(order.deadline)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        {new Date(order.deadline).toLocaleString('zh-CN')}
                      </div>
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
