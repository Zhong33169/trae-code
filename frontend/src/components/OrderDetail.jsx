import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { route } from 'preact-router';
import { fetchOrderDetail } from '../api/client';
import RiskBadge from './RiskBadge';
import StageFlow from './StageFlow';
import ActionPanel from './ActionPanel';
import OperationRecords from './OperationRecords';
import RiskChangeModal from './RiskChangeModal';

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

function parseJSON(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch (e) { return []; }
  }
  return [];
}

export default function OrderDetail({ id, currentUser }) {
  const [order, setOrder] = useState(null);
  const [records, setRecords] = useState([]);
  const [riskLogs, setRiskLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRiskModal, setShowRiskModal] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      const data = await fetchOrderDetail(id);
      setOrder(data.order || data);
      setRecords(data.records || []);
      setRiskLogs(data.risk_logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  if (loading) return <div class="page-container"><div class="loading">加载中...</div></div>;
  if (!order) return <div class="page-container"><div class="empty-state">未找到该工单</div></div>;

  const isOverdue = order.deadline && new Date(order.deadline) < new Date();
  const requiredEvidence = parseJSON(order.required_evidence);
  const providedEvidence = parseJSON(order.evidence_provided);
  const lastRecord = records.length > 0 ? records[records.length - 1] : null;

  return (
    <div class="page-container">
      <a class="back-link" onClick={() => route('/')}>
        ← 返回队列
      </a>

      <div class="card detail-section">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
          <h2 style="font-size:20px;font-weight:600;color:#1a1a2e;">
            工单 {order.order_no}
          </h2>
          <span class={`status-badge ${order.status}`}>
            {STATUS_MAP[order.status] || order.status}
          </span>
        </div>

        <div class="detail-grid">
          <div class="detail-item">
            <span class="label">客户</span>
            <span class="value">{order.customer_name}</span>
          </div>
          <div class="detail-item">
            <span class="label">商品</span>
            <span class="value">{order.product_name}</span>
          </div>
          <div class="detail-item">
            <span class="label">订单金额</span>
            <span class="value">¥{Number(order.order_amount).toLocaleString()}</span>
          </div>
          <div class="detail-item">
            <span class="label">退款金额</span>
            <span class="value">¥{Number(order.refund_amount).toLocaleString()}</span>
          </div>
          <div class="detail-item">
            <span class="label">风险等级</span>
            <span class="value">
              <RiskBadge level={order.risk_level} />
              <button
                class="btn-link"
                style="margin-left:8px;font-size:12px;"
                onClick={() => setShowRiskModal(true)}
              >
                变更等级
              </button>
            </span>
          </div>
          <div class="detail-item">
            <span class="label">截止日期</span>
            <span class="value" style={isOverdue ? { color: '#ff4d4f', fontWeight: 600 } : {}}>
              {order.deadline
                ? new Date(order.deadline).toLocaleString('zh-CN')
                : '-'}
              {isOverdue ? ' (已逾期)' : ''}
            </span>
          </div>
          <div class="detail-item">
            <span class="label">当前处理人</span>
            <span class="value">{order.handler_name || '待分配'}</span>
          </div>
          <div class="detail-item">
            <span class="label">版本号</span>
            <span class="value">v{order.version}</span>
          </div>
        </div>
      </div>

      <div class="card detail-section">
        <div class="section-title">流程进度</div>
        <StageFlow
          currentStage={order.current_stage}
          currentStep={order.current_step}
        />
      </div>

      <div class="card detail-section">
        <div class="section-title">证据材料</div>
        <div class="evidence-list">
          {requiredEvidence.map((ev) => {
            const provided = providedEvidence.includes(ev);
            return (
              <div class={`evidence-item ${provided ? 'provided' : 'missing'}`}>
                <span>{provided ? '✓' : '✗'}</span>
                <span>{ev}</span>
              </div>
            );
          })}
          {requiredEvidence.length === 0 && (
            <div style="color:#999;font-size:13px;">无要求证据</div>
          )}
        </div>
      </div>

      {lastRecord && (
        <div class="card detail-section">
          <div class="section-title">上一处理人意见</div>
          <div class="opinion-box">
            <div class="opinion-label">
              {lastRecord.handler_name}（{lastRecord.handler_role === 'clerk' ? '登记员' : lastRecord.handler_role === 'supervisor' ? '审核主管' : '复核负责人'}）
            </div>
            <div class="opinion-text">{lastRecord.opinion || '无意见'}</div>
            {lastRecord.result && (
              <div class="opinion-result">处理结果：{lastRecord.result}</div>
            )}
          </div>
        </div>
      )}

      {currentUser && (
        <div class="card detail-section">
          <div class="section-title">操作面板</div>
          <ActionPanel
            order={order}
            currentUser={currentUser}
            onAction={loadOrder}
          />
        </div>
      )}

      <div class="card detail-section">
        <div class="section-title">处理记录</div>
        <OperationRecords records={records} />
      </div>

      {riskLogs.length > 0 && (
        <div class="card detail-section">
          <div class="section-title">风险等级变更历史</div>
          <div class="risk-change-history">
            {riskLogs.map((rc, i) => (
              <div key={i} class="risk-change-item">
                <span>{new Date(rc.created_at).toLocaleString('zh-CN')}</span>
                <RiskBadge level={rc.old_level} />
                <span class="arrow">→</span>
                <RiskBadge level={rc.new_level} />
                <span style="color:#666;font-size:12px;">{rc.reason}</span>
                <span style="color:#999;font-size:12px;">({rc.operator})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showRiskModal && (
        <RiskChangeModal
          currentLevel={order.risk_level}
          orderId={order.id}
          currentUser={currentUser}
          onClose={() => setShowRiskModal(false)}
          onSuccess={() => {
            setShowRiskModal(false);
            loadOrder();
          }}
        />
      )}
    </div>
  );
}
