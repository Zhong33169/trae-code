import { useState, useEffect } from 'react';
import UserSelector from './UserSelector';
import StatsPanel from './StatsPanel';
import OrderList from './OrderList';
import OrderDetail from './OrderDetail';

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'pending_audit', label: '待审核' },
  { value: 'auditing', label: '审核中' },
  { value: 'returned', label: '退回补正' },
  { value: 'pending_review', label: '待复核' },
  { value: 'reviewing', label: '复核中' },
  { value: 'archived', label: '已归档' },
  { value: 'rejected', label: '已驳回' },
  { value: 'overdue', label: '已逾期' }
];

const RISK_OPTIONS = [
  { value: 'all', label: '全部风险' },
  { value: 'high', label: '高风险' },
  { value: 'medium', label: '中风险' },
  { value: 'low', label: '低风险' }
];

export default function App() {
  const [currentUser, setCurrentUser] = useState({
    id: 'user-aud-1',
    name: '张审核',
    role: 'auditor',
    roleLabel: '处方审核主管'
  });
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState({
    status: 'all',
    riskLevel: 'all',
    keyword: ''
  });

  const handleUserChange = (user) => {
    setCurrentUser(user);
    setSelectedOrderId(null);
    setFilters({ status: 'all', riskLevel: 'all', keyword: '' });
    setRefreshKey(k => k + 1);
  };

  const handleOrderClick = (order) => {
    setSelectedOrderId(order.id);
  };

  const handleBack = () => {
    setSelectedOrderId(null);
  };

  const handleActionComplete = () => {
    setRefreshKey(k => k + 1);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>💊 连锁药房风险分级处置处方订单系统</h1>
        <UserSelector currentUserId={currentUser.id} onUserChange={handleUserChange} />
      </div>

      {selectedOrderId ? (
        <OrderDetail
          orderId={selectedOrderId}
          userId={currentUser.id}
          userRole={currentUser.role}
          onBack={handleBack}
          onActionComplete={handleActionComplete}
        />
      ) : (
        <>
          <StatsPanel
            userId={currentUser.id}
            userRole={currentUser.role}
          />

          <div className="filter-bar">
            <div className="filter-item">
              <label>状态：</label>
              <select
                value={filters.status}
                onChange={e => handleFilterChange('status', e.target.value)}
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="filter-item">
              <label>风险等级：</label>
              <select
                value={filters.riskLevel}
                onChange={e => handleFilterChange('riskLevel', e.target.value)}
              >
                {RISK_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="filter-item">
              <label>搜索：</label>
              <input
                type="text"
                placeholder="订单号/患者/药品"
                value={filters.keyword}
                onChange={e => handleFilterChange('keyword', e.target.value)}
              />
            </div>
          </div>

          <OrderList
            userId={currentUser.id}
            userRole={currentUser.role}
            onOrderClick={handleOrderClick}
            filters={filters}
            refreshKey={refreshKey}
          />
        </>
      )}
    </div>
  );
}
