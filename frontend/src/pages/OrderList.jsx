import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import ScanModal from '../components/ScanModal';
import CreateOrderModal from '../components/CreateOrderModal';
import BatchOperationModal from '../components/BatchOperationModal';
import Toast from '../components/Toast';
import dayjs from 'dayjs';

const statusLabels = {
  draft: '草稿',
  pending_review: '待审核',
  reviewing: '审核中',
  pending_finalize: '待复核',
  finalizing: '复核中',
  completed: '已完成',
  rejected: '已驳回',
  returned: '已退回'
};

const serviceTypeLabels = {
  makeup_class: '补课',
  drop_class: '退课',
  transfer_class: '转课',
  trial_class: '试听'
};

function OrderList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [toast, setToast] = useState({ visible: false, type: 'info', message: '' });

  const showToast = (type, message) => {
    setToast({ visible: true, type, message });
    setTimeout(() => setToast({ visible: false, type: 'info', message: '' }), 3000);
  };

  const formatTimeRemaining = (info) => {
    if (!info || info.deadline === undefined) return <span style={{ color: '#999' }}>-</span>;
    if (info.expired) {
      return <span style={{ color: '#ff4d4f', fontWeight: 500 }}>已超时</span>;
    }
    const hours = info.remaining_hours;
    if (hours < 1) {
      return <span style={{ color: '#fa8c16' }}>{Math.round(hours * 60)} 分钟</span>;
    }
    if (hours < 6) {
      return <span style={{ color: '#fa8c16' }}>{hours.toFixed(1)} 小时</span>;
    }
    return <span style={{ color: '#52c41a' }}>{hours.toFixed(0)} 小时</span>;
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = { page, page_size: pageSize };
      if (statusFilter) params.status = statusFilter;
      if (keyword) params.keyword = keyword;
      
      const res = await api.get('/orders', { params });
      setOrders(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('获取列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/statistics');
      setStats(res.data);
    } catch (err) {
      console.error('获取统计失败:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, [statusFilter, keyword, page]);

  const handleRefresh = () => {
    fetchOrders();
    fetchStats();
    setSelectedIds([]);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(orders.map(o => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id, checked) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const canBatchReview = user?.role === 'reviewer' && selectedIds.length > 0;
  const canBatchFinalize = user?.role === 'finalizer' && selectedIds.length > 0;

  return (
    <div>
      <div className="page-header">
        <h2>课程服务单列表</h2>
        <div className="quick-actions">
          <button className="quick-btn" onClick={() => setScanModalVisible(true)}>
            📱 扫码核验
          </button>
          {user?.role === 'registrar' && (
            <button className="quick-btn primary" onClick={() => setCreateModalVisible(true)}>
              ➕ 新建服务单
            </button>
          )}
          <button className="quick-btn" onClick={handleRefresh}>
            🔄 刷新
          </button>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat-card primary">
          <div className="stat-value">{stats.total || 0}</div>
          <div className="stat-label">全部</div>
        </div>
        <div className="stat-card info">
          <div className="stat-value">{stats.draft || 0}</div>
          <div className="stat-label">草稿</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{stats.pending_review || 0}</div>
          <div className="stat-label">待审核</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{stats.pending_finalize || 0}</div>
          <div className="stat-label">待复核</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{stats.completed || 0}</div>
          <div className="stat-label">已完成</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value">{stats.rejected || 0}</div>
          <div className="stat-label">已驳回</div>
        </div>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          className="search-input"
          placeholder="搜索服务单号、二维码..."
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
        />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">全部状态</option>
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        
        {(canBatchReview || canBatchFinalize) && (
          <div className="batch-actions">
            <span className="batch-count">已选 {selectedIds.length} 项</span>
            <button 
              className="btn btn-sm btn-success" 
              style={{ width: 'auto' }}
              onClick={() => setBatchModalVisible(true)}
            >
              批量{user.role === 'reviewer' ? '审核' : '复核'}
            </button>
          </div>
        )}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              {(user?.role === 'reviewer' || user?.role === 'finalizer') && (
                <th className="checkbox-col">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === orders.length && orders.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              <th>服务单号</th>
              <th>学员</th>
              <th>课程</th>
              <th>服务类型</th>
              <th>材料</th>
              <th>剩余时限</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="10" className="loading">加载中...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan="10" className="empty-state">暂无数据</td></tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  {(user?.role === 'reviewer' || user?.role === 'finalizer') && (
                    <td className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={(e) => handleSelect(order.id, e.target.checked)}
                      />
                    </td>
                  )}
                  <td>{order.order_no}</td>
                  <td>{order.student_name} ({order.student_no})</td>
                  <td>{order.course_name}</td>
                  <td>{serviceTypeLabels[order.service_type] || order.service_type}</td>
                  <td>
                    {order.material_complete ? (
                      <span style={{ color: '#52c41a' }}>✓ 齐全</span>
                    ) : (
                      <span style={{ color: '#fa8c16' }}>⚠ 不完整</span>
                    )}
                  </td>
                  <td>{formatTimeRemaining(order.time_info)}</td>
                  <td>
                    <span className={`status-badge status-${order.status}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  </td>
                  <td>{dayjs(order.created_at).format('YYYY-MM-DD HH:mm')}</td>
                  <td>
                    <span className="action-link" onClick={() => navigate(`/orders/${order.id}`)}>
                      查看详情
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="pagination">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
            >
              上一页
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  className={page === pageNum ? 'active' : ''}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {scanModalVisible && (
        <ScanModal
          visible={scanModalVisible}
          onClose={() => setScanModalVisible(false)}
          onSuccess={(order) => {
            setScanModalVisible(false);
            navigate(`/orders/${order.id}`);
          }}
          onRefresh={handleRefresh}
        />
      )}

      {createModalVisible && (
        <CreateOrderModal
          visible={createModalVisible}
          onClose={() => setCreateModalVisible(false)}
          onSuccess={() => {
            setCreateModalVisible(false);
            handleRefresh();
            showToast('success', '服务单创建成功！');
          }}
        />
      )}

      {batchModalVisible && (
        <BatchOperationModal
          visible={batchModalVisible}
          onClose={() => setBatchModalVisible(false)}
          selectedIds={selectedIds}
          role={user?.role}
          onSuccess={(result) => {
            setBatchModalVisible(false);
            setSelectedIds([]);
            handleRefresh();
            const msg = user?.role === 'reviewer' ? '批量审核' : '批量复核';
            showToast('success', `${msg}完成：成功 ${result?.success_count || 0} 条，跳过 ${result?.skipped_count || 0} 条`);
          }}
        />
      )}

      {toast.visible && (
        <Toast type={toast.type} message={toast.message} />
      )}
    </div>
  );
}

export default OrderList;
