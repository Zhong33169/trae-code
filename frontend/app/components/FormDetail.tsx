'use client';

import { useState, useEffect } from 'react';
import { MerchantOnboardingForm, Attachment, AuditLog, FormStatus, ActionType, statusLabels } from '../types';
import { getForm, executeFormAction, validateForm, addAttachment, deleteAttachment, getCurrentUser } from '../lib/api';
import Link from 'next/link';

interface FormDetailProps {
  formId: string;
}

export default function FormDetail({ formId }: FormDetailProps) {
  const [form, setForm] = useState<MerchantOnboardingForm | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [showActionModal, setShowActionModal] = useState<ActionType | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionRemark, setActionRemark] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<MerchantOnboardingForm>>({});
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [newAttachment, setNewAttachment] = useState({ fileName: '', fileType: 'application/pdf', remark: '' });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [formId]);

  useEffect(() => {
    getCurrentUser().then((res) => {
      if (res.success) setCurrentUser(res.data);
    });
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await getForm(formId);
      if (res.success) {
        setForm(res.data.form);
        setAttachments(res.data.attachments);
        setAuditLogs(res.data.auditLogs);
        setFormData(res.data.form);

        const valRes = await validateForm(formId);
        if (valRes.success && valRes.data.errors.length > 0) {
          setValidationErrors(valRes.data.errors);
        } else {
          setValidationErrors([]);
        }
      }
    } catch (err) {
      console.error('Failed to load form:', err);
    } finally {
      setLoading(false);
    }
  }

  const availableActions = getAvailableActions();

  function getAvailableActions(): Array<{ action: ActionType; label: string; type: string; reasonRequired?: boolean }> {
    if (!form || !currentUser) return [];

    if (form.hasException) {
      return [{ action: ActionType.ADD_AUDIT_NOTE, label: '添加审计备注', type: 'secondary' }];
    }

    if (form.currentRole !== currentUser.role && form.status !== FormStatus.ARCHIVED) {
      return [{ action: ActionType.ADD_AUDIT_NOTE, label: '添加审计备注', type: 'secondary' }];
    }

    const actions: Array<{ action: ActionType; label: string; type: string; reasonRequired?: boolean }> = [];

    switch (form.status) {
      case FormStatus.DRAFT:
        if (currentUser.role === 'CLERK') {
          actions.push({ action: ActionType.SUBMIT, label: '提交审核', type: 'primary' });
        }
        break;
      case FormStatus.SUBMITTED:
        if (currentUser.role === 'SUPERVISOR') {
          actions.push({ action: ActionType.START_REVIEW, label: '开始审核', type: 'primary' });
        }
        break;
      case FormStatus.UNDER_REVIEW:
        if (currentUser.role === 'SUPERVISOR') {
          actions.push({ action: ActionType.APPROVE_QUALIFICATION, label: '资质审核通过', type: 'success' });
          actions.push({ action: ActionType.REQUEST_MATERIALS, label: '退回补正', type: 'warning', reasonRequired: true });
          actions.push({ action: ActionType.REJECT, label: '驳回申请', type: 'danger', reasonRequired: true });
        }
        break;
      case FormStatus.MATERIALS_MISSING:
      case FormStatus.REJECTED:
        if (currentUser.role === 'CLERK') {
          actions.push({ action: ActionType.RESUBMIT, label: '补正后重提', type: 'primary' });
        }
        break;
      case FormStatus.QUALIFIED:
        if (currentUser.role === 'REVIEWER') {
          actions.push({ action: ActionType.OPEN_STORE, label: '开通店铺', type: 'success' });
        }
        break;
      case FormStatus.STORE_OPENED:
        if (currentUser.role === 'REVIEWER') {
          actions.push({ action: ActionType.ARCHIVE, label: '复核归档', type: 'success' });
        }
        break;
    }

    if (form.status !== FormStatus.ARCHIVED) {
      actions.push({ action: ActionType.ADD_AUDIT_NOTE, label: '添加审计备注', type: 'secondary' });
    }

    return actions;
  }

  async function handleAction(action: ActionType) {
    try {
      const data: any = {
        reason: actionReason || undefined,
        remark: actionRemark || undefined,
      };

      if (editMode && (action === ActionType.RESUBMIT || action === ActionType.SUBMIT)) {
        data.formData = formData;
      }

      const res = await executeFormAction(formId, action, data);
      if (res.success) {
        setMessage({ type: 'success', text: res.data.message || '操作成功' });
        setShowActionModal(null);
        setActionReason('');
        setActionRemark('');
        setEditMode(false);
        loadData();
      } else {
        setMessage({ type: 'error', text: res.error || res.message || '操作失败' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '操作失败' });
    }
  }

  async function handleAddAttachment() {
    if (!newAttachment.fileName) return;

    try {
      const res = await addAttachment(formId, {
        ...newAttachment,
        fileSize: 1024000,
      });
      if (res.success) {
        setMessage({ type: 'success', text: '附件上传成功' });
        setShowAttachmentModal(false);
        setNewAttachment({ fileName: '', fileType: 'application/pdf', remark: '' });
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: '附件上传失败' });
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!confirm('确定要删除此附件吗？')) return;

    try {
      const res = await deleteAttachment(formId, attachmentId);
      if (res.success) {
        setMessage({ type: 'success', text: '附件删除成功' });
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: '附件删除失败' });
    }
  }

  if (loading) {
    return <div className="empty-state">加载中...</div>;
  }

  if (!form) {
    return <div className="empty-state">入驻单不存在</div>;
  }

  const canEdit = currentUser?.role === 'CLERK' &&
    (form.status === FormStatus.DRAFT || form.status === FormStatus.MATERIALS_MISSING || form.status === FormStatus.REJECTED);

  const needsReason = availableActions.find((a) => a.action === showActionModal)?.reasonRequired;

  return (
    <div>
      <div className="breadcrumb">
        <Link href="/">待处理队列</Link>
        <span className="separator">/</span>
        <span>{form.merchantName}</span>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
          <button
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
            onClick={() => setMessage(null)}
          >
            ×
          </button>
        </div>
      )}

      {form.hasException && (
        <div className="alert alert-error">
          <strong>⚠️ 数据异常，无法继续处理</strong>
          <div style={{ marginTop: '8px' }}>{form.exceptionMessage}</div>
          {validationErrors.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              {validationErrors.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {form.offlineStatus && form.offlineStatus !== form.statusLabel && (
        <div className="alert alert-warning">
          <strong>⚠️ 状态不一致提醒</strong>
          <div style={{ marginTop: '4px' }}>
            线上状态：<strong>{form.statusLabel}</strong>
            <span style={{ margin: '0 12px' }}>|</span>
            离线台账状态：<strong>{form.offlineStatus}</strong>
          </div>
        </div>
      )}

      {form.isOverdue && (
        <div className="alert alert-warning">
          <strong>⚠️ 已超时</strong>
          <div style={{ marginTop: '4px' }}>
            截止时间：{form.deadline ? new Date(form.deadline).toLocaleString('zh-CN') : '-'}
          </div>
        </div>
      )}

      {validationErrors.length > 0 && !form.hasException && (
        <div className="alert alert-warning">
          <strong>⚠️ 数据校验提醒</strong>
          <div style={{ marginTop: '8px' }}>
            {validationErrors.map((err, i) => (
              <div key={i}>• {err}</div>
            ))}
          </div>
        </div>
      )}

      {form.currentRole !== currentUser?.role && !form.hasException && form.status !== FormStatus.ARCHIVED && (
        <div className="alert alert-info">
          <strong>ℹ️ 角色提醒</strong>
          <div style={{ marginTop: '4px' }}>
            当前单据应由 <strong>{form.currentRoleLabel}</strong> 处理，
            您当前角色为 <strong>{currentUser?.roleLabel}</strong>，仅可查看和添加审计备注。
          </div>
        </div>
      )}

      <div className="detail-page">
        <div>
          <div className="detail-card">
            <div className="section-header">
              <h2 style={{ margin: 0, border: 'none', padding: 0 }}>商家入驻单详情</h2>
              {canEdit && !editMode && (
                <button className="btn btn-secondary" onClick={() => setEditMode(true)}>
                  编辑信息
                </button>
              )}
              {editMode && (
                <button className="btn btn-secondary" onClick={() => { setEditMode(false); setFormData(form); }}>
                  取消编辑
                </button>
              )}
            </div>

            <div className="form-grid">
              <div className="form-item">
                <label>批次号</label>
                <div className="value">{form.batchNo}</div>
              </div>
              <div className="form-item">
                <label>当前状态</label>
                <div className="value">
                  <span className={`status-badge ${form.status}`} style={{ textTransform: 'lowercase' }}>
                    {form.statusLabel}
                  </span>
                </div>
              </div>
              <div className="form-item">
                <label>处理角色</label>
                <div className="value">{form.currentRoleLabel}</div>
              </div>
              <div className="form-item">
                <label>离线台账状态</label>
                {editMode ? (
                  <input
                    type="text"
                    value={formData.offlineStatus || ''}
                    onChange={(e) => setFormData({ ...formData, offlineStatus: e.target.value })}
                    placeholder="请输入离线台账状态"
                  />
                ) : (
                  <div className="value">{form.offlineStatus || '-'}</div>
                )}
              </div>
              <div className="form-item full-width">
                <label>商家名称</label>
                {editMode ? (
                  <input
                    type="text"
                    value={formData.merchantName || ''}
                    onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })}
                  />
                ) : (
                  <div className="value">{form.merchantName}</div>
                )}
              </div>
              <div className="form-item">
                <label>联系人</label>
                {editMode ? (
                  <input
                    type="text"
                    value={formData.contact || ''}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  />
                ) : (
                  <div className="value">{form.contact}</div>
                )}
              </div>
              <div className="form-item">
                <label>联系电话</label>
                {editMode ? (
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                ) : (
                  <div className="value">{form.phone}</div>
                )}
              </div>
              <div className="form-item">
                <label>电子邮箱</label>
                {editMode ? (
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                ) : (
                  <div className="value">{form.email || '-'}</div>
                )}
              </div>
              <div className="form-item">
                <label>法定代表人</label>
                {editMode ? (
                  <input
                    type="text"
                    value={formData.legalPerson || ''}
                    onChange={(e) => setFormData({ ...formData, legalPerson: e.target.value })}
                  />
                ) : (
                  <div className="value">{form.legalPerson || '-'}</div>
                )}
              </div>
              <div className="form-item">
                <label>注册资本</label>
                {editMode ? (
                  <input
                    type="text"
                    value={formData.registeredCapital || ''}
                    onChange={(e) => setFormData({ ...formData, registeredCapital: e.target.value })}
                  />
                ) : (
                  <div className="value">{form.registeredCapital || '-'}</div>
                )}
              </div>
              <div className="form-item full-width">
                <label>经营范围</label>
                {editMode ? (
                  <textarea
                    value={formData.businessScope || ''}
                    onChange={(e) => setFormData({ ...formData, businessScope: e.target.value })}
                  />
                ) : (
                  <div className="value">{form.businessScope || '-'}</div>
                )}
              </div>
            </div>
          </div>

          <div className="detail-card">
            <h2>资质信息</h2>
            <div className="form-grid">
              <div className="form-item">
                <label>营业执照号</label>
                {editMode ? (
                  <input
                    type="text"
                    value={formData.businessLicense || ''}
                    onChange={(e) => setFormData({ ...formData, businessLicense: e.target.value })}
                  />
                ) : (
                  <div className="value">{form.businessLicense || '-'}</div>
                )}
              </div>
              <div className="form-item">
                <label>税务登记证</label>
                {editMode ? (
                  <input
                    type="text"
                    value={formData.taxCertificate || ''}
                    onChange={(e) => setFormData({ ...formData, taxCertificate: e.target.value })}
                  />
                ) : (
                  <div className="value">{form.taxCertificate || '-'}</div>
                )}
              </div>
              <div className="form-item">
                <label>组织机构代码</label>
                {editMode ? (
                  <input
                    type="text"
                    value={formData.orgCode || ''}
                    onChange={(e) => setFormData({ ...formData, orgCode: e.target.value })}
                  />
                ) : (
                  <div className="value">{form.orgCode || '-'}</div>
                )}
              </div>
            </div>
          </div>

          {form.materialsMissingNote && (
            <div className="detail-card">
              <h2>补正材料说明</h2>
              <div style={{ padding: '12px', background: '#fff7ed', borderRadius: '6px', color: '#92400e' }}>
                {form.materialsMissingNote}
              </div>
            </div>
          )}

          {form.rejectReason && (
            <div className="detail-card">
              <h2>驳回原因</h2>
              <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '6px', color: '#991b1b' }}>
                {form.rejectReason}
              </div>
            </div>
          )}

          {form.auditRemark && (
            <div className="detail-card">
              <h2>审计备注</h2>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#374151' }}>
                {form.auditRemark}
              </div>
            </div>
          )}

          <div className="detail-card">
            <h2>处理时间线</h2>
            <div className="form-grid">
              <div className="form-item">
                <label>创建时间</label>
                <div className="value">{new Date(form.createdAt).toLocaleString('zh-CN')}</div>
              </div>
              {form.submittedAt && (
                <div className="form-item">
                  <label>提交时间</label>
                  <div className="value">{new Date(form.submittedAt).toLocaleString('zh-CN')}</div>
                </div>
              )}
              {form.reviewedAt && (
                <div className="form-item">
                  <label>审核时间</label>
                  <div className="value">{new Date(form.reviewedAt).toLocaleString('zh-CN')}</div>
                </div>
              )}
              {form.archivedAt && (
                <div className="form-item">
                  <label>归档时间</label>
                  <div className="value">{new Date(form.archivedAt).toLocaleString('zh-CN')}</div>
                </div>
              )}
              <div className="form-item">
                <label>截止时间</label>
                <div className="value">{form.deadline ? new Date(form.deadline).toLocaleString('zh-CN') : '-'}</div>
              </div>
            </div>
          </div>

          {availableActions.length > 0 && (
            <div className="detail-card">
              <h2>处理操作</h2>
              <div className="action-bar">
                {availableActions.map((a) => (
                  <button
                    key={a.action}
                    className={`btn btn-${a.type}`}
                    onClick={() => {
                      setShowActionModal(a.action);
                      setActionReason('');
                      setActionRemark('');
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="detail-card sidebar-section">
            <div className="section-header">
              <h3 style={{ margin: 0 }}>附件管理</h3>
              {!form.hasException && form.status !== FormStatus.ARCHIVED && (
                <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => setShowAttachmentModal(true)}>
                  + 上传
                </button>
              )}
            </div>
            {attachments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '13px' }}>
                暂无附件
              </div>
            ) : (
              attachments.map((att) => (
                <div key={att.id} className="attachment-item">
                  <div className="attachment-info">
                    <div className="attachment-icon">
                      {att.fileType.includes('pdf') ? 'PDF' : 'FILE'}
                    </div>
                    <div>
                      <div className="attachment-name">{att.fileName}</div>
                      <div className="attachment-meta">
                        {new Date(att.uploadedAt).toLocaleDateString('zh-CN')}
                        {att.remark && ` · ${att.remark}`}
                      </div>
                    </div>
                  </div>
                  {!form.hasException && form.status !== FormStatus.ARCHIVED && (
                    <button
                      className="btn btn-danger"
                      style={{ padding: '2px 8px', fontSize: '11px' }}
                      onClick={() => handleDeleteAttachment(att.id)}
                    >
                      删除
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="detail-card sidebar-section">
            <h3>审计日志</h3>
            {auditLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '13px' }}>
                暂无日志
              </div>
            ) : (
              <div className="audit-timeline">
                {auditLogs.map((log) => (
                  <div key={log.id} className="audit-item">
                    <div className="audit-action">{log.actionLabel}</div>
                    <div className="audit-operator">
                      {log.operatorName} · {log.operatorRoleLabel}
                    </div>
                    <div className="audit-time">
                      {new Date(log.createdAt).toLocaleString('zh-CN')}
                    </div>
                    {log.oldStatusLabel && log.newStatusLabel && (
                      <div className="audit-status-change">
                        <span style={{ color: '#6b7280' }}>{log.oldStatusLabel}</span>
                        <span className="arrow">→</span>
                        <span style={{ color: '#3b82f6', fontWeight: 500 }}>{log.newStatusLabel}</span>
                      </div>
                    )}
                    {log.reason && <div className="audit-reason">原因：{log.reason}</div>}
                    {log.remark && <div className="audit-reason">备注：{log.remark}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showActionModal && (
        <div className="modal-overlay" onClick={() => setShowActionModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {availableActions.find((a) => a.action === showActionModal)?.label}
            </h3>

            <div style={{ marginBottom: '16px', fontSize: '13px', color: '#374151' }}>
              商家：<strong>{form.merchantName}</strong>
              <br />
              当前状态：<strong>{form.statusLabel}</strong>
            </div>

            {needsReason && (
              <div className="form-item">
                <label>原因说明 <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="请输入原因..."
                  required
                />
              </div>
            )}

            <div className="form-item" style={{ marginTop: '12px' }}>
              <label>备注（可选）</label>
              <textarea
                value={actionRemark}
                onChange={(e) => setActionRemark(e.target.value)}
                placeholder="请输入备注..."
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowActionModal(null)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleAction(showActionModal)}
                disabled={needsReason && !actionReason}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {showAttachmentModal && (
        <div className="modal-overlay" onClick={() => setShowAttachmentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>上传附件</h3>

            <div className="form-item">
              <label>文件名称 <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                value={newAttachment.fileName}
                onChange={(e) => setNewAttachment({ ...newAttachment, fileName: e.target.value })}
                placeholder="请输入文件名称，如：营业执照.pdf"
              />
            </div>

            <div className="form-item" style={{ marginTop: '12px' }}>
              <label>文件类型</label>
              <select
                value={newAttachment.fileType}
                onChange={(e) => setNewAttachment({ ...newAttachment, fileType: e.target.value })}
              >
                <option value="application/pdf">PDF</option>
                <option value="image/jpeg">JPG</option>
                <option value="image/png">PNG</option>
                <option value="application/msword">DOC</option>
                <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">DOCX</option>
              </select>
            </div>

            <div className="form-item" style={{ marginTop: '12px' }}>
              <label>备注（可选）</label>
              <input
                type="text"
                value={newAttachment.remark}
                onChange={(e) => setNewAttachment({ ...newAttachment, remark: e.target.value })}
                placeholder="如：营业执照正本扫描件"
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAttachmentModal(false)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddAttachment}
                disabled={!newAttachment.fileName}
              >
                上传
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
