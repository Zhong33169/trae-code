import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  api,
  statusLabels,
  roleLabels,
  materialTypeLabels,
  formatDate,
} from '../utils/api';
import type { Application, User, Material } from '../types';

interface ApplicationDetailProps {
  user: User;
}

export default function ApplicationDetail({ user }: ApplicationDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showStartAuditModal, setShowStartAuditModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showAuditPassModal, setShowAuditPassModal] = useState(false);
  const [showAuditRejectModal, setShowAuditRejectModal] = useState(false);
  const [showReviewPassModal, setShowReviewPassModal] = useState(false);
  const [showReviewRejectModal, setShowReviewRejectModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [opinion, setOpinion] = useState('');
  const [startAuditRemark, setStartAuditRemark] = useState('');
  const [correctionRequest, setCorrectionRequest] = useState('');
  const [materialReviews, setMaterialReviews] = useState<Record<number, { is_approved: boolean; review_comment: string }>>({});
  const [editForm, setEditForm] = useState<any>({});

  const loadDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.getApplication(parseInt(id));
      setApplication(data);
      const reviews: Record<number, { is_approved: boolean; review_comment: string }> = {};
      data.materials.forEach((m: Material) => {
        reviews[m.id] = {
          is_approved: m.is_approved !== null ? !!m.is_approved : true,
          review_comment: m.review_comment || '',
        };
      });
      setMaterialReviews(reviews);
    } catch (e: any) {
      showMessage('error', e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: string, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading || !application) {
    return (
      <div>
        <button className="btn btn-default" style={{ marginBottom: '16px' }} onClick={() => navigate(-1)}>
          ← 返回列表
        </button>
        <div className="card">
          <div className="empty-state">加载中...</div>
        </div>
      </div>
    );
  }

  const canSubmit = user.role === 'registrar' && application.status === 'draft';
  const canEdit = user.role === 'registrar' && (application.status === 'draft' || application.status === 'correction_requested');
  const canStartAudit = user.role === 'audit_supervisor' && (application.status === 'submitted' || application.status === 'corrected');
  const canRequestCorrection = user.role === 'audit_supervisor' && application.status === 'under_review';
  const canAuditPass = user.role === 'audit_supervisor' && application.status === 'under_review';
  const canAuditReject = user.role === 'audit_supervisor' && application.status === 'under_review';
  const canReviewPass = user.role === 'review_leader' && application.status === 'audit_passed';
  const canReviewReject = user.role === 'review_leader' && application.status === 'audit_passed';
  const canArchive = user.role === 'review_leader' && application.status === 'review_passed';

  const handleSubmit = async () => {
    try {
      await api.submitApplication(application.id);
      setShowSubmitModal(false);
      showMessage('success', '提交成功');
      loadDetail();
    } catch (e: any) {
      showMessage('error', e.message || '提交失败');
    }
  };

  const handleStartAudit = async () => {
    if (application?.is_overdue && !startAuditRemark.trim()) {
      showMessage('error', '该申请已逾期，请填写逾期处理说明');
      return;
    }
    try {
      await (fetch as any)(`/api/applications/${application?.id}/start-audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ remark: startAuditRemark || undefined }),
      }).then(async (res: any) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || '操作失败');
        }
        setShowStartAuditModal(false);
        setStartAuditRemark('');
        showMessage('success', '已开始审核');
        loadDetail();
      });
    } catch (e: any) {
      showMessage('error', e.message || '操作失败');
    }
  };

  const handleRequestCorrection = async () => {
    if (!correctionRequest) {
      showMessage('error', '请填写补正要求');
      return;
    }
    try {
      await api.requestCorrection(application.id, correctionRequest, materialReviews);
      setShowCorrectionModal(false);
      setCorrectionRequest('');
      showMessage('success', '补正要求已发送');
      loadDetail();
    } catch (e: any) {
      showMessage('error', e.message || '操作失败');
    }
  };

  const handleAuditPass = async () => {
    if (application?.is_overdue && !opinion.trim()) {
      showMessage('error', '该申请已逾期，审核通过必须填写逾期处理说明');
      return;
    }
    try {
      await api.auditPass(application.id, opinion || undefined, materialReviews);
      setShowAuditPassModal(false);
      setOpinion('');
      showMessage('success', '审核通过');
      loadDetail();
    } catch (e: any) {
      showMessage('error', e.message || '操作失败');
    }
  };

  const handleAuditReject = async () => {
    if (!opinion) {
      showMessage('error', '请填写拒绝理由');
      return;
    }
    try {
      await api.auditReject(application.id, opinion);
      setShowAuditRejectModal(false);
      setOpinion('');
      showMessage('success', '已拒绝');
      loadDetail();
    } catch (e: any) {
      showMessage('error', e.message || '操作失败');
    }
  };

  const handleReviewPass = async () => {
    if (application?.is_overdue && !opinion.trim()) {
      showMessage('error', '该申请已逾期，复核通过必须填写逾期处理说明');
      return;
    }
    try {
      await api.reviewPass(application.id, opinion || undefined);
      setShowReviewPassModal(false);
      setOpinion('');
      showMessage('success', '复核通过');
      loadDetail();
    } catch (e: any) {
      showMessage('error', e.message || '操作失败');
    }
  };

  const handleReviewReject = async () => {
    if (!opinion) {
      showMessage('error', '请填写复核意见');
      return;
    }
    try {
      await api.reviewReject(application.id, opinion);
      setShowReviewRejectModal(false);
      setOpinion('');
      showMessage('success', '已退回');
      loadDetail();
    } catch (e: any) {
      showMessage('error', e.message || '操作失败');
    }
  };

  const handleArchive = async () => {
    if (application?.is_overdue && !opinion.trim()) {
      showMessage('error', '该申请已逾期，归档必须填写逾期处理说明');
      return;
    }
    try {
      await api.archiveApplication(application.id, opinion || undefined);
      setShowArchiveModal(false);
      setOpinion('');
      showMessage('success', '已归档');
      loadDetail();
    } catch (e: any) {
      showMessage('error', e.message || '操作失败');
    }
  };

  const handleEditSubmit = async () => {
    if (!editForm.company_name || !editForm.contact_person || !editForm.contact_phone) {
      showMessage('error', '请填写必填项');
      return;
    }
    try {
      const data: any = { ...editForm };
      if (data.expected_area) {
        data.expected_area = parseFloat(data.expected_area);
      } else {
        delete data.expected_area;
      }
      await api.updateApplication(application.id, data);
      setShowEditModal(false);
      showMessage('success', '保存成功');
      loadDetail();
    } catch (e: any) {
      showMessage('error', e.message || '保存失败');
    }
  };

  const openEditModal = () => {
    setEditForm({
      company_name: application.company_name,
      contact_person: application.contact_person,
      contact_phone: application.contact_phone,
      contact_email: application.contact_email || '',
      booth_type: application.booth_type || '',
      booth_size: application.booth_size || '',
      expected_area: application.expected_area || '',
      industry: application.industry || '',
      product_description: application.product_description || '',
    });
    setShowEditModal(true);
  };

  const getNextStepHint = () => {
    const status = application.status;
    switch (status) {
      case 'draft':
        return '请完善申请信息后提交审核';
      case 'submitted':
        return '等待展商审核主管开始审核';
      case 'under_review':
        return '审核中，请等待审核结果';
      case 'correction_requested':
        return '请根据补正要求补充材料后重新提交';
      case 'corrected':
        return '已补正，等待审核主管复核';
      case 'audit_passed':
        return '等待展会主办方复核负责人复核';
      case 'rejected':
        return '申请已被拒绝';
      case 'review_passed':
        return '复核通过，等待归档';
      case 'archived':
        return '申请已归档';
      default:
        return '';
    }
  };

  const hasMaterials = application.materials && application.materials.length > 0;

  return (
    <div>
      {message && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '16px' }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button className="btn btn-default" onClick={() => navigate(-1)}>
          ← 返回列表
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canEdit && (
            <button className="btn btn-default" onClick={openEditModal}>
              编辑
            </button>
          )}
          {canSubmit && (
            <button className="btn btn-primary" onClick={() => setShowSubmitModal(true)}>
              提交审核
            </button>
          )}
          {canStartAudit && (
            <button className="btn btn-primary" onClick={() => setShowStartAuditModal(true)}>
              开始审核{application.is_overdue && '（逾期）'}
            </button>
          )}
          {canRequestCorrection && (
            <button className="btn btn-warning" onClick={() => setShowCorrectionModal(true)}>
              要求补正
            </button>
          )}
          {canAuditPass && (
            <button className="btn btn-success" onClick={() => setShowAuditPassModal(true)}>
              审核通过
            </button>
          )}
          {canAuditReject && (
            <button className="btn btn-danger" onClick={() => setShowAuditRejectModal(true)}>
              审核拒绝
            </button>
          )}
          {canReviewPass && (
            <button className="btn btn-success" onClick={() => setShowReviewPassModal(true)}>
              复核通过
            </button>
          )}
          {canReviewReject && (
            <button className="btn btn-danger" onClick={() => setShowReviewRejectModal(true)}>
              复核退回
            </button>
          )}
          {canArchive && (
            <button className="btn btn-primary" onClick={() => setShowArchiveModal(true)}>
              归档
            </button>
          )}
        </div>
      </div>

      {application.is_overdue && (
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>
          <strong>⚠ 已逾期</strong>
          {application.overdue_reason ? ` — ${application.overdue_reason}` : ''}
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>
              {application.company_name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontFamily: 'monospace', color: '#666' }}>
                申请编号：{application.application_no}
              </span>
              <span className={`status-tag status-${application.status}`}>
                {statusLabels[application.status]}
              </span>
              {application.is_overdue && <span className="overdue-tag">已逾期</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right', color: '#666', fontSize: '13px' }}>
            <div>创建时间：{formatDate(application.created_at)}</div>
            <div>状态变更：{formatDate(application.status_changed_at)}</div>
            {application.deadline_at && (
              <div style={{ color: application.is_overdue ? '#ff4d4f' : '#666' }}>
                截止时间：{formatDate(application.deadline_at)}
              </div>
            )}
          </div>
        </div>

        <div className="alert alert-info">
          <strong>当前阶段：</strong>{getNextStepHint()}
        </div>
      </div>

      <div className="card">
        <div className="detail-section-title">基本信息</div>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">公司名称：</span>
            <span className="detail-value">{application.company_name}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">联系人：</span>
            <span className="detail-value">{application.contact_person}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">联系电话：</span>
            <span className="detail-value">{application.contact_phone}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">邮箱：</span>
            <span className="detail-value">{application.contact_email || '-'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">展位类型：</span>
            <span className="detail-value">{application.booth_type || '-'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">展位尺寸：</span>
            <span className="detail-value">{application.booth_size || '-'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">预计面积：</span>
            <span className="detail-value">{application.expected_area ? `${application.expected_area} ㎡` : '-'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">所属行业：</span>
            <span className="detail-value">{application.industry || '-'}</span>
          </div>
          <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
            <span className="detail-label">产品/服务描述：</span>
            <span className="detail-value">{application.product_description || '-'}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="detail-section-title">申请材料</div>
        {!hasMaterials ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            暂无材料
          </div>
        ) : (
          application.materials.map((material) => (
            <div key={material.id} className="material-item">
              <div className="material-info">
                <span className={`material-status ${
                  material.is_approved === true ? 'material-approved' :
                  material.is_approved === false ? 'material-rejected' : 'material-pending'
                }`}>
                  {material.is_approved === true ? '通过' :
                   material.is_approved === false ? '不通过' : '待审核'}
                </span>
                <div>
                  <strong>{materialTypeLabels[material.material_type] || material.material_type}</strong>
                  <span style={{ marginLeft: '8px', color: '#666' }}>{material.material_name}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '12px', color: '#999' }}>
                <div>上传时间：{formatDate(material.uploaded_at)}</div>
                {material.review_comment && (
                  <div style={{ marginTop: '4px', color: '#666' }}>
                    审核意见：{material.review_comment}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {application.correction_request && (
        <div className="card">
          <div className="detail-section-title">补正要求</div>
          <div className="alert alert-warning" style={{ marginBottom: 0 }}>
            {application.correction_request}
          </div>
        </div>
      )}

      {application.audit_opinion && (
        <div className="card">
          <div className="detail-section-title">审核意见</div>
          <div style={{ padding: '12px', background: '#f6ffed', borderRadius: '4px' }}>
            {application.audit_opinion}
          </div>
        </div>
      )}

      {application.review_opinion && (
        <div className="card">
          <div className="detail-section-title">复核意见</div>
          <div style={{ padding: '12px', background: '#e6f7ff', borderRadius: '4px' }}>
            {application.review_opinion}
          </div>
        </div>
      )}

      <div className="card">
        <div className="detail-section-title">审计记录</div>
        {!application.audit_logs || application.audit_logs.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            暂无审计记录
          </div>
        ) : (
          <div className="audit-timeline">
            {application.audit_logs.map((log) => (
              <div key={log.id} className="audit-item">
                <div className="audit-dot"></div>
                <div className="audit-time">{formatDate(log.created_at)}</div>
                <div className="audit-content">
                  <strong>{log.action_name}</strong>
                  {log.from_status && log.to_status && (
                    <span style={{ marginLeft: '8px', color: '#666' }}>
                      {statusLabels[log.from_status]} → {statusLabels[log.to_status]}
                    </span>
                  )}
                </div>
                <div className="audit-operator">
                  操作人：{log.operator_name}
                  {log.remark && <span style={{ marginLeft: '12px' }}>备注：{log.remark}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSubmitModal && (
        <div className="modal-overlay" onClick={() => setShowSubmitModal(false)}>
          <div className="modal" style={{ width: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">提交审核</span>
              <span className="modal-close" onClick={() => setShowSubmitModal(false)}>×</span>
            </div>
            <div className="modal-body">
              <p>确认提交该展商申请？提交后将进入审核流程，不能再修改。</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowSubmitModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSubmit}>确认提交</button>
            </div>
          </div>
        </div>
      )}

      {showStartAuditModal && (
        <div className="modal-overlay" onClick={() => setShowStartAuditModal(false)}>
          <div className="modal" style={{ width: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                开始审核{application.is_overdue && <span style={{ color: '#cf1322', marginLeft: '8px' }}>（逾期，需填处理说明）</span>}
              </span>
              <span className="modal-close" onClick={() => setShowStartAuditModal(false)}>×</span>
            </div>
            <div className="modal-body">
              {application.is_overdue && (
                <div className="alert alert-warning" style={{ marginBottom: '16px', fontSize: '13px' }}>
                  <strong>⚠ 注意：</strong>该申请已逾期，
                  <span style={{ color: '#cf1322' }}>必须填写逾期处理说明</span>后才能开始审核。
                  <div style={{ marginTop: '6px', color: '#873800' }}>
                    逾期原因：{application.overdue_reason || '原因未知'}
                  </div>
                </div>
              )}
              <div className="form-item">
                <label className="form-label">
                  处理说明{application.is_overdue && <span style={{ color: '#ff4d4f' }}> *</span>}
                </label>
                <textarea
                  className="form-input form-textarea"
                  value={startAuditRemark}
                  onChange={(e) => setStartAuditRemark(e.target.value)}
                  placeholder={application.is_overdue ? '请填写逾期处理说明（必填）...' : '可选，填写审核备注'}
                  rows={application.is_overdue ? 4 : 3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowStartAuditModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleStartAudit}>确认开始审核</button>
            </div>
          </div>
        </div>
      )}

      {showCorrectionModal && (
        <div className="modal-overlay" onClick={() => setShowCorrectionModal(false)}>
          <div className="modal" style={{ width: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">要求补正</span>
              <span className="modal-close" onClick={() => setShowCorrectionModal(false)}>×</span>
            </div>
            <div className="modal-body">
              <div className="form-item">
                <label className="form-label">补正要求 *</label>
                <textarea
                  className="form-input form-textarea"
                  value={correctionRequest}
                  onChange={(e) => setCorrectionRequest(e.target.value)}
                  placeholder="请详细说明需要补正的内容"
                  rows={4}
                />
              </div>
              {hasMaterials && (
                <div className="form-item">
                  <label className="form-label">材料审核</label>
                  {application.materials.map((m) => (
                    <div key={m.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                          {materialTypeLabels[m.material_type]} - {m.material_name}
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="radio"
                              checked={materialReviews[m.id]?.is_approved === true}
                              onChange={() => setMaterialReviews({
                                ...materialReviews,
                                [m.id]: { ...materialReviews[m.id], is_approved: true },
                              })}
                            />
                            通过
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="radio"
                              checked={materialReviews[m.id]?.is_approved === false}
                              onChange={() => setMaterialReviews({
                                ...materialReviews,
                                [m.id]: { ...materialReviews[m.id], is_approved: false },
                              })}
                            />
                            不通过
                          </label>
                        </div>
                      </div>
                      <input
                        className="form-input"
                        type="text"
                        style={{ marginTop: '6px' }}
                        placeholder="审核意见（可选）"
                        value={materialReviews[m.id]?.review_comment || ''}
                        onChange={(e) => setMaterialReviews({
                          ...materialReviews,
                          [m.id]: { ...(materialReviews[m.id] || { is_approved: true }), review_comment: e.target.value },
                        })}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowCorrectionModal(false)}>取消</button>
              <button className="btn btn-warning" onClick={handleRequestCorrection}>发送补正要求</button>
            </div>
          </div>
        </div>
      )}

      {showAuditPassModal && (
        <div className="modal-overlay" onClick={() => setShowAuditPassModal(false)}>
          <div className="modal" style={{ width: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                审核通过{application.is_overdue && <span style={{ color: '#cf1322', marginLeft: '8px' }}>（逾期，需填处理说明）</span>}
              </span>
              <span className="modal-close" onClick={() => setShowAuditPassModal(false)}>×</span>
            </div>
            <div className="modal-body">
              {application.is_overdue && (
                <div className="alert alert-warning" style={{ marginBottom: '16px', fontSize: '13px' }}>
                  <strong>⚠ 注意：</strong>该申请已逾期，
                  <span style={{ color: '#cf1322' }}>必须填写逾期处理说明</span>后才能审核通过。
                  <div style={{ marginTop: '6px', color: '#873800' }}>
                    逾期原因：{application.overdue_reason || '原因未知'}
                  </div>
                </div>
              )}
              <p style={{ marginBottom: '16px' }}>确认该展商申请审核通过？通过后将进入复核阶段。</p>
              {hasMaterials && (
                <div className="form-item">
                  <label className="form-label">材料审核</label>
                  {application.materials.map((m) => (
                    <div key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px' }}>
                          {materialTypeLabels[m.material_type]} - {m.material_name}
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                            <input
                              type="radio"
                              checked={materialReviews[m.id]?.is_approved === true}
                              onChange={() => setMaterialReviews({
                                ...materialReviews,
                                [m.id]: { ...materialReviews[m.id], is_approved: true },
                              })}
                            />
                            通过
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                            <input
                              type="radio"
                              checked={materialReviews[m.id]?.is_approved === false}
                              onChange={() => setMaterialReviews({
                                ...materialReviews,
                                [m.id]: { ...materialReviews[m.id], is_approved: false },
                              })}
                            />
                            不通过
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="form-item">
                <label className="form-label">
                  审核意见{application.is_overdue && <span style={{ color: '#ff4d4f' }}> *（逾期必填）</span>}
                </label>
                <textarea
                  className="form-input form-textarea"
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  placeholder={application.is_overdue ? '请填写逾期处理说明（必填）...' : '请输入审核意见（可选）'}
                  rows={application.is_overdue ? 4 : 3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowAuditPassModal(false)}>取消</button>
              <button className="btn btn-success" onClick={handleAuditPass}>确认通过</button>
            </div>
          </div>
        </div>
      )}

      {showAuditRejectModal && (
        <div className="modal-overlay" onClick={() => setShowAuditRejectModal(false)}>
          <div className="modal" style={{ width: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">审核拒绝</span>
              <span className="modal-close" onClick={() => setShowAuditRejectModal(false)}>×</span>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px' }}>确认拒绝该展商申请？拒绝后申请将终止。</p>
              <div className="form-item">
                <label className="form-label">拒绝理由 *</label>
                <textarea
                  className="form-input form-textarea"
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  placeholder="请填写拒绝理由"
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowAuditRejectModal(false)}>取消</button>
              <button className="btn btn-danger" onClick={handleAuditReject}>确认拒绝</button>
            </div>
          </div>
        </div>
      )}

      {showReviewPassModal && (
        <div className="modal-overlay" onClick={() => setShowReviewPassModal(false)}>
          <div className="modal" style={{ width: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                复核通过{application.is_overdue && <span style={{ color: '#cf1322', marginLeft: '8px' }}>（逾期，需填处理说明）</span>}
              </span>
              <span className="modal-close" onClick={() => setShowReviewPassModal(false)}>×</span>
            </div>
            <div className="modal-body">
              {application.is_overdue && (
                <div className="alert alert-warning" style={{ marginBottom: '16px', fontSize: '13px' }}>
                  <strong>⚠ 注意：</strong>该申请已逾期，
                  <span style={{ color: '#cf1322' }}>必须填写逾期处理说明</span>后才能复核通过。
                  <div style={{ marginTop: '6px', color: '#873800' }}>
                    逾期原因：{application.overdue_reason || '原因未知'}
                  </div>
                </div>
              )}
              <p style={{ marginBottom: '16px' }}>确认复核通过？通过后可进行归档操作。</p>
              <div className="form-item">
                <label className="form-label">
                  复核意见{application.is_overdue && <span style={{ color: '#ff4d4f' }}> *（逾期必填）</span>}
                </label>
                <textarea
                  className="form-input form-textarea"
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  placeholder={application.is_overdue ? '请填写逾期处理说明（必填）...' : '请输入复核意见（可选）'}
                  rows={application.is_overdue ? 4 : 3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowReviewPassModal(false)}>取消</button>
              <button className="btn btn-success" onClick={handleReviewPass}>确认通过</button>
            </div>
          </div>
        </div>
      )}

      {showReviewRejectModal && (
        <div className="modal-overlay" onClick={() => setShowReviewRejectModal(false)}>
          <div className="modal" style={{ width: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">复核退回</span>
              <span className="modal-close" onClick={() => setShowReviewRejectModal(false)}>×</span>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px' }}>确认退回该申请？退回后将回到待审核状态。</p>
              <div className="form-item">
                <label className="form-label">退回理由 *</label>
                <textarea
                  className="form-input form-textarea"
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  placeholder="请填写退回理由"
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowReviewRejectModal(false)}>取消</button>
              <button className="btn btn-danger" onClick={handleReviewReject}>确认退回</button>
            </div>
          </div>
        </div>
      )}

      {showArchiveModal && (
        <div className="modal-overlay" onClick={() => setShowArchiveModal(false)}>
          <div className="modal" style={{ width: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                归档{application.is_overdue && <span style={{ color: '#cf1322', marginLeft: '8px' }}>（逾期，需填处理说明）</span>}
              </span>
              <span className="modal-close" onClick={() => setShowArchiveModal(false)}>×</span>
            </div>
            <div className="modal-body">
              {application.is_overdue && (
                <div className="alert alert-warning" style={{ marginBottom: '16px', fontSize: '13px' }}>
                  <strong>⚠ 注意：</strong>该申请已逾期，
                  <span style={{ color: '#cf1322' }}>必须填写逾期处理说明</span>后才能归档。
                  <div style={{ marginTop: '6px', color: '#873800' }}>
                    逾期原因：{application.overdue_reason || '原因未知'}
                  </div>
                </div>
              )}
              <p style={{ marginBottom: '16px' }}>确认归档该申请？归档后流程结束。</p>
              <div className="form-item">
                <label className="form-label">
                  归档备注{application.is_overdue && <span style={{ color: '#ff4d4f' }}> *（逾期必填）</span>}
                </label>
                <textarea
                  className="form-input form-textarea"
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  placeholder={application.is_overdue ? '请填写逾期处理说明（必填）...' : '归档备注（可选）'}
                  rows={application.is_overdue ? 4 : 2}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowArchiveModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleArchive}>确认归档</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" style={{ width: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">编辑申请信息</span>
              <span className="modal-close" onClick={() => setShowEditModal(false)}>×</span>
            </div>
            <div className="modal-body">
              <div className="form-item">
                <label className="form-label">公司名称 *</label>
                <input
                  className="form-input"
                  type="text"
                  value={editForm.company_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-item">
                  <label className="form-label">联系人 *</label>
                  <input
                    className="form-input"
                    type="text"
                    value={editForm.contact_person || ''}
                    onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
                  />
                </div>
                <div className="form-item">
                  <label className="form-label">联系电话 *</label>
                  <input
                    className="form-input"
                    type="text"
                    value={editForm.contact_phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-item">
                <label className="form-label">邮箱</label>
                <input
                  className="form-input"
                  type="email"
                  value={editForm.contact_email || ''}
                  onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-item">
                  <label className="form-label">展位类型</label>
                  <select
                    className="select"
                    style={{ width: '100%' }}
                    value={editForm.booth_type || ''}
                    onChange={(e) => setEditForm({ ...editForm, booth_type: e.target.value })}
                  >
                    <option value="">请选择</option>
                    <option value="标准展位">标准展位</option>
                    <option value="光地展位">光地展位</option>
                  </select>
                </div>
                <div className="form-item">
                  <label className="form-label">展位尺寸</label>
                  <input
                    className="form-input"
                    type="text"
                    value={editForm.booth_size || ''}
                    onChange={(e) => setEditForm({ ...editForm, booth_size: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-item">
                  <label className="form-label">预计面积(㎡)</label>
                  <input
                    className="form-input"
                    type="number"
                    value={editForm.expected_area || ''}
                    onChange={(e) => setEditForm({ ...editForm, expected_area: e.target.value })}
                  />
                </div>
                <div className="form-item">
                  <label className="form-label">所属行业</label>
                  <input
                    className="form-input"
                    type="text"
                    value={editForm.industry || ''}
                    onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-item">
                <label className="form-label">产品/服务描述</label>
                <textarea
                  className="form-input form-textarea"
                  value={editForm.product_description || ''}
                  onChange={(e) => setEditForm({ ...editForm, product_description: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowEditModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleEditSubmit}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
