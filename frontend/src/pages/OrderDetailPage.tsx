import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import * as api from '../api';
import type { CrossBorderOrder, AuditLog, Material, ListingStatus, InventoryStatus, BlockReason } from '../types';
import {
  STATUS_TEXT,
  STATUS_COLOR,
  ROLE_TEXT,
  LISTING_TEXT,
  LISTING_COLOR,
  INVENTORY_TEXT,
  INVENTORY_COLOR,
  BLOCK_FIELD_TEXT,
} from '../types';

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
  const [editingListing, setEditingListing] = useState(false);
  const [listingStatus, setListingStatus] = useState<ListingStatus>('not_listed');
  const [inventoryStatus, setInventoryStatus] = useState<InventoryStatus>('not_synced');
  const [inventoryQuantity, setInventoryQuantity] = useState(0);
  const [listingUrl, setListingUrl] = useState('');
  const [manualAction, setManualAction] = useState<'archive' | 'return'>('archive');
  const [manualReason, setManualReason] = useState('');
  const [manualApprovalDoc, setManualApprovalDoc] = useState('');
  const [showManualDisposition, setShowManualDisposition] = useState(false);

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
      setListingStatus(orderData.listingStatus);
      setInventoryStatus(orderData.inventoryStatus);
      setInventoryQuantity(orderData.inventoryQuantity);
      setListingUrl(orderData.listingUrl || '');
      setAuditLogs(logsData.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApiError = (e: any) => {
    const details = e.details || {};
    const blocks: BlockReason[] = details.blockReasons || [];
    if (order && blocks.length > 0) {
      setOrder({ ...order, blockReasons: blocks });
    }
    const msg = details.error || e.message || '操作失败';
    const step = details.nextStep || details.nextAction || '';
    const blockMsg = blocks.length > 0
      ? `\n\n阻断原因（${blocks.length}项）：\n${blocks.map(b => `· [${BLOCK_FIELD_TEXT[b.field]}] ${b.reason}`).join('\n')}`
      : '';
    const stepMsg = step ? `\n\n下一步：${step}` : '';
    alert(msg + blockMsg + stepMsg);
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

  const formatDeadlineWithStatus = (order: CrossBorderOrder) => {
    if (order.status === 'archived') {
      return { text: `截止 ${formatDateTime(order.deadline)}`, color: '#999' };
    }
    if (order.isOverdue) {
      return { text: `已逾期 · 截止 ${formatDateTime(order.deadline)}`, color: '#ff4d4f' };
    }
    const now = new Date();
    const deadline = new Date(order.deadline);
    const diffMs = deadline.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours <= order.warningHours && diffHours > 0) {
      return { text: `即将到期 · 截止 ${formatDateTime(order.deadline)}`, color: '#faad14' };
    }
    return { text: `截止 ${formatDateTime(order.deadline)}`, color: '#333' };
  };

  const hasHardBlock = order && order.blockReasons && order.blockReasons.some(b => b.level === 'error');
  const hasBlock = order && order.blockReasons && order.blockReasons.length > 0;

  const canSubmit = user?.role === 'registrar' &&
    order && (order.status === 'draft' || order.status === 'returned') &&
    !hasHardBlock;

  const canEditMaterials = user?.role === 'registrar' &&
    order && (order.status === 'draft' || order.status === 'returned');

  const canEditListing = user?.role === 'registrar' &&
    order && (order.status === 'draft' || order.status === 'returned');

  const canSupervisorPass = user?.role === 'supervisor' && order && order.status === 'pending' &&
    !order.isOverdue && !hasHardBlock;
  const canSupervisorReturn = user?.role === 'supervisor' && order && order.status === 'pending';

  const canReviewerPass = user?.role === 'reviewer' && order && order.status === 'processing' &&
    !order.isOverdue && !hasHardBlock;

  const canReviewerReturn = user?.role === 'reviewer' && order && order.status === 'processing';

  const canManualDisposition = user?.role === 'reviewer' && order && order.status === 'processing' &&
    (order.isOverdue || hasHardBlock);

  const handleSubmit = async () => {
    if (!order) return;
    setProcessing(true);
    try {
      const result = await api.submitOrder(order.id, order.version);
      if (result.warning) {
        alert(`提交成功，但有提示：${result.warning}`);
      } else {
        alert('提交成功，等待审核主管办理');
      }
      setOrder(result.order);
      setMaterials(result.order.materials);
    } catch (e: any) {
      handleApiError(e);
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveMaterials = async () => {
    if (!order) return;
    setProcessing(true);
    try {
      const result = await api.updateMaterials(order.id, materials, order.version);
      setOrder(result.order);
      setMaterials(result.order.materials);
      setEditingMaterials(false);
      if (result.warning) {
        alert(`材料已保存：${result.warning}`);
      } else {
        alert('材料保存成功');
      }
    } catch (e: any) {
      handleApiError(e);
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveListingInventory = async () => {
    if (!order) return;
    setProcessing(true);
    try {
      const result = await api.updateListingInventory(order.id, {
        listingStatus,
        inventoryStatus,
        inventoryQuantity,
        listingUrl,
        version: order.version,
      });
      setOrder(result.order);
      setListingStatus(result.order.listingStatus);
      setInventoryStatus(result.order.inventoryStatus);
      setInventoryQuantity(result.order.inventoryQuantity);
      setListingUrl(result.order.listingUrl || '');
      setEditingListing(false);
      if (result.warning) {
        alert(`已保存：${result.warning}`);
      } else {
        alert('刊登/库存信息保存成功');
      }
    } catch (e: any) {
      handleApiError(e);
    } finally {
      setProcessing(false);
    }
  };

  const handleSupervisorProcess = async (pass: boolean) => {
    if (!order) return;
    if (!pass && !opinion.trim()) {
      alert('退回必须填写处理意见');
      return;
    }
    setProcessing(true);
    try {
      const result = await api.supervisorProcessOrder(order.id, opinion, pass, order.version);
      setOrder(result.order);
      alert(pass ? '审核通过，已转交复核' : '已退回登记员补正');
    } catch (e: any) {
      handleApiError(e);
    } finally {
      setProcessing(false);
    }
  };

  const handleReviewerProcess = async (pass: boolean) => {
    if (!order) return;
    if (!pass && !opinion.trim()) {
      alert('退回必须填写处理意见');
      return;
    }
    setProcessing(true);
    try {
      const result = await api.reviewerProcessOrder(order.id, opinion, pass, order.version);
      setOrder(result.order);
      alert(pass ? '复核通过，已归档' : '已退回登记员补正');
    } catch (e: any) {
      handleApiError(e);
    } finally {
      setProcessing(false);
    }
  };

  const handleManualDisposition = async () => {
    if (!order) return;
    if (!manualReason.trim()) {
      alert('请填写人工处置原因');
      return;
    }
    if (manualAction === 'archive' && !manualApprovalDoc.trim()) {
      alert('人工归档必须填写审批文件编号');
      return;
    }
    setProcessing(true);
    try {
      const result = await api.manualDisposition(order.id, {
        action: manualAction,
        reason: manualReason,
        approvalDoc: manualAction === 'archive' ? manualApprovalDoc : undefined,
        opinion,
        version: order.version,
      });
      setOrder(result.order);
      setShowManualDisposition(false);
      setManualReason('');
      setManualApprovalDoc('');
      alert(manualAction === 'archive' ? '人工处置完成，已归档' : '人工处置完成，已退回补正');
    } catch (e: any) {
      handleApiError(e);
    } finally {
      setProcessing(false);
    }
  };

  const toggleMaterialUploaded = (idx: number) => {
    const newM = [...materials];
    newM[idx] = { ...newM[idx], uploaded: !newM[idx].uploaded };
    setMaterials(newM);
  };

  const renderBlockReasonList = (blocks?: BlockReason[]) => {
    if (!blocks || blocks.length === 0) return null;
    return (
      <div className="block-reason-list">
        {blocks.map((b, i) => (
          <div key={i} className={`block-item ${b.level}`}>
            <span
              className="block-field-label"
              style={{
                background: b.level === 'error' ? '#ff4d4f20' : '#faad1420',
                color: b.level === 'error' ? '#cf1322' : '#d46b08',
                border: `1px solid ${b.level === 'error' ? '#ffa39e' : '#ffd591'}`,
              }}
            >
              {BLOCK_FIELD_TEXT[b.field]}
            </span>
            <span style={{ marginLeft: '8px' }}>{b.reason}</span>
            <span className="block-level-tag" style={{
              marginLeft: '8px',
              background: b.level === 'error' ? '#cf1322' : '#d46b08',
              color: '#fff',
              padding: '1px 6px',
              borderRadius: '3px',
              fontSize: '11px',
            }}>
              {b.level === 'error' ? '硬阻断' : '提醒'}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="empty-state">加载中...</div>;
  }

  if (!order) {
    return <div className="empty-state">订单不存在</div>;
  }

  const deadline = formatDeadlineWithStatus(order);
  const materialCount = order.materials.length;
  const materialUploaded = order.materials.filter(m => m.uploaded).length;
  const materialRequiredMissing = order.materials.filter(m => m.required && !m.uploaded).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {order.orderNo}
            <span
              className="status-tag"
              style={{
                marginLeft: '12px',
                background: STATUS_COLOR[order.status] + '20',
                color: STATUS_COLOR[order.status],
                border: `1px solid ${STATUS_COLOR[order.status]}40`,
              }}
            >
              {STATUS_TEXT[order.status]}
            </span>
            {order.isOverdue && (
              <span className="status-tag overdue" style={{ marginLeft: '6px' }}>已逾期</span>
            )}
          </h1>
          <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>
            登记员：{order.registrarName}
            {order.supervisorName && ` · 审核主管：${order.supervisorName}`}
            {order.reviewerName && ` · 复核负责人：${order.reviewerName}`}
            <span style={{ marginLeft: '16px', color: deadline.color }}>
              {deadline.text}
            </span>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-default" onClick={() => navigate(-1)}>返回</button>
          <button className="btn btn-default" onClick={loadData}>刷新</button>
        </div>
      </div>

      {(order.isOverdue || hasHardBlock) && (
        <div className="alert-box alert-danger">
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>
            {order.isOverdue ? '订单已超过处理时限' : '订单存在硬阻断项'}
          </div>
          {order.nextAction && (
            <div style={{ marginBottom: '6px' }}>后续处理动作：{order.nextAction}</div>
          )}
          {canManualDisposition && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => setShowManualDisposition(true)}
              style={{ marginTop: '6px' }}
            >
              执行人工处置（仅复核负责人）
            </button>
          )}
        </div>
      )}

      {order.returnReason && (
        <div className="alert-box alert-warning">
          <div style={{ fontWeight: 600 }}>退回原因：</div>
          <div>{order.returnReason}</div>
        </div>
      )}

      {order.blockReasons && order.blockReasons.length > 0 && (
        <div className="card">
          <div className="card-title">推进阻断链路</div>
          {renderBlockReasonList(order.blockReasons)}
        </div>
      )}

      <div className="detail-grid">
        <div className="card">
          <div className="card-title">订单基本信息</div>
          <div className="info-row">
            <span className="info-label">商品名称</span>
            <span className="info-value">{order.productName}</span>
          </div>
          <div className="info-row">
            <span className="info-label">SKU</span>
            <span className="info-value">{order.productSku}</span>
          </div>
          <div className="info-row">
            <span className="info-label">数量</span>
            <span className="info-value">{order.quantity}</span>
          </div>
          <div className="info-row">
            <span className="info-label">金额</span>
            <span className="info-value">{order.currency} {order.amount.toFixed(2)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">销售平台</span>
            <span className="info-value">{order.platform}</span>
          </div>
          <div className="info-row">
            <span className="info-label">目的国家</span>
            <span className="info-value">{order.buyerCountry}</span>
          </div>
          <div className="info-row">
            <span className="info-label">备注</span>
            <span className="info-value">{order.remark || '—'}</span>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            商品刊登与库存
            {canEditListing && (
              <>
                {editingListing ? (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveListingInventory}
                      disabled={processing}
                      style={{ marginLeft: '8px' }}
                    >保存</button>
                    <button
                      className="btn btn-default btn-sm"
                      onClick={() => {
                        if (!order) return;
                        setListingStatus(order.listingStatus);
                        setInventoryStatus(order.inventoryStatus);
                        setInventoryQuantity(order.inventoryQuantity);
                        setListingUrl(order.listingUrl || '');
                        setEditingListing(false);
                      }}
                      style={{ marginLeft: '6px' }}
                    >取消</button>
                  </>
                ) : (
                  <button
                    className="btn btn-default btn-sm"
                    onClick={() => setEditingListing(true)}
                    style={{ marginLeft: '8px' }}
                  >编辑</button>
                )}
              </>
            )}
          </div>
          {editingListing ? (
            <>
              <div className="form-row">
                <label className="form-label">刊登状态</label>
                <select
                  className="form-input"
                  value={listingStatus}
                  onChange={(e) => setListingStatus(e.target.value as ListingStatus)}
                >
                  <option value="not_listed">未刊登</option>
                  <option value="active">刊登正常</option>
                  <option value="listing_failed">刊登失败</option>
                  <option value="delisted">已下架</option>
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">刊登链接</label>
                <input
                  className="form-input"
                  value={listingUrl}
                  onChange={(e) => setListingUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="form-row">
                <label className="form-label">库存同步状态</label>
                <select
                  className="form-input"
                  value={inventoryStatus}
                  onChange={(e) => setInventoryStatus(e.target.value as InventoryStatus)}
                >
                  <option value="not_synced">未同步</option>
                  <option value="synced">同步正常</option>
                  <option value="insufficient">库存不足</option>
                  <option value="sync_failed">同步失败</option>
                </select>
              </div>
              <div className="form-row">
                <label className="form-label">可用库存数量</label>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  value={inventoryQuantity}
                  onChange={(e) => setInventoryQuantity(parseInt(e.target.value || '0', 10))}
                />
              </div>
            </>
          ) : (
            <>
              <div className="info-row">
                <span className="info-label">刊登状态</span>
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
              </div>
              <div className="info-row">
                <span className="info-label">刊登链接</span>
                <span className="info-value">
                  {order.listingUrl ? (
                    <a href={order.listingUrl} target="_blank" rel="noreferrer">{order.listingUrl}</a>
                  ) : '—'}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">库存同步</span>
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
              </div>
              <div className="info-row">
                <span className="info-label">库存 / 订单量</span>
                <span className="info-value">
                  <span style={{
                    color: order.inventoryQuantity < order.quantity ? '#ff4d4f' : '#333',
                    fontWeight: 600,
                  }}>
                    {order.inventoryQuantity}
                  </span>
                  <span style={{ color: '#999' }}> / {order.quantity}</span>
                </span>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-title">
            材料清单（{materialUploaded}/{materialCount}
            {materialRequiredMissing > 0 && (
              <span style={{ color: '#ff4d4f', marginLeft: '6px' }}>缺 {materialRequiredMissing} 项必需</span>
            )}
            ）
            {canEditMaterials && (
              <>
                {editingMaterials ? (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveMaterials}
                      disabled={processing}
                      style={{ marginLeft: '8px' }}
                    >保存</button>
                    <button
                      className="btn btn-default btn-sm"
                      onClick={() => {
                        if (!order) return;
                        setMaterials(order.materials);
                        setEditingMaterials(false);
                      }}
                      style={{ marginLeft: '6px' }}
                    >取消</button>
                  </>
                ) : (
                  <button
                    className="btn btn-default btn-sm"
                    onClick={() => setEditingMaterials(true)}
                    style={{ marginLeft: '8px' }}
                  >编辑</button>
                )}
              </>
            )}
          </div>
          <div className="materials-list">
            {materials.map((m, i) => (
              <div key={i} className="material-item">
                <label style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={m.uploaded}
                    onChange={() => editingMaterials && toggleMaterialUploaded(i)}
                    disabled={!editingMaterials}
                  />
                  <span style={{ marginLeft: '8px' }}>
                    {m.name}
                    {m.required && <span style={{ color: '#ff4d4f' }}> *</span>}
                  </span>
                </label>
                <span style={{ fontSize: '12px', color: '#999' }}>{m.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {order.opinions && order.opinions.length > 0 && (
        <div className="card">
          <div className="card-title">处理意见</div>
          <div className="opinions-list">
            {order.opinions.map((op, i) => (
              <div key={i} className="opinion-item">
                <div className="opinion-header">
                  <strong>{op.userName}</strong>
                  <span className="opinion-role" style={{ marginLeft: '6px' }}>
                    ({ROLE_TEXT[op.role]})
                  </span>
                  <span className="opinion-pass-tag" style={{
                    marginLeft: '8px',
                    padding: '1px 6px',
                    borderRadius: '3px',
                    fontSize: '11px',
                    background: op.pass ? '#f6ffed' : '#fff1f0',
                    color: op.pass ? '#389e0d' : '#cf1322',
                    border: `1px solid ${op.pass ? '#b7eb8f' : '#ffa39e'}`,
                  }}>
                    {op.pass ? '通过' : '退回'}
                  </span>
                  <span className="opinion-time">{formatDateTime(op.time)}</span>
                </div>
                <div className="opinion-content">{op.content || '（无意见）'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {order.manualDispositions && order.manualDispositions.length > 0 && (
        <div className="card">
          <div className="card-title">人工处置记录</div>
          <div className="opinions-list">
            {order.manualDispositions.map((md, i) => (
              <div key={i} className="opinion-item">
                <div className="opinion-header">
                  <strong>{md.userName}</strong>
                  <span className="opinion-role" style={{ marginLeft: '6px' }}>
                    ({ROLE_TEXT[md.role]})
                  </span>
                  <span className="opinion-pass-tag" style={{
                    marginLeft: '8px',
                    padding: '1px 6px',
                    borderRadius: '3px',
                    fontSize: '11px',
                    background: md.action === 'archive' ? '#fff7e6' : '#fff1f0',
                    color: md.action === 'archive' ? '#d46b08' : '#cf1322',
                    border: `1px solid ${md.action === 'archive' ? '#ffd591' : '#ffa39e'}`,
                  }}>
                    人工{md.action === 'archive' ? '归档' : '退回'}
                  </span>
                  <span className="opinion-time">{formatDateTime(md.time)}</span>
                </div>
                <div className="opinion-content">
                  <div>原因：{md.reason}</div>
                  {md.approvalDoc && (
                    <div style={{ marginTop: '4px' }}>审批文件编号：{md.approvalDoc}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {auditLogs.length > 0 && (
        <div className="card">
          <div className="card-title">审计记录</div>
          <div className="audit-list">
            {auditLogs.map((log) => (
              <div key={log.id} className="audit-item">
                <div className="audit-time">{formatDateTime(log.time)}</div>
                <div className="audit-content">
                  <strong>
                    {log.userName} ({ROLE_TEXT[log.role]})
                  </strong>
                  <span style={{ margin: '0 6px', color: '#999' }}>执行</span>
                  <strong style={{ color: '#1890ff' }}>{log.action}</strong>
                  {log.detail && (
                    <div style={{ marginTop: '4px', color: '#666' }}>{log.detail}</div>
                  )}
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#999' }}>
                    {STATUS_TEXT[log.oldStatus]} → {STATUS_TEXT[log.newStatus]}
                    <span style={{ marginLeft: '12px' }}>IP：{log.ip}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {order.status !== 'archived' && (
        <div className="card action-card">
          <div className="card-title">操作区</div>
          {user?.role === 'registrar' && (
            <>
              <div className="form-row">
                <label className="form-label">登记员说明（可选）</label>
                <textarea
                  className="form-textarea"
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  placeholder="补充备注，提交时一并记录"
                />
              </div>
              <div className="action-buttons">
                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={processing || !canSubmit}
                >
                  {order.status === 'returned' ? '重新提交（补正后）' : '提交审核'}
                </button>
                {!canSubmit && order && (
                  <span style={{ color: order.status !== 'draft' && order.status !== 'returned' ? '#999' : '#cf1322', marginLeft: '8px' }}>
                    {order.status !== 'draft' && order.status !== 'returned'
                      ? '当前状态不支持提交（仅草稿/已退回可提交）'
                      : '存在阻断项（逾期/材料/刊登/库存问题），请先解除后再提交'}
                  </span>
                )}
              </div>
            </>
          )}
          {user?.role === 'supervisor' && (
            <>
              <div className="form-row">
                <label className="form-label">审核意见（退回必填）</label>
                <textarea
                  className="form-textarea"
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  placeholder={order.isOverdue || hasHardBlock ? '该订单有阻断，建议填写退回原因' : '同意推进或退回补正的理由'}
                />
              </div>
              {!canSupervisorPass && canSupervisorReturn && (order.isOverdue || hasHardBlock) && (
                <div style={{
                  padding: '8px 12px',
                  background: '#fff1f0',
                  border: '1px solid #ffa39e',
                  borderRadius: '4px',
                  color: '#cf1322',
                  marginBottom: '12px',
                }}>
                  {order.isOverdue
                    ? '该订单已逾期，不能直接审核通过。您可以退回补正，或由复核负责人进行人工处置。'
                    : '该订单存在硬阻断项（刊登/库存/材料问题），不能直接审核通过。您可以退回补正，或由复核负责人进行人工处置。'}
                </div>
              )}
              <div className="action-buttons">
                <button
                  className="btn btn-primary"
                  onClick={() => handleSupervisorProcess(true)}
                  disabled={processing || !canSupervisorPass}
                >审核通过</button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleSupervisorProcess(false)}
                  disabled={processing || !canSupervisorReturn}
                >退回补正</button>
              </div>
            </>
          )}
          {user?.role === 'reviewer' && (
            <>
              <div className="form-row">
                <label className="form-label">复核意见（退回必填）</label>
                <textarea
                  className="form-textarea"
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  placeholder={order.isOverdue || hasHardBlock ? '该订单存在阻断项，建议先人工处置或退回' : '同意归档或退回补正的理由'}
                />
              </div>
              {canManualDisposition && (
                <div style={{
                  padding: '8px 12px',
                  background: '#fff7e6',
                  border: '1px solid #ffd591',
                  borderRadius: '4px',
                  color: '#d46b08',
                  marginBottom: '12px',
                }}>
                  该订单存在阻断项，不能直接复核通过。您可以：
                  <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
                    <li>点击下方【人工处置】按钮，填写审批文件编号后归档或退回</li>
                    <li>点击【退回补正】按钮退回登记员整改</li>
                  </ul>
                </div>
              )}
              <div className="action-buttons">
                <button
                  className="btn btn-primary"
                  onClick={() => handleReviewerProcess(true)}
                  disabled={processing || !canReviewerPass}
                >复核通过并归档</button>
                {canManualDisposition && (
                  <button
                    className="btn btn-warning"
                    onClick={() => setShowManualDisposition(true)}
                    disabled={processing}
                  >人工处置...</button>
                )}
                <button
                  className="btn btn-danger"
                  onClick={() => handleReviewerProcess(false)}
                  disabled={processing || !canReviewerReturn}
                >退回补正</button>
              </div>
            </>
          )}
        </div>
      )}

      {showManualDisposition && order && (
        <div className="modal-mask" onClick={() => !processing && setShowManualDisposition(false)}>
          <div className="modal-box" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">人工处置（仅复核负责人）</div>
            <div style={{
              padding: '10px 12px',
              background: '#fff1f0',
              border: '1px solid #ffa39e',
              borderRadius: '4px',
              color: '#cf1322',
              marginBottom: '16px',
              fontSize: '13px',
            }}>
              订单 {order.orderNo} 已进入人工处置流程。此操作将记录审批文件编号，归档后订单不再出现在逾期预警中。
            </div>
            <div className="form-row">
              <label className="form-label">处置方式 *</label>
              <select
                className="form-input"
                value={manualAction}
                onChange={(e) => setManualAction(e.target.value as any)}
              >
                <option value="archive">人工归档</option>
                <option value="return">人工退回补正</option>
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">处置原因 *</label>
              <textarea
                className="form-textarea"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                placeholder="请详细说明人工处置的原因和背景"
              />
            </div>
            {manualAction === 'archive' && (
              <div className="form-row">
                <label className="form-label">审批文件编号 *</label>
                <input
                  className="form-input"
                  value={manualApprovalDoc}
                  onChange={(e) => setManualApprovalDoc(e.target.value)}
                  placeholder="例：CB-APPROVAL-2026-0610"
                />
              </div>
            )}
            <div className="form-row">
              <label className="form-label">复核意见（可选）</label>
              <textarea
                className="form-textarea"
                value={opinion}
                onChange={(e) => setOpinion(e.target.value)}
                placeholder="额外的复核意见"
              />
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-default"
                onClick={() => setShowManualDisposition(false)}
                disabled={processing}
              >取消</button>
              <button
                className="btn btn-primary"
                onClick={handleManualDisposition}
                disabled={processing}
              >确认执行</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
