import { useState, useEffect } from 'react';
import { api, getCurrentUser } from '../lib/api';
import { STATUS_LABELS, STATUS_COLORS, ROLE_LABELS } from '../lib/types';
import type { Enrollment, Attachment, AuditLog, EnrollmentMaterialStatus } from '../lib/types';

interface EnrollmentDetailProps {
  id: number;
  onBack: () => void;
}

export default function EnrollmentDetail({ id, onBack }: EnrollmentDetailProps) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [materialStatus, setMaterialStatus] = useState<EnrollmentMaterialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'materials' | 'audit'>('materials');
  const [verifyReason, setVerifyReason] = useState('');
  const [reviewRemark, setReviewRemark] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rejectAttachId, setRejectAttachId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    setUser(getCurrentUser());
    loadDetail();
  }, [id]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const [data, matStatus] = await Promise.all([
        api.getEnrollment(id),
        api.getMaterialStatus(id),
      ]);
      setEnrollment(data);
      setMaterialStatus(matStatus);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!confirm('确定提交核验吗？')) return;
    try {
      await api.submitEnrollment(id);
      loadDetail();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleVerify = async (pass: boolean) => {
    if (!pass && !verifyReason) {
      alert('请输入退回原因');
      return;
    }
    try {
      await api.verifyEnrollment(id, pass, verifyReason);
      setShowVerifyModal(false);
      setVerifyReason('');
      loadDetail();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleReview = async (pass: boolean) => {
    if (!pass && !reviewReason) {
      alert('请输入退回原因');
      return;
    }
    try {
      await api.reviewEnrollment(id, pass, reviewReason, reviewRemark);
      setShowReviewModal(false);
      setReviewReason('');
      setReviewRemark('');
      loadDetail();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, attachType?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);
    formData.append('type', attachType || file.type);

    setUploading(true);
    try {
      await api.uploadAttachment(id, formData);
      loadDetail();
      setShowUploadModal(false);
      setUploadType('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const openUploadForType = (type: string) => {
    setUploadType(type);
    setShowUploadModal(true);
  };

  const handleApproveAttach = async (attachId: number) => {
    try {
      await api.approveAttachment(attachId);
      loadDetail();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRejectAttach = async () => {
    if (!rejectReason) {
      alert('请输入驳回原因');
      return;
    }
    if (rejectAttachId) {
      try {
        await api.rejectAttachment(rejectAttachId, rejectReason);
        setRejectAttachId(null);
        setRejectReason('');
        loadDetail();
      } catch (e: any) {
        alert(e.message);
      }
    }
  };

  const handleDeleteAttach = async (attachId: number) => {
    if (!confirm('确定删除此附件吗？')) return;
    try {
      await api.deleteAttachment(attachId);
      loadDetail();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading || !enrollment) {
    return <div className="loading">加载中...</div>;
  }

  const canUpload = user?.role === 'admission' && 
    (enrollment.status === 'draft' || enrollment.status === 'pending_correction');
  const canSubmit = user?.role === 'admission' && 
    (enrollment.status === 'draft' || enrollment.status === 'pending_correction');
  const canVerify = user?.role === 'academic' && enrollment.status === 'pending_verify';
  const canReview = user?.role === 'admin' && enrollment.status === 'pending_review';
  const canManageAttach = (user?.role === 'academic' || user?.role === 'admin') && 
    (enrollment.status === 'pending_verify' || enrollment.status === 'pending_review');

  const attachStatusColor: Record<string, string> = {
    pending: '#f59e0b',
    approved: '#10b981',
    rejected: '#ef4444',
  };

  const attachStatusLabel: Record<string, string> = {
    pending: '待核验',
    approved: '已通过',
    rejected: '已驳回',
  };

  return (
    <div className="detail-page">
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>
          ← 返回列表
        </button>
        <h2 className="detail-title">
          报名单 #{enrollment.id} - {enrollment.student_name}
        </h2>
        <span
          className="status-badge-large"
          style={{
            background: STATUS_COLORS[enrollment.status] + '20',
            color: STATUS_COLORS[enrollment.status],
            border: `1px solid ${STATUS_COLORS[enrollment.status]}40`,
          }}
        >
          {STATUS_LABELS[enrollment.status]}
          {enrollment.is_overdue && ' (超时)'}
        </span>
      </div>

      <div className="detail-content">
        <div className="detail-main">
          <div className="info-card">
            <h3>基本信息</h3>
            <div className="info-grid">
              <div className="info-item">
                <label>学员姓名</label>
                <span>{enrollment.student_name}</span>
              </div>
              <div className="info-item">
                <label>身份证号</label>
                <span>{enrollment.id_card}</span>
              </div>
              <div className="info-item">
                <label>联系电话</label>
                <span>{enrollment.phone}</span>
              </div>
              <div className="info-item">
                <label>报名专业</label>
                <span>{enrollment.major}</span>
              </div>
              <div className="info-item">
                <label>创建人</label>
                <span>{enrollment.created_by_name}</span>
              </div>
              <div className="info-item">
                <label>创建时间</label>
                <span>{new Date(enrollment.created_at).toLocaleString()}</span>
              </div>
              <div className="info-item">
                <label>截止日期</label>
                <span className={enrollment.is_overdue ? 'overdue-text' : ''}>
                  {enrollment.deadline ? new Date(enrollment.deadline).toLocaleDateString() : '-'}
                </span>
              </div>
            </div>
          </div>

          {enrollment.reject_reason && (
            <div className="info-card reject-card">
              <h3>⚠️ 退回原因</h3>
              <p>{enrollment.reject_reason}</p>
            </div>
          )}

          {enrollment.admin_remark && (
            <div className="info-card remark-card">
              <h3>📝 校务复核备注</h3>
              <p>{enrollment.admin_remark}</p>
            </div>
          )}

          <div className="tabs">
            <button
              className={`tab ${activeTab === 'materials' ? 'active' : ''}`}
              onClick={() => setActiveTab('materials')}
            >
              � 材料清单
              {materialStatus && (materialStatus.missing_count > 0 || materialStatus.rejected_count > 0) && (
                <span className="tab-badge">
                  {materialStatus.missing_count + materialStatus.rejected_count}
                </span>
              )}
            </button>
            <button
              className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
              onClick={() => setActiveTab('audit')}
            >
              📜 审计日志 ({enrollment.audit_logs?.length || 0})
            </button>
          </div>

          {activeTab === 'materials' && materialStatus && (
            <div className="materials-section">
              <div className="materials-summary">
                <div className="summary-item ok">
                  <span className="summary-icon">✅</span>
                  <span className="summary-label">可提交</span>
                  <span className="summary-value">{materialStatus.can_submit ? '是' : '否'}</span>
                </div>
                <div className="summary-item missing">
                  <span className="summary-icon">❌</span>
                  <span className="summary-label">缺失材料</span>
                  <span className="summary-value">{materialStatus.missing_count} 项</span>
                </div>
                <div className="summary-item rejected">
                  <span className="summary-icon">⚠️</span>
                  <span className="summary-label">驳回材料</span>
                  <span className="summary-value">{materialStatus.rejected_count} 项</span>
                </div>
              </div>

              <div className="material-list">
                {materialStatus.materials.map((mat) => {
                  const attachment = enrollment.attachments?.find(a => a.type === mat.type);
                  const isMissing = mat.required && !mat.has_attachment;
                  const isRejected = mat.is_rejected;
                  const isPending = mat.has_attachment && mat.status === 'pending';
                  const isApproved = mat.has_attachment && mat.status === 'approved';

                  let statusClass = 'pending';
                  let statusText = '未上传';
                  let statusIcon = '📄';

                  if (isMissing) {
                    statusClass = 'missing';
                    statusText = '缺失';
                    statusIcon = '❌';
                  } else if (isRejected) {
                    statusClass = 'rejected';
                    statusText = '已驳回';
                    statusIcon = '⚠️';
                  } else if (isApproved) {
                    statusClass = 'approved';
                    statusText = '已通过';
                    statusIcon = '✅';
                  } else if (isPending) {
                    statusClass = 'pending';
                    statusText = '待核验';
                    statusIcon = '⏳';
                  } else if (mat.has_attachment) {
                    statusClass = 'pending';
                    statusText = '待核验';
                    statusIcon = '⏳';
                  }

                  return (
                    <div key={mat.type} className={`material-item ${statusClass}`}>
                      <div className="material-left">
                        <span className="material-icon">{statusIcon}</span>
                        <div className="material-info">
                          <div className="material-name">
                            {mat.name}
                            {mat.required && <span className="required-tag">必填</span>}
                            {!mat.required && <span className="optional-tag">选填</span>}
                          </div>
                          {mat.reject_reason && (
                            <div className="material-reject-reason">
                              驳回原因：{mat.reject_reason}
                            </div>
                          )}
                          {attachment && (
                            <div className="attachment-detail">
                              <span>文件名：{attachment.name}</span>
                              <span>上传人：{attachment.uploaded_by_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="material-right">
                        <span className={`material-status-tag ${statusClass}`}>
                          {statusText}
                        </span>
                        <div className="material-actions">
                          {canUpload && (
                            <label className="btn-small upload-small">
                              <input
                                type="file"
                                style={{ display: 'none' }}
                                onChange={(e) => handleFileUpload(e, mat.type)}
                                disabled={uploading}
                              />
                              {uploading && uploadType === mat.type ? '上传中...' : '上传/替换'}
                            </label>
                          )}
                          {canManageAttach && attachment && attachment.status === 'pending' && (
                            <>
                              <button
                                className="btn-small success"
                                onClick={() => handleApproveAttach(attachment.id)}
                              >
                                通过
                              </button>
                              <button
                                className="btn-small danger"
                                onClick={() => {
                                  setRejectAttachId(attachment.id);
                                  setRejectReason('');
                                }}
                              >
                                驳回
                              </button>
                            </>
                          )}
                          {canUpload && attachment && (
                            <button
                              className="btn-small danger"
                              onClick={() => handleDeleteAttach(attachment.id)}
                            >
                              删除
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {canUpload && (
                <div className="upload-other-section">
                  <h4>其他附件</h4>
                  <div className="other-attachments">
                    {enrollment.attachments?.filter(a => !materialStatus.materials.find(m => m.type === a.type))
                      .map(att => (
                        <div key={att.id} className="attachment-mini">
                          <span>📄 {att.name}</span>
                          <span className={`mini-status ${att.status}`}>
                            {attachStatusLabel[att.status]}
                          </span>
                        </div>
                      ))}
                  </div>
                  <label className="upload-btn small">
                    <input
                      type="file"
                      onChange={(e) => handleFileUpload(e, 'other')}
                      style={{ display: 'none' }}
                      disabled={uploading}
                    />
                    📤 上传其他附件
                  </label>
                </div>
              )}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="audit-section">
              {enrollment.audit_logs?.length === 0 ? (
                <div className="empty">暂无审计记录</div>
              ) : (
                <div className="audit-timeline">
                  {enrollment.audit_logs?.map((log) => (
                    <div key={log.id} className="audit-item">
                      <div className="audit-dot"></div>
                      <div className="audit-content">
                        <div className="audit-header">
                          <span className="audit-action">{log.action}</span>
                          <span className="audit-time">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="audit-user">
                          {log.user_name} ({ROLE_LABELS[log.user_role] || log.user_role})
                        </div>
                        {log.reason && (
                          <div className="audit-reason">原因：{log.reason}</div>
                        )}
                        {log.from_status && log.to_status && (
                          <div className="audit-status">
                            状态：{STATUS_LABELS[log.from_status as keyof typeof STATUS_LABELS] || log.from_status} 
                            → {STATUS_LABELS[log.to_status as keyof typeof STATUS_LABELS] || log.to_status}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="detail-sidebar">
          <div className="action-card">
            <h3>操作</h3>
            
            {canSubmit && (
              <button className="action-btn primary" onClick={handleSubmit}>
                ✅ 提交核验
              </button>
            )}

            {canVerify && (
              <>
                <button
                  className="action-btn success"
                  onClick={() => setShowVerifyModal(true)}
                >
                  ✅ 核验通过
                </button>
                <button
                  className="action-btn danger"
                  onClick={() => {
                    setVerifyReason('');
                    setShowVerifyModal(true);
                  }}
                >
                  ❌ 核验退回
                </button>
              </>
            )}

            {canReview && (
              <>
                <button
                  className="action-btn success"
                  onClick={() => setShowReviewModal(true)}
                >
                  ✅ 复核归档
                </button>
                <button
                  className="action-btn danger"
                  onClick={() => {
                    setReviewReason('');
                    setShowReviewModal(true);
                  }}
                >
                  ❌ 复核退回
                </button>
              </>
            )}

            {!canSubmit && !canVerify && !canReview && (
              <p className="no-action">当前状态无可用操作</p>
            )}
          </div>

          <div className="status-flow-card">
            <h3>状态流转</h3>
            <div className="flow-steps">
              <div className={`flow-step ${['draft', 'pending_verify', 'pending_correction', 'pending_review', 'archived', 'rejected'].includes(enrollment.status) ? 'done' : ''}`}>
                <span className="step-num">1</span>
                <span className="step-label">创建草稿</span>
              </div>
              <div className="flow-line"></div>
              <div className={`flow-step ${['pending_verify', 'pending_correction', 'pending_review', 'archived', 'rejected'].includes(enrollment.status) ? 'done' : ''}`}>
                <span className="step-num">2</span>
                <span className="step-label">教务核验</span>
              </div>
              <div className="flow-line"></div>
              <div className={`flow-step ${['pending_review', 'archived'].includes(enrollment.status) ? 'done' : ''} ${enrollment.status === 'pending_correction' ? 'current' : ''}`}>
                <span className="step-num">↺</span>
                <span className="step-label">补正材料</span>
              </div>
              <div className="flow-line"></div>
              <div className={`flow-step ${['archived'].includes(enrollment.status) ? 'done' : ''} ${enrollment.status === 'pending_review' ? 'current' : ''}`}>
                <span className="step-num">3</span>
                <span className="step-label">校务复核</span>
              </div>
              <div className="flow-line"></div>
              <div className={`flow-step ${enrollment.status === 'archived' ? 'done' : ''}`}>
                <span className="step-num">4</span>
                <span className="step-label">归档完成</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showVerifyModal && (
        <div className="modal-overlay" onClick={() => setShowVerifyModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>核验处理</h3>
            <div className="form-group">
              <label>处理原因（退回必填）</label>
              <textarea
                value={verifyReason}
                onChange={(e) => setVerifyReason(e.target.value)}
                placeholder="请输入处理原因..."
                rows={4}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowVerifyModal(false)}>
                取消
              </button>
              <button className="btn-success" onClick={() => handleVerify(true)}>
                通过核验
              </button>
              <button className="btn-danger" onClick={() => handleVerify(false)}>
                退回补正
              </button>
            </div>
          </div>
        </div>
      )}

      {showReviewModal && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>复核处理</h3>
            <div className="form-group">
              <label>复核备注</label>
              <textarea
                value={reviewRemark}
                onChange={(e) => setReviewRemark(e.target.value)}
                placeholder="请输入复核备注（可选）..."
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>退回原因（退回必填）</label>
              <textarea
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                placeholder="退回时请填写原因..."
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowReviewModal(false)}>
                取消
              </button>
              <button className="btn-success" onClick={() => handleReview(true)}>
                复核归档
              </button>
              <button className="btn-danger" onClick={() => handleReview(false)}>
                退回补正
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectAttachId !== null && (
        <div className="modal-overlay" onClick={() => setRejectAttachId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>驳回附件</h3>
            <div className="form-group">
              <label>驳回原因</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="请输入驳回原因..."
                rows={4}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setRejectAttachId(null)}>
                取消
              </button>
              <button className="btn-danger" onClick={handleRejectAttach}>
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .detail-page {
          padding: 24px;
        }
        .detail-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .back-btn {
          background: none;
          border: none;
          color: #3b82f6;
          cursor: pointer;
          font-size: 14px;
          padding: 8px 0;
        }
        .back-btn:hover { text-decoration: underline; }
        .detail-title {
          flex: 1;
          font-size: 20px;
          font-weight: 600;
          color: #1f2937;
          margin: 0;
        }
        .status-badge-large {
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
        }
        .detail-content {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 24px;
        }
        .info-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .info-card h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          color: #1f2937;
        }
        .reject-card {
          border-left: 4px solid #ef4444;
          background: #fef2f2;
        }
        .reject-card p {
          margin: 0;
          color: #991b1b;
          font-size: 14px;
          line-height: 1.6;
        }
        .remark-card {
          border-left: 4px solid #3b82f6;
          background: #eff6ff;
        }
        .remark-card p {
          margin: 0;
          color: #1e40af;
          font-size: 14px;
          line-height: 1.6;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .info-item label {
          display: block;
          font-size: 13px;
          color: #6b7280;
          margin-bottom: 4px;
        }
        .info-item span {
          font-size: 14px;
          color: #1f2937;
          font-weight: 500;
        }
        .overdue-text { color: #ef4444; font-weight: 600; }
        .tabs {
          display: flex;
          gap: 0;
          background: white;
          border-radius: 12px 12px 0 0;
          border-bottom: 1px solid #e5e7eb;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .tab {
          flex: 1;
          padding: 14px 20px;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 14px;
          color: #6b7280;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        .tab.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
          font-weight: 500;
        }
        .attachments-section, .audit-section {
          background: white;
          border-radius: 0 0 12px 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .upload-section {
          margin-bottom: 16px;
        }
        .upload-btn {
          display: inline-block;
          padding: 10px 20px;
          background: #3b82f6;
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
        }
        .upload-btn:hover { background: #2563eb; }
        .attachments-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }
        .attachment-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          display: flex;
          gap: 12px;
          flex-direction: column;
        }
        .attach-icon { font-size: 32px; }
        .attach-name {
          font-weight: 500;
          color: #1f2937;
          font-size: 14px;
          margin-bottom: 4px;
        }
        .attach-meta {
          font-size: 12px;
          color: #9ca3af;
          margin-bottom: 2px;
        }
        .attach-status {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 12px;
          margin-top: 4px;
        }
        .attach-reject-reason {
          background: #fef2f2;
          color: #991b1b;
          padding: 8px;
          border-radius: 6px;
          font-size: 12px;
        }
        .attach-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }
        .btn-small {
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
        }
        .btn-small.success { background: #10b981; color: white; }
        .btn-small.danger { background: #ef4444; color: white; }
        .upload-small {
          background: #3b82f6;
          color: white;
          display: inline-block;
          text-align: center;
        }
        .tab-badge {
          display: inline-block;
          min-width: 18px;
          height: 18px;
          line-height: 18px;
          padding: 0 5px;
          margin-left: 6px;
          background: #ef4444;
          color: white;
          border-radius: 9px;
          font-size: 11px;
          text-align: center;
        }
        .materials-section, .audit-section {
          background: white;
          border-radius: 0 0 12px 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .materials-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        .summary-item {
          padding: 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .summary-item.ok { background: #ecfdf5; }
        .summary-item.missing { background: #fef2f2; }
        .summary-item.rejected { background: #fffbeb; }
        .summary-icon { font-size: 20px; }
        .summary-label {
          font-size: 13px;
          color: #6b7280;
          flex: 1;
        }
        .summary-value {
          font-size: 16px;
          font-weight: 600;
        }
        .material-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
        }
        .material-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          gap: 16px;
        }
        .material-item.missing {
          border-color: #fca5a5;
          background: #fef2f2;
        }
        .material-item.rejected {
          border-color: #fcd34d;
          background: #fffbeb;
        }
        .material-item.approved {
          border-color: #6ee7b7;
          background: #ecfdf5;
        }
        .material-left {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          flex: 1;
        }
        .material-icon { font-size: 24px; }
        .material-name {
          font-size: 14px;
          font-weight: 500;
          color: #1f2937;
          margin-bottom: 4px;
        }
        .required-tag {
          display: inline-block;
          padding: 1px 6px;
          background: #ef4444;
          color: white;
          border-radius: 4px;
          font-size: 10px;
          margin-left: 6px;
          font-weight: 400;
        }
        .optional-tag {
          display: inline-block;
          padding: 1px 6px;
          background: #9ca3af;
          color: white;
          border-radius: 4px;
          font-size: 10px;
          margin-left: 6px;
          font-weight: 400;
        }
        .material-reject-reason {
          font-size: 12px;
          color: #92400e;
          margin-top: 4px;
        }
        .attachment-detail {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }
        .material-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }
        .material-status-tag {
          padding: 2px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }
        .material-status-tag.missing { background: #fee2e2; color: #dc2626; }
        .material-status-tag.rejected { background: #fef3c7; color: #d97706; }
        .material-status-tag.approved { background: #d1fae5; color: #059669; }
        .material-status-tag.pending { background: #e0e7ff; color: #4f46e5; }
        .material-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .upload-other-section {
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }
        .upload-other-section h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: #374151;
        }
        .other-attachments {
          margin-bottom: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .attachment-mini {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          background: #f9fafb;
          border-radius: 6px;
          font-size: 13px;
        }
        .mini-status.pending { color: #4f46e5; }
        .mini-status.approved { color: #059669; }
        .mini-status.rejected { color: #dc2626; }
        .upload-btn.small {
          padding: 6px 12px;
          font-size: 13px;
        }
        .audit-timeline {
          position: relative;
          padding-left: 24px;
        }
        .audit-item {
          position: relative;
          padding-bottom: 20px;
        }
        .audit-dot {
          position: absolute;
          left: -24px;
          top: 4px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #3b82f6;
          border: 2px solid white;
          box-shadow: 0 0 0 2px #3b82f6;
        }
        .audit-item::before {
          content: '';
          position: absolute;
          left: -19px;
          top: 16px;
          bottom: 0;
          width: 2px;
          background: #e5e7eb;
        }
        .audit-item:last-child::before { display: none; }
        .audit-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .audit-action {
          font-weight: 600;
          color: #1f2937;
          font-size: 14px;
        }
        .audit-time {
          font-size: 12px;
          color: #9ca3af;
        }
        .audit-user {
          font-size: 13px;
          color: #6b7280;
          margin-top: 4px;
        }
        .audit-reason {
          font-size: 13px;
          color: #ef4444;
          margin-top: 4px;
        }
        .audit-status {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }
        .detail-sidebar {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .action-card, .status-flow-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .action-card h3, .status-flow-card h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          color: #1f2937;
        }
        .action-btn {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          margin-bottom: 8px;
        }
        .action-btn.primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .action-btn.success { background: #10b981; color: white; }
        .action-btn.danger { background: #ef4444; color: white; }
        .no-action {
          text-align: center;
          color: #9ca3af;
          font-size: 14px;
          padding: 20px 0;
        }
        .flow-steps {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .flow-step {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
        }
        .step-num {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #e5e7eb;
          color: #9ca3af;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }
        .flow-step.done .step-num {
          background: #10b981;
          color: white;
        }
        .flow-step.current .step-num {
          background: #f59e0b;
          color: white;
        }
        .step-label {
          font-size: 14px;
          color: #6b7280;
        }
        .flow-step.done .step-label { color: #1f2937; font-weight: 500; }
        .flow-line {
          width: 2px;
          height: 12px;
          background: #e5e7eb;
          margin-left: 13px;
        }
        .empty {
          text-align: center;
          padding: 40px;
          color: #9ca3af;
        }
        .loading {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal {
          background: white;
          border-radius: 12px;
          padding: 24px;
          width: 100%;
          max-width: 480px;
        }
        .modal h3 {
          margin: 0 0 16px 0;
          font-size: 18px;
        }
        .form-group {
          margin-bottom: 16px;
        }
        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 14px;
          color: #374151;
        }
        .form-group textarea, .form-group input {
          width: 100%;
          padding: 10px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
          font-family: inherit;
        }
        .modal-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        .btn-cancel {
          padding: 10px 20px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 8px;
          cursor: pointer;
        }
        .btn-success {
          padding: 10px 20px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }
        .btn-danger {
          padding: 10px 20px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }
        @media (max-width: 900px) {
          .detail-content { grid-template-columns: 1fr; }
          .info-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
