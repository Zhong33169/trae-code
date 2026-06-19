import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { route } from 'preact-router';
import { fetchOrders } from '../api/client';
import RiskBadge from './RiskBadge';
import CreateOrderModal from './CreateOrderModal';

const STATUS_MAP = {
  draft: '待发起',
  pending_process: '待办理',
  pending_review: '待复核',
  stage_completed: '阶段完成',
  completed: '已完成',
  returned: '已退回',
  overdue: '逾期',
  conflict: '状态冲突',
};

const STAGE_MAP = {
  refund: '售后退款',
  warehouse: '仓库核实',
  followup: '客服回访',
};

const STEP_MAP = {
  initiate: '发起/补正',
  process: '办理',
  review: '复核归档',
};

export default function QueueList({ currentUser }) {
  const [orders, setOrders] = useState([]);
  const [riskTab, setRiskTab] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    try {
      const filters = {};
      if (riskTab) filters.risk_level = riskTab;
      if (stageFilter) filters.stage = stageFilter;
      if (statusFilter) filters.status = statusFilter;
      const data = await fetchOrders(filters);
      setOrders(data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [riskTab, stageFilter, statusFilter]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 10000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const isOverdue = (deadline) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const riskTabs = [
    { key: '', label: '全部' },
    { key: 'high', label: '高风险' },
    { key: 'medium', label: '中风险' },
    { key: 'low', label: '低风险' },
  ];

  return (
    <div class="page-container">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h1 class="page-title">处理队列</h1>
        <button class="btn-primary" onClick={() => setShowCreate(true)}>
          + 新建处理单
        </button>
      </div>

      <div class="card">
        <div style="display:flex;gap:8px;margin-bottom:16px;">
          {riskTabs.map((t) => (
            <button
              key={t.key}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: '1px solid #d9d9d9',
                background: riskTab === t.key ? '#1890ff' : '#fff',
                color: riskTab === t.key ? '#fff' : '#333',
                cursor: 'pointer',
                fontSize: 13,
              }}
              onClick={() => setRiskTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div class="filter-bar">
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            <option value="">全部阶段</option>
            <option value="refund">售后退款</option>
            <option value="warehouse">仓库核实</option>
            <option value="followup">客服回访</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">全部状态</option>
            <option value="draft">待发起</option>
            <option value="pending_process">待办理</option>
            <option value="pending_review">待复核</option>
            <option value="returned">已退回</option>
            <option value="overdue">逾期</option>
            <option value="conflict">冲突</option>
          </select>
        </div>

        {loading ? (
          <div class="loading">加载中...</div>
        ) : orders.length === 0 ? (
          <div class="empty-state">暂无数据</div>
        ) : (
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th>单号</th>
                  <th>客户</th>
                  <th>商品</th>
                  <th>金额</th>
                  <th>风险等级</th>
                  <th>当前阶段</th>
                  <th>当前步骤</th>
                  <th>状态</th>
                  <th>处理人</th>
                  <th>截止日期</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const overdue = isOverdue(order.deadline);
                  return (
                    <tr
                      key={order.id}
                      class={order.risk_level === 'high' ? 'row-high-risk' : ''}
                    >
                      <td>{order.order_no}</td>
                      <td>{order.customer_name}</td>
                      <td>{order.product_name}</td>
                      <td>¥{Number(order.order_amount).toLocaleString()}</td>
                      <td>
                        <RiskBadge level={order.risk_level} />
                      </td>
                      <td>{STAGE_MAP[order.current_stage] || order.current_stage}</td>
                      <td>{STEP_MAP[order.current_step] || order.current_step}</td>
                      <td>
                        <span class={`status-badge ${order.status}`}>
                          {STATUS_MAP[order.status] || order.status}
                        </span>
                      </td>
                      <td>{order.handler_name || '-'}</td>
                      <td class={overdue ? 'deadline-cell' : ''}>
                        {order.deadline
                          ? new Date(order.deadline).toLocaleDateString('zh-CN')
                          : '-'}
                      </td>
                      <td>
                        <button
                          class="btn-link"
                          onClick={() => route(`/order/${order.id}`)}
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateOrderModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            loadOrders();
          }}
        />
      )}
    </div>
  );
}
