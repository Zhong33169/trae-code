import React, { useState, useEffect } from 'react';
import {
  FollowUpRecord, STATUS_NAMES, STATUS_COLORS,
  ROLE_NAMES, ApiError,
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
    follow_up_type: '',
    content: '',
    result: '',
    remarks: '',
  });

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
        follow_up_type: data.follow_up_type || '',
        content: data.content || '',
        result: data.result || '',
        remarks: data.remarks || '',
      });
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
      onSuccess();
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
      onSuccess();
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
      onSuccess();
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
