import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { api, extractError } from '../services/api';
import {
  OrderDetail,
  OrderAction,
  OrderStatus,
  Role,
  MaterialItem,
  OrderStatusLabels,
  RoleLabels,
} from '../types';

const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAppStore();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const [selectedAction, setSelectedAction] = useState<OrderAction | ''>('');
  const [comment, setComment] = useState('');
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionResult, setActionResult] = useState<any>(null);

  useEffect(() => {
    if (currentUser && id) {
      loadOrderDetail();
    }
  }, [currentUser, id]);

  const loadOrderDetail = async () => {
    if (!currentUser || !id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api
        .withOperator(currentUser.id)
        .orders.getDetail(id);
      setOrder(response.data);
      setMaterials(response.data.materials);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaterialToggle = (materialId: string, uploaded: boolean) => {
    setMaterials((prev) =>
      prev.map((m) => (m.id === materialId ? { ...m, uploaded } : m)),
    );
  };

  const handleProcess = async () => {
    if (!currentUser || !order || !selectedAction || !comment.trim()) return;

    setIsProcessing(true);
    setActionResult(null);
    setError(null);

    try {
      const updatedMaterials = materials.map((m) => ({
        id: m.id,
        type: m.type,
        uploaded: m.uploaded,
        url: m.url,
      }));

      const response = await api
        .withOperator(currentUser.id)
        .orders.process(order.id, {
          action: selectedAction,
          comment,
          materials: updatedMaterials,
        });

      setActionResult({ success: true, data: response.data });
      setOrder(response.data);
      setMaterials(response.data.materials);

      setTimeout(() => {
        setSelectedAction('');
        setComment('');
        setActionResult(null);
      }, 2000);
    } catch (err: any) {
      const errInfo = extractError(err);
      setActionResult({ success: false, error: errInfo });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefresh = () => {
    loadOrderDetail();
    setSelectedAction('');
    setComment('');
    setActionResult(null);
  };

  const handleBack = () => {
    navigate('/orders');
  };

  const isHandler = currentUser?.id === order?.currentHandlerId;

  const actionLabels: Record<OrderAction, string> = {
    [OrderAction.SUBMIT_REGISTRATION]: '提交登记',
    [OrderAction.REQUEST_CORRECTION]: '要求补正',
    [OrderAction.SUBMIT_CORRECTION]: '提交补正',
    [OrderAction.APPROVE_REVIEW]: '审核通过',
    [OrderAction.REJECT_REVIEW]: '审核驳回',
    [OrderAction.APPROVE_FINAL_REVIEW]: '复核通过归档',
    [OrderAction.REJECT_FINAL_REVIEW]: '复核驳回',
  };

  const getActionButtonStyle = (action: OrderAction) => {
    if (action.includes('approve')) return 'btn-success';
    if (action.includes('reject')) return 'btn-error';
    if (action.includes('correction')) return 'btn-warning';
    return 'btn-primary';
  };

  if (isLoading && !order) {
    return (
      <div className="empty-state">
        <div className="loading"></div>
        <p style={{ marginTop: '12px' }}>加载订单详情中...</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="card">
        <div className="error-box">
          <div className="error-title">❌ 加载失败</div>
          <div className="error-message">{error.message}</div>
          {error.details && (
            <div className="error-details">
              <pre>{JSON.stringify(error.details, null, 2)}</pre>
            </div>
          )}
          <div style={{ marginTop: '16px' }}>
            <button className="btn btn-default" onClick={handleBack}>
              ← 返回列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button className="btn btn-default" onClick={handleBack}>
          ← 返回列表
        </button>
        <button className="btn btn-default" onClick={handleRefresh}>
          🔄 刷新
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            📋 订单详情 - {order.orderNo}
            <span
              className={`status-tag ${order.status}`}
              style={{ marginLeft: '12px' }}
            >
              {order.statusLabel}
            </span>
            {order.isOverdue && <span className="overdue-badge">已逾期</span>}
          </h2>
          <div style={{ fontSize: '13px', color: '#888' }}>
            版本号: v{order.version} | 最后更新:{' '}
            {new Date(order.updatedAt).toLocaleString()}
          </div>
        </div>

        <div className="info-box" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>当前处理人：</strong>
              {order.currentHandlerName} ({RoleLabels[order.currentHandlerRole]})
              {isHandler ? (
                <span style={{ color: '#52c41a', marginLeft: '8px' }}>
                  ✓ 您是当前处理人
                </span>
              ) : (
                <span style={{ color: '#f5222d', marginLeft: '8px' }}>
                  ! 您不是当前处理人，无法处理此订单
                </span>
              )}
            </div>
            <div>
              <strong>处理时限：</strong>
              {order.timeLimit.isOverdue ? (
                <span style={{ color: '#f5222d' }}>
                  已逾期 {Math.abs(order.timeLimit.remainingHours)} 小时
                </span>
              ) : (
                <span>
                  剩余 {order.timeLimit.remainingHours} 小时
                  （截止 {new Date(order.timeLimit.deadline).toLocaleString()}）
                </span>
              )}
            </div>
          </div>
        </div>

        <h3 className="section-title">基本信息</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">订单编号</span>
            <span className="detail-value">
              <code>{order.orderNo}</code>
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">二维码</span>
            <span className="detail-value">
              <code>{order.qrCode}</code>
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">场地名称</span>
            <span className="detail-value">{order.venueName}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">场地类型</span>
            <span className="detail-value">{order.venueType}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">预约日期</span>
            <span className="detail-value">{order.bookingDate}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">预约时段</span>
            <span className="detail-value">{order.bookingTime}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">申请人姓名</span>
            <span className="detail-value">{order.applicantName}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">联系电话</span>
            <span className="detail-value">{order.applicantPhone}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">身份证号</span>
            <span className="detail-value">{order.applicantIdCard}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">创建时间</span>
            <span className="detail-value">
              {new Date(order.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        <h3 className="section-title">材料清单</h3>
        <div className="material-list">
          {materials.map((material) => (
            <div
              key={material.id}
              className={`material-item ${material.required ? 'required' : ''}`}
            >
              <span
                className={`material-status ${material.uploaded ? 'uploaded' : 'missing'}`}
              >
                {material.uploaded ? '✓' : '!'}
              </span>
              <span style={{ flex: 1 }}>{material.name}</span>
              <span style={{ fontSize: '12px', color: '#888', marginRight: '12px' }}>
                {material.type}
              </span>
              {isHandler &&
                (order.status === OrderStatus.PENDING_REGISTRATION ||
                  order.status === OrderStatus.PENDING_CORRECTION) && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={material.uploaded}
                      onChange={(e) =>
                        handleMaterialToggle(material.id, e.target.checked)
                      }
                    />
                    <span style={{ fontSize: '12px' }}>
                      {material.uploaded ? '已上传' : '标记已上传'}
                    </span>
                  </label>
                )}
              {(!isHandler ||
                (order.status !== OrderStatus.PENDING_REGISTRATION &&
                  order.status !== OrderStatus.PENDING_CORRECTION)) && (
                <span
                  style={{
                    fontSize: '12px',
                    color: material.uploaded ? '#52c41a' : '#f5222d',
                  }}
                >
                  {material.uploaded ? '已上传' : '未上传'}
                </span>
              )}
            </div>
          ))}
        </div>

        {order.correctionRequest && (
          <>
            <h3 className="section-title">补正要求</h3>
            <div className="info-box">
              <p style={{ margin: 0 }}>{order.correctionRequest}</p>
            </div>
          </>
        )}

        {order.registrationOpinion && (
          <>
            <h3 className="section-title">登记意见</h3>
            <div className="info-box">
              <p style={{ margin: 0 }}>{order.registrationOpinion}</p>
            </div>
          </>
        )}

        {order.reviewOpinion && (
          <>
            <h3 className="section-title">审核意见</h3>
            <div className="info-box">
              <p style={{ margin: 0 }}>{order.reviewOpinion}</p>
            </div>
          </>
        )}

        {order.finalReviewOpinion && (
          <>
            <h3 className="section-title">复核意见</h3>
            <div className="info-box">
              <p style={{ margin: 0 }}>{order.finalReviewOpinion}</p>
            </div>
          </>
        )}

        {order.scannedAt && (
          <div style={{ marginTop: '20px', fontSize: '12px', color: '#888' }}>
            📱 扫码记录：{order.scannedBy} 于 {new Date(order.scannedAt).toLocaleString()} 扫码
          </div>
        )}
      </div>

      {isHandler && order.allowedActions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">⚡ 处理订单</h2>
          </div>

          <div className="form-group">
            <label className="form-label required">选择操作</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {order.allowedActions.map((item) => (
                <button
                  key={item.action}
                  className={`btn ${getActionButtonStyle(item.action)} ${selectedAction === item.action ? '' : 'btn-default'}`}
                  onClick={() => setSelectedAction(item.action)}
                  disabled={isProcessing}
                  style={{
                    border: selectedAction === item.action ? '2px solid currentColor' : '1px solid #d9d9d9',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label required">处理意见</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="请输入处理意见，此内容将被记录到审计日志中"
              disabled={isProcessing || !selectedAction}
            />
            <div className="help-text">
              处理意见是必填项，将作为审计记录永久保存
            </div>
          </div>

          {selectedAction &&
            (selectedAction === OrderAction.SUBMIT_REGISTRATION ||
              selectedAction === OrderAction.SUBMIT_CORRECTION) && (
            <div className="info-box" style={{ marginTop: '16px' }}>
              <p style={{ margin: 0 }}>
                {materials.filter((m) => m.required && !m.uploaded).length > 0 ? (
                  <span style={{ color: '#f5222d' }}>
                    ⚠️ 还有{' '}
                    {materials.filter((m) => m.required && !m.uploaded).length} 项必填材料未上传，
                    提交将被拒绝
                  </span>
                ) : (
                  <span style={{ color: '#52c41a' }}>
                    ✓ 所有必填材料已齐全，可以提交
                  </span>
                )}
              </p>
            </div>
          )}

          {actionResult && (
            <div style={{ marginTop: '16px' }}>
              {actionResult.success ? (
                <div className="success-box">
                  <div className="success-title">✅ 处理成功</div>
                  <div className="error-message">
                    订单状态已更新为：
                    <span
                      className={`status-tag ${actionResult.data.status}`}
                      style={{ marginLeft: '8px' }}
                    >
                      {actionResult.data.statusLabel}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="error-box">
                  <div className="error-title">❌ 处理失败</div>
                  <div className="error-message">{actionResult.error.message}</div>
                  {actionResult.error.details && (
                    <div className="error-details">
                      <pre>{JSON.stringify(actionResult.error.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="form-actions">
            <button
              className="btn btn-default"
              onClick={handleRefresh}
              disabled={isProcessing}
            >
              重置
            </button>
            <button
              className="btn btn-primary"
              onClick={handleProcess}
              disabled={
                isProcessing ||
                !selectedAction ||
                !comment.trim() ||
                (selectedAction === OrderAction.SUBMIT_REGISTRATION &&
                  materials.filter((m) => m.required && !m.uploaded).length > 0) ||
                (selectedAction === OrderAction.SUBMIT_CORRECTION &&
                  materials.filter((m) => m.required && !m.uploaded).length > 0)
              }
            >
              {isProcessing ? (
                <>
                  <span className="loading"></span> 处理中...
                </>
              ) : (
                '确认提交'
              )}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📜 审计日志</h2>
        </div>

        <div className="audit-timeline">
          {order.auditLogs.length === 0 ? (
            <div className="empty-state">暂无审计记录</div>
          ) : (
            order.auditLogs.map((log) => (
              <div key={log.id} className="audit-item">
                <div className="audit-header">
                  <span className="audit-operator">
                    {log.operatorName} ({RoleLabels[log.operatorRole]})
                  </span>
                  <span className="audit-time">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="audit-action">
                  {typeof log.action === 'string' &&
                  Object.values(OrderAction).includes(log.action as OrderAction)
                    ? actionLabels[log.action as OrderAction] || log.action
                    : log.action}
                </div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                  {OrderStatusLabels[log.oldStatus]} →{' '}
                  <span
                    className={`status-tag ${log.newStatus}`}
                    style={{ padding: '1px 8px', fontSize: '11px' }}
                  >
                    {OrderStatusLabels[log.newStatus]}
                  </span>
                </div>
                <div className="audit-comment">{log.comment}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;
