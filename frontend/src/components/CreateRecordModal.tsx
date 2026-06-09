import React, { useState, useEffect } from 'react';
import { Patient, Appointment, Visit, FollowUpVisit, ApiError } from '../types';
import { api } from '../api';
import './CreateRecordModal.css';

interface CreateRecordModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateRecordModal: React.FC<CreateRecordModalProps> = ({ visible, onClose, onSuccess }) => {
  const [step, setStep] = useState<'patient' | 'evidence' | 'content'>('patient');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchName, setSearchName] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const [evidence, setEvidence] = useState<{
    appointments: Appointment[];
    visits: Visit[];
    follow_up_visits: FollowUpVisit[];
  } | null>(null);

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);
  const [selectedFollowUpId, setSelectedFollowUpId] = useState<number | null>(null);

  const [followUpType, setFollowUpType] = useState('');
  const [content, setContent] = useState('');
  const [result, setResult] = useState('');
  const [remarks, setRemarks] = useState('');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (visible) {
      loadPatients();
      resetForm();
    }
  }, [visible]);

  const resetForm = () => {
    setStep('patient');
    setSelectedPatient(null);
    setEvidence(null);
    setSelectedAppointmentId(null);
    setSelectedVisitId(null);
    setSelectedFollowUpId(null);
    setFollowUpType('');
    setContent('');
    setResult('');
    setRemarks('');
    setError(null);
  };

  const loadPatients = async () => {
    setLoading(true);
    try {
      const data = await api.getPatients(searchName);
      setPatients(data);
    } catch (err) {
      console.error('加载患者失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEvidence = async (patientId: number) => {
    setLoading(true);
    try {
      const data = await api.getEvidence(patientId);
      setEvidence(data);
    } catch (err) {
      console.error('加载证据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setSelectedAppointmentId(null);
    setSelectedVisitId(null);
    setSelectedFollowUpId(null);
    loadEvidence(patient.id);
    setError(null);
  };

  const handleNextStep = () => {
    if (step === 'patient') {
      if (!selectedPatient) {
        setError({
          detail: '请选择患者',
          error_code: 'PATIENT_REQUIRED',
          field: 'patient',
        });
        return;
      }
      setStep('evidence');
      setError(null);
    } else if (step === 'evidence') {
      if (!selectedAppointmentId || !selectedVisitId || !selectedFollowUpId) {
        setError({
          detail: '请关联完整的三类证据：预约登记、就诊分诊、随访回访',
          error_code: 'INCOMPLETE_EVIDENCE',
          field: 'evidence',
        });
        return;
      }
      if (!followUpType.trim()) {
        setError({
          detail: '请填写随访类型',
          error_code: 'FOLLOW_UP_TYPE_REQUIRED',
          field: 'follow_up_type',
        });
        return;
      }
      setStep('content');
      setError(null);
    }
  };

  const handlePrevStep = () => {
    if (step === 'evidence') {
      setStep('patient');
    } else if (step === 'content') {
      setStep('evidence');
    }
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedPatient) return;

    setSubmitting(true);
    setError(null);

    try {
      await api.createRecord({
        patient_id: selectedPatient.id,
        appointment_id: selectedAppointmentId || undefined,
        visit_id: selectedVisitId || undefined,
        follow_up_visit_id: selectedFollowUpId || undefined,
        follow_up_type: followUpType,
        content: content,
        result: result,
        remarks: remarks,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearchPatient = () => {
    loadPatients();
  };

  if (!visible) return null;

  const evidenceComplete = selectedAppointmentId && selectedVisitId && selectedFollowUpId;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content create-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>新建随访补录</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="create-steps">
          <div className={`step ${step === 'patient' ? 'active' : ''} ${selectedPatient ? 'done' : ''}`}>
            <span className="step-num">1</span>
            <span className="step-text">选择患者</span>
          </div>
          <div className="step-line"></div>
          <div className={`step ${step === 'evidence' ? 'active' : ''} ${evidenceComplete ? 'done' : ''}`}>
            <span className="step-num">2</span>
            <span className="step-text">关联证据</span>
          </div>
          <div className="step-line"></div>
          <div className={`step ${step === 'content' ? 'active' : ''}`}>
            <span className="step-num">3</span>
            <span className="step-text">填写内容</span>
          </div>
        </div>

        <div className="modal-body create-body">
          {error && (
            <div className="error-alert">
              <div className="error-title">操作失败</div>
              <div className="error-code">错误代码: {error.error_code}</div>
              <div className="error-detail">{error.detail}</div>
              {error.field && <div className="error-field">字段: {error.field}</div>}
            </div>
          )}

          {step === 'patient' && (
            <div className="step-content">
              <div className="patient-search">
                <input
                  type="text"
                  placeholder="输入患者姓名搜索"
                  value={searchName}
                  onChange={e => setSearchName(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSearchPatient()}
                />
                <button className="btn btn-primary" onClick={handleSearchPatient}>搜索</button>
              </div>

              <div className="patient-list">
                {loading ? (
                  <div className="loading">加载中...</div>
                ) : patients.length === 0 ? (
                  <div className="empty">暂无患者数据</div>
                ) : (
                  patients.map(patient => (
                    <div
                      key={patient.id}
                      className={`patient-item ${selectedPatient?.id === patient.id ? 'selected' : ''}`}
                      onClick={() => handleSelectPatient(patient)}
                    >
                      <div className="patient-info">
                        <div className="patient-name">{patient.name}</div>
                        <div className="patient-id">{patient.id_card}</div>
                      </div>
                      {selectedPatient?.id === patient.id && (
                        <span className="check-mark">✓</span>
                      )}
                    </div>
                  ))
                )}
              </div>

              {selectedPatient && (
                <div className="selected-patient-card">
                  <div className="card-title">已选择患者</div>
                  <div className="card-content">
                    <span>姓名: {selectedPatient.name}</span>
                    <span>身份证: {selectedPatient.id_card}</span>
                    <span>电话: {selectedPatient.phone || '-'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'evidence' && (
            <div className="step-content">
              <div className="evidence-select">
                <div className="evidence-section">
                  <div className="section-header">
                    <span className={`evidence-badge ${selectedAppointmentId ? 'complete' : 'incomplete'}`}>
                      {selectedAppointmentId ? '✓' : '✗'}
                    </span>
                    <span className="section-title">预约登记</span>
                    <span className="section-hint">（必选）</span>
                  </div>
                  <div className="evidence-options">
                    {evidence?.appointments && evidence.appointments.length > 0 ? (
                      evidence.appointments.map(apt => (
                        <div
                          key={apt.id}
                          className={`evidence-option ${selectedAppointmentId === apt.id ? 'selected' : ''}`}
                          onClick={() => setSelectedAppointmentId(apt.id)}
                        >
                          <div className="option-date">
                            {new Date(apt.appointment_date).toLocaleDateString('zh-CN')}
                          </div>
                          <div className="option-detail">{apt.department} - {apt.doctor_name}</div>
                          {selectedAppointmentId === apt.id && (
                            <span className="check-mark">✓</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="empty-small">该患者暂无预约登记记录</div>
                    )}
                  </div>
                </div>

                <div className="evidence-section">
                  <div className="section-header">
                    <span className={`evidence-badge ${selectedVisitId ? 'complete' : 'incomplete'}`}>
                      {selectedVisitId ? '✓' : '✗'}
                    </span>
                    <span className="section-title">就诊分诊</span>
                    <span className="section-hint">（必选）</span>
                  </div>
                  <div className="evidence-options">
                    {evidence?.visits && evidence.visits.length > 0 ? (
                      evidence.visits.map(visit => (
                        <div
                          key={visit.id}
                          className={`evidence-option ${selectedVisitId === visit.id ? 'selected' : ''}`}
                          onClick={() => setSelectedVisitId(visit.id)}
                        >
                          <div className="option-date">
                            {new Date(visit.visit_date).toLocaleDateString('zh-CN')}
                          </div>
                          <div className="option-detail">{visit.department} - {visit.triage_nurse}</div>
                          <div className="option-diagnosis">{visit.diagnosis}</div>
                          {selectedVisitId === visit.id && (
                            <span className="check-mark">✓</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="empty-small">该患者暂无就诊分诊记录</div>
                    )}
                  </div>
                </div>

                <div className="evidence-section">
                  <div className="section-header">
                    <span className={`evidence-badge ${selectedFollowUpId ? 'complete' : 'incomplete'}`}>
                      {selectedFollowUpId ? '✓' : '✗'}
                    </span>
                    <span className="section-title">随访回访</span>
                    <span className="section-hint">（必选）</span>
                  </div>
                  <div className="evidence-options">
                    {evidence?.follow_up_visits && evidence.follow_up_visits.length > 0 ? (
                      evidence.follow_up_visits.map(fuv => (
                        <div
                          key={fuv.id}
                          className={`evidence-option ${selectedFollowUpId === fuv.id ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedFollowUpId(fuv.id);
                            if (!followUpType && fuv.follow_up_type) {
                              setFollowUpType(fuv.follow_up_type);
                            }
                          }}
                        >
                          <div className="option-date">
                            {new Date(fuv.follow_up_date).toLocaleDateString('zh-CN')}
                          </div>
                          <div className="option-detail">
                            {fuv.follow_up_type} - {fuv.operator}
                          </div>
                          <div className="option-diagnosis">{fuv.content}</div>
                          {selectedFollowUpId === fuv.id && (
                            <span className="check-mark">✓</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="empty-small">该患者暂无随访回访记录</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-item mt-16">
                <label>随访类型 <span className="required">*</span></label>
                <input
                  type="text"
                  value={followUpType}
                  onChange={e => setFollowUpType(e.target.value)}
                  placeholder="例如：高血压随访、糖尿病随访等"
                />
              </div>
            </div>
          )}

          {step === 'content' && (
            <div className="step-content">
              <div className="form-item">
                <label>随访内容</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="请输入随访内容"
                  rows={3}
                />
              </div>

              <div className="form-item">
                <label>处理结果</label>
                <textarea
                  value={result}
                  onChange={e => setResult(e.target.value)}
                  placeholder="请输入处理结果（可选）"
                  rows={3}
                />
              </div>

              <div className="form-item">
                <label>备注</label>
                <textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="请输入备注（可选）"
                  rows={2}
                />
              </div>

              <div className="summary-card">
                <div className="summary-title">创建信息摘要</div>
                <div className="summary-item">
                  <span className="label">患者</span>
                  <span className="value">{selectedPatient?.name}</span>
                </div>
                <div className="summary-item">
                  <span className="label">随访类型</span>
                  <span className="value">{followUpType}</span>
                </div>
                <div className="summary-item">
                  <span className="label">关联证据</span>
                  <span className="value complete">预约登记 ✓ 就诊分诊 ✓ 随访回访 ✓</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="footer-left">
            <span className="step-indicator">第 {step === 'patient' ? 1 : step === 'evidence' ? 2 : 3} 步 / 共 3 步</span>
          </div>
          <div className="footer-actions">
            <button className="btn btn-default" onClick={onClose}>取消</button>
            {step !== 'patient' && (
              <button className="btn btn-default" onClick={handlePrevStep}>上一步</button>
            )}
            {step !== 'content' ? (
              <button className="btn btn-primary" onClick={handleNextStep} disabled={loading}>
                下一步
              </button>
            ) : (
              <button className="btn btn-success" onClick={handleSubmit} disabled={submitting}>
                {submitting ? '创建中...' : '创建随访记录'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateRecordModal;
