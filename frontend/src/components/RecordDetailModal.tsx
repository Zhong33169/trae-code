import React, { useState, useEffect } from 'react';
import {
  FollowUpRecord, STATUS_NAMES, STATUS_COLORS,
  ROLE_NAMES, ApiError, Patient, Appointment, Visit, FollowUpVisit,
} from '../types';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import './RecordDetailModal.css';

interface RecordDetailModalProps {
  record: FollowUpRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

const RecordDetailModal: React.FC<RecordDetailModalProps> = ({ record, onClose, onSuccess }) => {
  const { currentRole, currentUsername } = useAuth();
  const [detail, setDetail] = useState<FollowUpRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [processing, setProcessing] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    appointment_id: null as number | null,
    visit_id: null as number | null,
    follow_up_visit_id: null as number | null,
    follow_up_type: '',
    content: '',
    result: '',
    remarks: '',
  });

  const [evidenceData, setEvidenceData] = useState<{
    appointments: Appointment[];
    visits: Visit[];
    follow_up_visits: FollowUpVisit[];
  } | null>(null);

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLogsVisible, setAuditLogsVisible] = useState(false);

  const [opinion, setOpinion] = useState('');

  useEffect(() => {
    if (record) {
      loadDetail(record.id);
      setError(null);
    }
  }, [record]);

  const loadDetail = async (id: number) => {
    setLoading(true);
    try {
      const data = await api.getRecord(id);
      setDetail(data);
      setEditForm({
        appointment_id: data.appointment_id,
        visit_id: data.visit_id,
        follow_up_visit_id: data.follow_up_visit_id,
        follow_up_type: data.follow_up_type || '',
        content: data.content || '',
        result: data.result || '',
        remarks: data.remarks || '',
      });

      if (data.patient_id) {
        const evidence = await api.getEvidence(data.patient_id);
        setEvidenceData(evidence);
      }

      const logs = await api.getAuditLogs(id);
      setAuditLogs(logs);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  };

  const canEdit = detail && (
    (currentRole === 'triage_nurse' && detail.status === 'draft')
  );

  const canSubmit = detail && (
    (currentRole === 'triage_nurse' && detail.status === 'draft')
  );

  const canProcess = detail && (
    (currentRole === 'gp_doctor' && detail.status === 'pending_doctor') ||
    (currentRole === 'medical_director' && detail.status === 'pending_director')
  );

  const canReject = detail && (
    (currentRole === 'gp_doctor' && detail.status === 'pending_doctor') ||
    (currentRole === 'medical_director' && detail.status === 'pending_director')
  );

  const handleEdit = () => {
    setEditMode(true);
    setError(null);
  };

  const handleSaveEdit = async () => {
    if (!detail) return;
    setProcessing(true);
    setError(null);
    try {
      const updated = await api.updateRecord(detail.id, {
        version: detail.version,
        ...editForm,
      });
      setDetail(updated);
      setEditMode(false);
      onSuccess(updated);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = async () => {
    if (!detail) return;
    setProcessing(true);
    setError(null);
    try {
      const updated = await api.submitRecord(detail.id, detail.version);
      setDetail(updated);
      onSuccess(updated);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setProcessing(false);
    }
  };

  const handleProcess = async () => {
    if (!detail) return;
    setProcessing(true);
    setError(null);
    try {
      const updated = await api.processRecord(detail.id, {
        version: detail.version,
        opinion: opinion || undefined,
        result: currentRole === 'gp_doctor' ? editForm.result || undefined : undefined,
      });
      setDetail(updated);
      setOpinion('');
      onSuccess(updated);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!detail) return;
    if (!opinion.trim()) {
      setError({
        detail: '驳回时请填写驳回意见',
        error_code: 'OPINION_REQUIRED',
        field: 'opinion',
      });
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const updated = await api.rejectRecord(detail.id, detail.version, opinion);
      setDetail(updated);
      setOpinion('');
      onSuccess(updated);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setProcessing(false);
    }
  };

  const hasEvidence = detail?.appointment_id && detail?.visit_id && detail?.follow_up_visit_id;

  if (!record) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content detail-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>随访记录详情</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-alert">
              <div className="error-title">操作失败</div>
              <div className="error-code">错误代码: {error.error_code}</div>
              <div className="error-detail">{error.detail}</div>
              {error.field && <div className="error-field">字段: {error.field}</div>}
            </div>
          )}

          {loading ? (
            <div className="loading-state">加载中...</div>
          ) : detail ? (
            <div className="detail-content">
              <div className="detail-section">
                <h3>基本信息</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">记录编号</span>
                    <span className="value mono">{detail.record_no}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">状态</span>
                    <span
                      className="status-tag"
                      style={{
                        backgroundColor: STATUS_COLORS[detail.status] + '20',
                        color: STATUS_COLORS[detail.status],
                        border: `1px solid ${STATUS_COLORS[detail.status]}`,
                      }}
                    >
                      {STATUS_NAMES[detail.status]}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="label">版本号</span>
                    <span className="value">v{detail.version}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">创建人</span>
                    <span className="value">{detail.created_by}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">创建时间</span>
                    <span className="value">
                      {new Date(detail.created_at).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="label">更新人</span>
                    <span className="value">{detail.updated_by || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>
                  患者信息
                  <span className={`evidence-status ${hasEvidence ? 'complete' : 'incomplete'}`}>
                    {hasEvidence ? '✓ 证据齐全' : '⚠ 证据缺失'}
                  </span>
                  <span className="toggle-btn" onClick={() => setAuditLogsVisible(!auditLogsVisible)}>
                    {auditLogsVisible ? '隐藏' : '查看'}审计日志
                  </span>
                </h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">患者姓名</span>
                    <span className="value">{detail.patient?.name || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">身份证号</span>
                    <span className="value mono">{detail.patient?.id_card || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">联系电话</span>
                    <span className="value">{detail.patient?.phone || '-'}</span>
                  </div>
                </div>

                {editMode ? (
                  <div className="evidence-edit-section">
                    <div className="evidence-edit-col">
                      <label>预约登记 <span className="required">*</span></label>
                      <select
                        value={editForm.appointment_id || ''}
                        onChange={e => setEditForm(f => ({
                          ...f,
                          appointment_id: e.target.value ? Number(e.target.value) : null
                        }))}
                      >
                        <option value="">-- 请选择 --</option>
                        {evidenceData?.appointments.map(apt => (
                          <option key={apt.id} value={apt.id}>
                            #{apt.id} {new Date(apt.appointment_date).toLocaleDateString('zh-CN')} {apt.department}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="evidence-edit-col">
                      <label>就诊分诊 <span className="required">*</span></label>
                      <select
                        value={editForm.visit_id || ''}
                        onChange={e => setEditForm(f => ({
                          ...f,
                          visit_id: e.target.value ? Number(e.target.value) : null
                        }))}
                      >
                        <option value="">-- 请选择 --</option>
                        {evidenceData?.visits.map(v => (
                          <option key={v.id} value={v.id}>
                            #{v.id} {new Date(v.visit_date).toLocaleDateString('zh-CN')} {v.department}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="evidence-edit-col">
                      <label>随访回访 <span className="required">*</span></label>
                      <select
                        value={editForm.follow_up_visit_id || ''}
                        onChange={e => setEditForm(f => ({
                          ...f,
                          follow_up_visit_id: e.target.value ? Number(e.target.value) : null
                        }))}
                      >
                        <option value="">-- 请选择 --</option>
                        {evidenceData?.follow_up_visits.map(fuv => (
                          <option key={fuv.id} value={fuv.id}>
                            #{fuv.id} {new Date(fuv.follow_up_date).toLocaleDateString('zh-CN')} {fuv.follow_up_type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="evidence-links">
                    <span className="evidence-chip">
                      {detail.appointment_id ? '✓' : '✗'} 预约登记 #{detail.appointment_id || '无'}
                    </span>
                    <span className="evidence-chip">
                      {detail.visit_id ? '✓' : '✗'} 就诊分诊 #{detail.visit_id || '无'}
                    </span>
                    <span className="evidence-chip">
                      {detail.follow_up_visit_id ? '✓' : '✗'} 随访回访 #{detail.follow_up_visit_id || '无'}
                    </span>
                  </div>
                )}

                {auditLogsVisible && (
                  <div className="audit-logs-section">
                    <div className="audit-logs-title">操作日志</div>
                    <div className="audit-logs-list">
                      {auditLogs.length === 0 ? (
                        <div className="empty-small">暂无日志</div>
                      ) : (
                        auditLogs.map(log => (
                          <div key={log.id} className="audit-log-item">
                            <div className="log-time">
                              {new Date(log.created_at).toLocaleString('zh-CN')}
                            </div>
                            <div className="log-main">
                              <span className="log-action">{log.action}</span>
                              <span className="log-user">
                                {log.operator}（{ROLE_NAMES[log.operator_role as keyof typeof ROLE_NAMES] || log.operator_role}）
                              </span>
                            </div>
                            {log.from_status && log.to_status && (
                              <div className="log-status">
                                {STATUS_NAMES[log.from_status as keyof typeof STATUS_NAMES]} → {STATUS_NAMES[log.to_status as keyof typeof STATUS_NAMES]}
                              </div>
                            )}
                            {log.reason && (
                              <div className="log-reason">原因: {log.reason}</div>
                            )}
                            {log.field_name && (
                              <div className="log-field">字段变更: {log.field_name}</div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h3>随访内容</h3>
                <div className="form-fields">
                  <div className="form-item">
                    <label>随访类型</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editForm.follow_up_type}
                        onChange={e => setEditForm(f => ({ ...f, follow_up_type: e.target.value }))}
                        placeholder="请输入随访类型"
                      />
                    ) : (
                      <div className="field-value">{detail.follow_up_type || '-'}</div>
                    )}
                  </div>
                  <div className="form-item">
                    <label>随访内容</label>
                    {editMode ? (
                      <textarea
                        value={editForm.content}
                        onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                        placeholder="请输入随访内容"
                        rows={3}
                      />
                    ) : (
                      <div className="field-value">{detail.content || '-'}</div>
                    )}
                  </div>
                  <div className="form-item">
                    <label>处理结果</label>
                    {editMode || (currentRole === 'gp_doctor' && detail.status === 'pending_doctor') ? (
                      <textarea
                        value={editForm.result}
                        onChange={e => setEditForm(f => ({ ...f, result: e.target.value }))}
                        placeholder="请输入处理结果"
                        rows={3}
                        disabled={!editMode && currentRole !== 'gp_doctor'}
                      />
                    ) : (
                      <div className="field-value">{detail.result || '-'}</div>
                    )}
                  </div>
                  <div className="form-item">
                    <label>备注</label>
                    {editMode ? (
                      <textarea
                        value={editForm.remarks}
                        onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))}
                        placeholder="请输入备注"
                        rows={2}
                      />
                    ) : (
                      <div className="field-value">{detail.remarks || '-'}</div>
                    )}
                  </div>
                </div>
              </div>

              {detail.doctor_verified && (
                <div className="detail-section">
                  <h3>医生审核</h3>
                  <div className="audit-info">
                    <div className="audit-item">
                      <span className="label">审核状态</span>
                      <span className="value passed">✓ 已审核</span>
                    </div>
                    <div className="audit-item">
                      <span className="label">审核时间</span>
                      <span className="value">
                        {detail.doctor_verified_at ? new Date(detail.doctor_verified_at).toLocaleString('zh-CN') : '-'}
                      </span>
                    </div>
                    {detail.doctor_opinion && (
                      <div className="audit-item full">
                        <span className="label">医生意见</span>
                        <span className="value opinion">{detail.doctor_opinion}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {detail.director_verified && (
                <div className="detail-section">
                  <h3>主任确认</h3>
                  <div className="audit-info">
                    <div className="audit-item">
                      <span className="label">确认状态</span>
                      <span className="value passed">✓ 已确认</span>
                    </div>
                    <div className="audit-item">
                      <span className="label">确认时间</span>
                      <span className="value">
                        {detail.director_verified_at ? new Date(detail.director_verified_at).toLocaleString('zh-CN') : '-'}
                      </span>
                    </div>
                    {detail.director_opinion && (
                      <div className="audit-item full">
                        <span className="label">主任意见</span>
                        <span className="value opinion">{detail.director_opinion}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {canProcess && (
                <div className="detail-section process-section">
                  <h3>办理意见</h3>
                  <textarea
                    value={opinion}
                    onChange={e => setOpinion(e.target.value)}
                    placeholder="请输入办理意见（驳回时必填）"
                    rows={3}
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="modal-footer">
          <div className="footer-left">
            <span className="current-role-info">
              当前角色: {ROLE_NAMES[currentRole]}（{currentUsername}）
            </span>
          </div>
          <div className="footer-actions">
            <button className="btn btn-default" onClick={onClose}>关闭</button>
            {editMode && (
              <>
                <button className="btn btn-default" onClick={() => setEditMode(false)}>取消编辑</button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveEdit}
                  disabled={processing}
                >
                  {processing ? '保存中...' : '保存修改'}
                </button>
              </>
            )}
            {!editMode && canEdit && (
              <button className="btn btn-default" onClick={handleEdit}>编辑</button>
            )}
            {!editMode && canSubmit && (
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={processing}
              >
                {processing ? '提交中...' : '提交审核'}
              </button>
            )}
            {!editMode && canReject && (
              <button
                className="btn btn-danger"
                onClick={handleReject}
                disabled={processing}
              >
                {processing ? '处理中...' : '驳回'}
              </button>
            )}
            {!editMode && canProcess && (
              <button
                className="btn btn-success"
                onClick={handleProcess}
                disabled={processing}
              >
                {processing ? '处理中...' : '办理通过'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordDetailModal;
