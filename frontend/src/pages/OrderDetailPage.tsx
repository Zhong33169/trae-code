import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import * as api from '../api';
import type { CrossBorderOrder, AuditLog, Material } from '../types';
import { STATUS_TEXT, STATUS_COLOR, ROLE_TEXT } from '../types';

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<CrossBorderOrder | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [opinion, setOpinion] = useState('');
  const [processing, setProcessing] = useState(false);
  const [editingMaterials, setEditingMaterials] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [orderData, logsData] = await Promise.all([
        api.getOrder(id),
        api.getAuditLogs(id),
      ]);
      setOrder(orderData);
      setMaterials(orderData.materials);
      setAuditLogs(logsData.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDeadlineText = () => {
    if (!order) return '';
    const now = new Date();
    const deadline = new Date(order.deadline);
    const diffMs = deadline.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (order.isOverdue || diffMs < 0) {
      const absHours = Math.abs(diffHours);
      if (absHours < 1) {
        return `已逾期 ${Math.floor(absHours * 60)} 分钟`;
      } else if (absHours < 24) {
        return `已逾期 ${Math.floor(absHours)} 小时`;
      } else {
        return `已逾期 ${Math.floor(absHours / 24)} 天 ${Math.floor(absHours % 24)} 小时`;
      }
    } else {
      if (diffHours < 1) {
        return `剩余 ${Math.floor(diffHours * 60)} 分钟`;
      } else if (diffHours < 24) {
        return `剩余 ${Math.floor(diffHours)} 小时`;
      } else {
        return `剩余 ${Math.floor(diffHours / 24)} 天 ${Math.floor(diffHours % 24)} 小时`;
      }
    }
  };

  const isDeadlineWarning = () => {
    if (!order || order.status === 'archived') return false;
    const now = new Date();
    const deadline = new Date(order.deadline);
    const diffMs = deadline.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= order.warningHours;
  };

  const canSubmit = user?.role === 'registrar' && 
    order?.registrarId === user.id &&
    (order?.status === 'draft' || order?.status === 'returned');

  const canSupervisorProcess = user?.role === 'supervisor' && order?.status === 'pending';

  const canReviewerProcess = user?.role === 'reviewer' && order?.status === 'processing';

  const canEditMaterials = user?.role === 'registrar' &&
    order?.registrarId === user.id &&
    (order?.status === 'draft' || order?.status === 'returned');

  const handleSubmit = async () => {
    if (!order) return;
    setProcessing(true);
    try {
      const result = await api.submitOrder(order.id, order.version);
      alert('提交成功！' + (result.warning ? '\n注意：' + result.warning : ''));
      loadData();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const handleSupervisorProcess = async (pass: boolean) => {
    if (!order || !opinion.trim()) {
      alert('请输入审核意见');
      return;
    }
    setProcessing(true);
    try {
      await api.supervisorProcessOrder(order.id, opinion, pass, order.version);
      alert(pass ? '审核通过！' : '已退回！');
      setOpinion('');
      loadData();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReviewerProcess = async (pass: boolean) => {
    if (!order || !opinion.trim()) {
      alert('请输入复核意见');
      return;
    }
    setProcessing(true);
    try {
      await api.reviewerProcessOrder(order.id, opinion, pass, order.version);
      alert(pass ? '复核通过并归档！' : '已退回！');
      setOpinion('');
      loadData();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveMaterials = async () => {
    if (!order) return;
    setProcessing(true);
    try {
      const updated = await api.updateMaterials(order.id, materials, order.version);
      setOrder(updated);
      setMaterials(updated.materials);
      setEditingMaterials(false);
      alert('材料更新成功！');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const toggleMaterialUploaded = (index: number) => {
    const newMaterials = [...materials];
    newMaterials[index] = { ...newMaterials[index], uploaded: !newMaterials[index].uploaded };
    setMaterials(newMaterials);
  };

  if (loading) {
    return <div className="empty-state">加载中...</div>;
  }

  if (!order) {
    return <div className="empty-state">订单不存在</div>;
  }

  return (
    <div>
      <div className="back-link" onClick={() => navigate('/orders')}>
        ← 返回列表
      </div>

      <div className="detail-page">
        <div className="detail-header">
          <div>
            <h1 className="detail-title">
              {order.orderNo} - {order.productName}
            </h1>
            <div className="detail-meta">
              <span>创建时间：{formatDateTime(order.createdAt)}</span>
              <span>登记员：{order.registrarName}</span>
              {order.supervisorName && <span>初审：{order.supervisorName}</span>}
              {order.reviewerName && <span>复核：{order.reviewerName}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span
              className="status-tag"
              style={{
                background: STATUS_COLOR[order.status] + '20',
                color: STATUS_COLOR[order.status],
                border: `1px solid ${STATUS_COLOR[order.status]}40`,
                fontSize: '14px',
                padding: '4px 12px',
              }}
            >
              {STATUS_TEXT[order.status]}
            </span>
            <div style={{ marginTop: '8px', color: '#666', fontSize: '13px' }}>
              版本号：v{order.version}
            </div>
          </div>
        </div>

        <div className="detail-content">
          {order.isOverdue && (
            <div className="overdue-banner">
              <div className="overdue-banner-title">
                ⚠️ 订单已逾期
              </div>
              <div className="overdue-banner-content">
                <p><strong>逾期原因：</strong>{order.overdueReason}</p>
                {order.nextAction && (
                  <div className="next-action">
                    <strong>下一步建议：</strong>{order.nextAction}
                  </div>
                )}
              </div>
            </div>
          )}

          {!order.isOverdue && isDeadlineWarning() && (
            <div style={{
              background: '#fffbe6',
              border: '1px solid #ffe58f',
              borderRadius: '6px',
              padding: '16px',
              marginBottom: '16px',
            }}>
              <div style={{ color: '#d48806', fontWeight: '600', marginBottom: '6px' }}>
                ⏰ 即将到期预警
              </div>
              <div style={{ color: '#ad6800', fontSize: '13px' }}>
                距离处理时限仅剩 {getDeadlineText()}，请尽快处理
              </div>
            </div>
          )}

          <div className="detail-section">
            <h3 className="detail-section-title">基本信息</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">订单号：</span>
                <span className="detail-value">{order.orderNo}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">商品名称：</span>
                <span className="detail-value">{order.productName}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">商品SKU：</span>
                <span className="detail-value">{order.productSku}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">数量：</span>
                <span className="detail-value">{order.quantity}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">金额：</span>
                <span className="detail-value">{order.currency} {order.amount.toFixed(2)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">平台：</span>
                <span className="detail-value">{order.platform}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">目的国：</span>
                <span className="detail-value">{order.buyerCountry}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">处理时限：</span>
                <span className="detail-value" style={{ 
                  color: order.isOverdue ? '#ff4d4f' : isDeadlineWarning() ? '#faad14' : '#333',
                  fontWeight: '500',
                }}>
                  {formatDateTime(order.deadline)}（{getDeadlineText()}）
                </span>
              </div>
              {order.remark && (
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="detail-label">备注：</span>
                  <span className="detail-value">{order.remark}</span>
                </div>
              )}
              {order.returnReason && (
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="detail-label">退回原因：</span>
                  <span className="detail-value" style={{ color: '#ff4d4f' }}>{order.returnReason}</span>
                </div>
              )}
            </div>
          </div>

          <div className="detail-section">
            <h3 className="detail-section-title">
              材料清单
              {canEditMaterials && !editingMaterials && (
                <button
                  className="btn btn-default btn-sm"
                  style={{ marginLeft: '12px' }}
                  onClick={() => setEditingMaterials(true)}
                >
                  编辑材料
                </button>
              )}
              {editingMaterials && (
                <span style={{ marginLeft: '12px' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveMaterials}
                    disabled={processing}
                  >
                    保存
                  </button>
                  <button
                    className="btn btn-default btn-sm"
                    style={{ marginLeft: '8px' }}
                    onClick={() => {
                      setMaterials(order.materials);
                      setEditingMaterials(false);
                    }}
                  >
                    取消
                  </button>
                </span>
              )}
            </h3>
            <div className="material-list">
              {(editingMaterials ? materials : order.materials).map((m, index) => (
                <div key={m.id} className="material-item">
                  <div className="material-item-info">
                    {editingMaterials ? (
                      <input
                        type="checkbox"
                        checked={m.uploaded}
                        onChange={() => toggleMaterialUploaded(index)}
                      />
                    ) : (
                      <span
                        className={`material-status ${m.uploaded ? 'uploaded' : 'missing'}`}
                      >
                        {m.uploaded ? '已上传' : '未上传'}
                      </span>
                    )}
                    <span style={{ fontWeight: '500' }}>{m.name}</span>
                    {m.required && <span className="material-required">*必需</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    类型：{m.type}
                  </div>
                </div>
              ))}
            </div>
            {order.materials.some(m => m.required && !m.uploaded) && (
              <div style={{
                marginTop: '12px',
                padding: '8px 12px',
                background: '#fff1f0',
                borderRadius: '4px',
                fontSize: '13px',
                color: '#ff4d4f',
              }}>
                ⚠️ 存在未上传的必需材料，可能影响订单推进
              </div>
            )}
          </div>

          <div className="detail-section">
            <h3 className="detail-section-title">处理意见</h3>
            <div className="opinion-list">
              {order.opinions.slice().reverse().map((op, index) => (
                <div key={index} className={`opinion-item ${op.pass ? 'pass' : 'reject'}`}>
                  <div className="opinion-header">
                    <div>
                      <span className="opinion-user">{op.userName}</span>
                      <span className="opinion-role">{ROLE_TEXT[op.role]}</span>
                    </div>
                    <span className="opinion-time">{formatDateTime(op.time)}</span>
                  </div>
                  <div className="opinion-content">
                    <span style={{ 
                      color: op.pass ? '#52c41a' : '#ff4d4f',
                      fontWeight: '500',
                      marginRight: '8px',
                    }}>
                      {op.pass ? '通过' : '退回'}
                    </span>
                    {op.content}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {canSupervisorProcess && (
            <div className="process-section">
              <div className="process-section-title">审核处理</div>
              <div className="form-item">
                <label className="form-label">审核意见</label>
                <textarea
                  className="form-textarea"
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  placeholder="请输入审核意见"
                  rows={3}
                />
              </div>
              <div className="process-actions">
                <button
                  className="btn btn-success"
                  onClick={() => handleSupervisorProcess(true)}
                  disabled={processing}
                >
                  审核通过
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleSupervisorProcess(false)}
                  disabled={processing}
                >
                  退回补正
                </button>
              </div>
            </div>
          )}

          {canReviewerProcess && (
            <div className="process-section">
              <div className="process-section-title">复核处理</div>
              {order.materials.some(m => m.required && !m.uploaded) && (
                <div style={{
                  marginBottom: '12px',
                  padding: '8px 12px',
                  background: '#fff1f0',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#ff4d4f',
                }}>
                  ⚠️ 存在未上传的必需材料，无法通过复核
                </div>
              )}
              <div className="form-item">
                <label className="form-label">复核意见</label>
                <textarea
                  className="form-textarea"
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  placeholder="请输入复核意见"
                  rows={3}
                />
              </div>
              <div className="process-actions">
                <button
                  className="btn btn-success"
                  onClick={() => handleReviewerProcess(true)}
                  disabled={processing || order.materials.some(m => m.required && !m.uploaded)}
                >
                  复核通过并归档
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleReviewerProcess(false)}
                  disabled={processing}
                >
                  退回
                </button>
              </div>
            </div>
          )}

          {canSubmit && (
            <div className="process-section">
              <div className="process-section-title">提交操作</div>
              <p style={{ marginBottom: '12px', color: '#666', fontSize: '13px' }}>
                确认材料准备完毕后，提交至审核主管审核
              </p>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={processing}
              >
                提交审核
              </button>
            </div>
          )}

          <div className="detail-section">
            <h3 className="detail-section-title">审计记录</h3>
            <div className="audit-list">
              {auditLogs.map((log) => (
                <div key={log.id} className="audit-item">
                  <span className="audit-time">{formatDateTime(log.time)}</span>
                  <span className="audit-action">{log.action}</span>
                  <span className="audit-user">{log.userName}</span>
                  <span className="audit-detail">{log.detail}</span>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <div style={{ color: '#999', padding: '16px' }}>暂无审计记录</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
