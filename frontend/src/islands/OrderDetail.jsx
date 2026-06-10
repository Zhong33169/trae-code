import { useState, useEffect } from 'react';
import { getOrderDetail, performAction, updateOrder, addEvidence, deleteEvidence } from '../lib/api';
import OrderForm from './OrderForm';
import EvidenceManager from './EvidenceManager';

const LOG_TABS = [
  { key: 'operation', label: '操作记录' },
  { key: 'field', label: '字段变更' },
  { key: 'evidence', label: '证据变更' }
];

export default function OrderDetail({ orderId, userId, userRole, onBack, onActionComplete }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState(null);
  const [opinion, setOpinion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [evidenceSubmitting, setEvidenceSubmitting] = useState(false);
  const [activeLogTab, setActiveLogTab] = useState('operation');

  const loadDetail = () => {
    if (!orderId || !userId) return;
    setLoading(true);
    getOrderDetail(orderId, userId)
      .then(res => {
        if (res.success) {
          setDetail(res);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDetail();
  }, [orderId, userId]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const triggerRefresh = () => {
    onActionComplete && onActionComplete();
  };

  const handleAction = async (action) => {
    const actionDef = detail.availableActions.find(a => a.key === action);
    if (!actionDef) return;

    if (actionDef.needOpinion) {
      setSelectedAction(action);
      setOpinion('');
      return;
    }

    setSubmitting(true);
    try {
      const res = await performAction(orderId, action, {
        userId,
        userRole,
        version: detail.order.version
      });
      if (res.success) {
        showToast('操作成功', 'success');
        setDetail(prev => ({
          ...prev,
          ...res,
          fieldChanges: res.fieldChanges || prev.fieldChanges,
          evidenceChanges: res.evidenceChanges || prev.evidenceChanges
        }));
        setSelectedAction(null);
        triggerRefresh();
      } else {
        showToast(res.message || '操作失败', 'error');
      }
    } catch (e) {
      showToast('操作失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmAction = async () => {
    if (!selectedAction) return;
    const actionDef = detail.availableActions.find(a => a.key === selectedAction);
    if (actionDef?.needOpinion && !opinion.trim()) {
      showToast('请填写处理意见', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await performAction(orderId, selectedAction, {
        userId,
        userRole,
        opinion: opinion.trim(),
        version: detail.order.version
      });
      if (res.success) {
        showToast('操作成功', 'success');
        setDetail(prev => ({
          ...prev,
          ...res,
          fieldChanges: res.fieldChanges || prev.fieldChanges,
          evidenceChanges: res.evidenceChanges || prev.evidenceChanges
        }));
        setSelectedAction(null);
        setOpinion('');
        triggerRefresh();
      } else {
        showToast(res.message || '操作失败', 'error');
      }
    } catch (e) {
      showToast('操作失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const res = await updateOrder(orderId, formData, userId, detail.order.version);
      if (res.success) {
        showToast('保存成功', 'success');
        setIsEditing(false);
        if (res.changed) {
          setDetail(prev => ({
            ...prev,
            order: res.order,
            logs: res.logs,
            fieldChanges: res.fieldChanges,
            evidenceCheck: res.evidenceCheck
          }));
          triggerRefresh();
        }
      } else {
        showToast(res.message || '保存失败', 'error');
      }
    } catch (e) {
      showToast('保存失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddEvidence = async (type, name) => {
    setEvidenceSubmitting(true);
    try {
      const res = await addEvidence(orderId, type, name, userId);
      if (res.success) {
        showToast('证据添加成功', 'success');
        setDetail(prev => ({
          ...prev,
          evidences: res.evidences,
          evidenceCheck: res.evidenceCheck,
          order: res.order,
          logs: res.logs,
          evidenceChanges: res.evidenceChanges
        }));
        triggerRefresh();
        return true;
      } else {
        showToast(res.message || '添加失败', 'error');
        return false;
      }
    } catch (e) {
      showToast('添加失败', 'error');
      return false;
    } finally {
      setEvidenceSubmitting(false);
    }
  };

  const handleDeleteEvidence = async (evidenceId) => {
    setEvidenceSubmitting(true);
    try {
      const res = await deleteEvidence(evidenceId, userId);
      if (res.success) {
        showToast('证据删除成功', 'success');
        setDetail(prev => ({
          ...prev,
          evidences: res.evidences,
          evidenceCheck: res.evidenceCheck,
          order: res.order,
          logs: res.logs,
          evidenceChanges: res.evidenceChanges
        }));
        triggerRefresh();
      } else {
        showToast(res.message || '删除失败', 'error');
      }
    } catch (e) {
      showToast('删除失败', 'error');
    } finally {
      setEvidenceSubmitting(false);
    }
  };

  const getLogClass = (action) => {
    if (action.includes('pass') || action === 'review_archive') return 'log-pass';
    if (action.includes('return') || action === 'resubmit') return 'log-return';
    if (action.includes('reject')) return 'log-reject';
    if (action === 'submit') return 'log-submit';
    if (action.includes('start_')) return 'log-process';
    if (action.includes('amendment') || action.includes('edit_draft') || action.includes('evidence_')) return 'log-process';
    return '';
  };

  const getActionBtnClass = (action) => {
    if (action.includes('pass') || action === 'review_archive') return 'btn-success';
    if (action.includes('return') || action === 'resubmit') return 'btn-warning';
    if (action.includes('reject')) return 'btn-danger';
    if (action.includes('start_')) return 'btn-primary';
    return 'btn-default';
  };

  const getActionModalTitle = (action) => {
    const map = {
      submit: '提交审核',
      resubmit: '补正后重新提交',
      audit_pass: '审核通过',
      audit_return: '退回补正',
      audit_reject: '审核驳回',
      review_archive: '复核归档',
      review_reject: '复核驳回'
    };
    return map[action] || '确认操作';
  };

  const getActionLabel = (action) => {
    const map = {
      submit: '提交审核',
      resubmit: '重新提交',
      start_audit: '开始审核',
      audit_pass: '审核通过',
      audit_return: '退回补正',
      audit_reject: '审核驳回',
      start_review: '开始复核',
      review_archive: '复核归档',
      review_reject: '复核驳回',
      amendment: '补正修改',
      edit_draft: '草稿编辑',
      add_evidence_amendment: '补正添加证据',
      add_evidence_draft: '草稿添加证据',
      delete_evidence_amendment: '补正删除证据',
      delete_evidence_draft: '草稿删除证据'
    };
    return map[action] || action;
  };

  if (loading || !detail) {
    return (
      <div className="detail-container">
        <div className="detail-main">
          <div className="detail-card">
            <div className="loading">加载中...</div>
          </div>
        </div>
      </div>
    );
  }

  const { order, evidences, logs, availableActions, evidenceCheck, canEdit, fieldChanges = [], evidenceChanges = [] } = detail;

  const renderOperationLogs = () => (
    <div className="log-list">
      {logs.length === 0 ? (
        <div className="empty-state">暂无操作记录</div>
      ) : (
        logs.map(log => (
          <div key={log.id} className={`log-item ${getLogClass(log.action)}`}>
            <div className="log-dot"></div>
            <div className="log-content">
              <div className="log-header">
                <span className="log-operator">
                  {log.operator_name}（{log.operatorRoleLabel}）
                </span>
                <span className="log-time">{log.created_at?.slice(0, 19) || ''}</span>
              </div>
              <div className="log-action">
                <strong>{getActionLabel(log.action)}</strong>
                {log.fromStatusLabel && log.toStatusLabel && log.fromStatusLabel !== log.toStatusLabel && (
                  <span style={{ marginLeft: 8 }}>
                    （{log.fromStatusLabel} → {log.toStatusLabel}）
                  </span>
                )}
                {log.version_from !== log.version_to && (
                  <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
                    v{log.version_from} → v{log.version_to}
                  </span>
                )}
              </div>
              {log.opinion && (
                <div className="log-opinion">说明：{log.opinion}</div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderFieldChanges = () => (
    <div className="log-list">
      {fieldChanges.length === 0 ? (
        <div className="empty-state">暂无字段变更记录</div>
      ) : (
        fieldChanges.map(change => (
          <div key={change.id} className="log-item log-process">
            <div className="log-dot"></div>
            <div className="log-content">
              <div className="log-header">
                <span className="log-operator">
                  {change.field_name}
                </span>
                <span className="log-time">{change.created_at?.slice(0, 19) || ''}</span>
              </div>
              <div className="log-action">
                修改人：{change.changed_by_name || change.changed_by}
                {change.change_reason && <span style={{ marginLeft: 8 }}>（{change.change_reason}）</span>}
              </div>
              <div className="log-opinion">
                <span style={{ color: '#e53935', textDecoration: 'line-through' }}>
                  {change.old_value || '(空)'}
                </span>
                <span style={{ margin: '0 8px' }}>→</span>
                <span style={{ color: '#43a047', fontWeight: 500 }}>
                  {change.new_value || '(空)'}
                </span>
              </div>
              {change.version_from !== change.version_to && (
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  版本：v{change.version_from} → v{change.version_to}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderEvidenceChanges = () => (
    <div className="log-list">
      {evidenceChanges.length === 0 ? (
        <div className="empty-state">暂无证据变更记录</div>
      ) : (
        evidenceChanges.map(change => (
          <div key={change.id} className={`log-item ${change.change_type === 'add' ? 'log-pass' : 'log-return'}`}>
            <div className="log-dot"></div>
            <div className="log-content">
              <div className="log-header">
                <span className="log-operator">
                  {change.changeTypeLabel || change.change_type}证据
                </span>
                <span className="log-time">{change.created_at?.slice(0, 19) || ''}</span>
              </div>
              <div className="log-action">
                {change.evidenceTypeLabel}：<strong>{change.evidence_name}</strong>
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                操作人：{change.changed_by_name || change.changed_by}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div>
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      <div className="back-link" onClick={onBack}>
        ← 返回列表
      </div>

      <div className="detail-container">
        <div className="detail-main">
          {order.last_opinion && (
            <div className="last-opinion">
              <div className="last-opinion-header">
                上一处理人：{order.last_handler}（{order.lastHandlerRoleLabel}）
                ｜ 结果：{order.last_result === 'passed' ? '通过' :
                        order.last_result === 'returned' ? '退回补正' :
                        order.last_result === 'rejected' ? '驳回' :
                        order.last_result === 'archived' ? '归档' :
                        order.last_result === 'submitted' ? '提交' : order.last_result}
              </div>
              <div className="last-opinion-text">{order.last_opinion}</div>
            </div>
          )}

          {isEditing ? (
            <div className="detail-card">
              <h3>编辑订单</h3>
              <OrderForm
                initialData={order}
                mode="edit"
                onSubmit={handleEditSubmit}
                onCancel={() => setIsEditing(false)}
                submitting={submitting}
              />
            </div>
          ) : (
            <>
              <div className="detail-card">
                <div className="detail-header">
                  <h3>基本信息</h3>
                  {canEdit && (
                    <button className="btn btn-sm btn-primary" onClick={() => setIsEditing(true)}>
                      编辑
                    </button>
                  )}
                </div>
                <div className="detail-row">
                  <div className="detail-label">订单编号</div>
                  <div className="detail-value">
                    <span className="order-no">{order.order_no}</span>
                  </div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">风险等级</div>
                  <div className="detail-value">
                    <span className={`risk-badge risk-${order.risk_level}`}>
                      {order.riskLabel}
                    </span>
                    {order.risk_level === 'high' && (
                      <span className="order-priority-tag">高优先级</span>
                    )}
                  </div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">当前状态</div>
                  <div className="detail-value">
                    <span className={`status-badge status-${order.status}`}>
                      {order.statusLabel}
                    </span>
                  </div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">当前处理人</div>
                  <div className="detail-value">
                    {order.current_handler ? (
                      `${order.current_handler || '待分配'}（${order.currentHandlerRoleLabel || ''}）`
                    ) : '无'}
                  </div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">所属门店</div>
                  <div className="detail-value">{order.store_name || '-'}</div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">版本号</div>
                  <div className="detail-value">v{order.version}</div>
                </div>
                {order.deadline && (
                  <div className="detail-row">
                    <div className="detail-label">截止时间</div>
                    <div className="detail-value" style={{ color: order.status === 'overdue' ? '#c62828' : 'inherit' }}>
                      {order.deadline}
                    </div>
                  </div>
                )}
              </div>

              <div className="detail-card">
                <h3>患者信息</h3>
                <div className="detail-row">
                  <div className="detail-label">患者姓名</div>
                  <div className="detail-value">{order.patient_name}</div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">联系电话</div>
                  <div className="detail-value">{order.patient_phone || '-'}</div>
                </div>
              </div>

              <div className="detail-card">
                <h3>药品信息</h3>
                <div className="detail-row">
                  <div className="detail-label">药品名称</div>
                  <div className="detail-value"><strong>{order.drug_name}</strong></div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">规格</div>
                  <div className="detail-value">{order.drug_spec || '-'}</div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">数量</div>
                  <div className="detail-value">{order.quantity} 盒/瓶</div>
                </div>
              </div>
            </>
          )}

          <div className="detail-card">
            <h3>证据附件</h3>
            <EvidenceManager
              evidences={evidences}
              evidenceCheck={evidenceCheck}
              canEdit={canEdit && !isEditing}
              onAdd={handleAddEvidence}
              onDelete={handleDeleteEvidence}
              submitting={evidenceSubmitting}
            />
          </div>

          <div className="detail-card">
            <div className="tabs">
              {LOG_TABS.map(tab => (
                <div
                  key={tab.key}
                  className={`tab ${activeLogTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveLogTab(tab.key)}
                >
                  {tab.label}
                </div>
              ))}
            </div>
            {activeLogTab === 'operation' && renderOperationLogs()}
            {activeLogTab === 'field' && renderFieldChanges()}
            {activeLogTab === 'evidence' && renderEvidenceChanges()}
          </div>
        </div>

        <div className="detail-side">
          <div className="detail-card action-panel">
            <h3>操作</h3>
            <div className="action-buttons">
              {availableActions.length === 0 ? (
                <div className="empty-state" style={{ padding: 20 }}>
                  当前状态无可用操作
                </div>
              ) : (
                availableActions.map(action => (
                  <button
                    key={action.key}
                    className={`btn ${getActionBtnClass(action.key)}`}
                    onClick={() => handleAction(action.key)}
                    disabled={submitting || isEditing}
                  >
                    {action.label}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedAction && (
        <div className="modal-overlay" onClick={() => !submitting && setSelectedAction(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{getActionModalTitle(selectedAction)}</h3>
            <div className="form-group">
              <label>处理意见</label>
              <textarea
                className="opinion-textarea"
                value={opinion}
                onChange={e => setOpinion(e.target.value)}
                placeholder="请填写处理意见..."
                disabled={submitting}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-default"
                onClick={() => setSelectedAction(null)}
                disabled={submitting}
              >
                取消
              </button>
              <button
                className={`btn ${getActionBtnClass(selectedAction)}`}
                onClick={confirmAction}
                disabled={submitting}
              >
                {submitting ? '处理中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
