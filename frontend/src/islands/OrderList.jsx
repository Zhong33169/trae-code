import { useState, useEffect } from 'react';
import { getOrders } from '../lib/api';

export default function OrderList({ userId, userRole, onOrderClick, filters, onFiltersChange, refreshKey }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !userRole) return;
    setLoading(true);
    getOrders(userId, userRole, filters)
      .then(res => {
      if (res.success) {
        setOrders(res.data);
      }
    })
    .finally(() => setLoading(false));
  }, [userId, userRole, filters, refreshKey]);

  const getRiskClass = (level) => {
    const map = { high: 'risk-high', medium: 'risk-medium', low: 'risk-low' };
    return map[level] || '';
  };

  const getStatusClass = (status) => {
    return `status-${status}`;
  };

  const getPriorityTag = (level) => {
    const labels = { high: '高优先级', medium: '中优先级', low: '低优先级' };
    return labels[level] || '';
  };

  if (loading) {
    return (
      <div className="order-list">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="order-list">
        <div className="empty-state">暂无订单数据</div>
      </div>
    );
  }

  return (
    <div className="order-list">
      <div className="order-list-header">
        <div>订单编号</div>
        <div>患者信息 / 药品</div>
        <div>风险等级</div>
        <div>状态</div>
        <div>门店</div>
        <div>创建时间</div>
      </div>
      {orders.map(order => (
        <div
          key={order.id}
          className="order-item"
          onClick={() => onOrderClick && onOrderClick(order)}
        >
          <div>
            <span className="order-no">{order.order_no}</span>
            {order.risk_level === 'high' && (
              <span className={`order-priority-tag ${order.risk_level}`}>
                {getPriorityTag(order.risk_level)}
              </span>
            )}
          </div>
          <div>
            <div className="order-patient">{order.patient_name}</div>
            <div className="order-drug">{order.drug_name} {order.drug_spec}</div>
          </div>
          <div>
            <span className={`risk-badge ${getRiskClass(order.risk_level)}`}>
              {order.riskLabel}
            </span>
          </div>
          <div>
            <span className={`status-badge ${getStatusClass(order.status)}`}>
              {order.statusLabel}
            </span>
          </div>
          <div className="order-store">{order.store_name || '-'}</div>
          <div className="order-store">{order.created_at?.slice(0, 16) || '-'}</div>
        </div>
      ))}
    </div>
  );
}
