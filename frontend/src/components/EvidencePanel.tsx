import React, { useState, useEffect } from 'react';
import { EvidenceResponse, FollowUpRecord } from '../types';
import { api } from '../api';
import './EvidencePanel.css';

interface EvidencePanelProps {
  record: FollowUpRecord | null;
}

const EvidencePanel: React.FC<EvidencePanelProps> = ({ record }) => {
  const [evidence, setEvidence] = useState<EvidenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'appointment' | 'visit' | 'followup'>('appointment');

  useEffect(() => {
    if (record?.patient_id) {
      loadEvidence(record.patient_id);
    } else {
      setEvidence(null);
    }
  }, [record?.patient_id]);

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

  if (!record) {
    return (
      <div className="evidence-panel empty">
        <div className="empty-hint">
          <div className="empty-icon">📋</div>
          <p>选择左侧随访记录查看关联证据</p>
        </div>
      </div>
    );
  }

  const hasAppointment = !!record.appointment_id && evidence?.appointments.length;
  const hasVisit = !!record.visit_id && evidence?.visits.length;
  const hasFollowUp = !!record.follow_up_visit_id && evidence?.follow_up_visits.length;

  const selectedAppointment = evidence?.appointments.find(a => a.id === record.appointment_id);
  const selectedVisit = evidence?.visits.find(v => v.id === record.visit_id);
  const selectedFollowUp = evidence?.follow_up_visits.find(f => f.id === record.follow_up_visit_id);

  return (
    <div className="evidence-panel">
      <div className="panel-header">
        <h3>关联证据</h3>
        <div className="evidence-summary">
          <span className={`evidence-dot ${hasAppointment ? 'has' : 'miss'}`}></span>
          <span>预约登记</span>
          <span className={`evidence-dot ${hasVisit ? 'has' : 'miss'}`}></span>
          <span>就诊分诊</span>
          <span className={`evidence-dot ${hasFollowUp ? 'has' : 'miss'}`}></span>
          <span>随访回访</span>
        </div>
      </div>

      <div className="evidence-tabs">
        <button
          className={`tab-btn ${activeTab === 'appointment' ? 'active' : ''}`}
          onClick={() => setActiveTab('appointment')}
        >
          预约登记
          {!hasAppointment && <span className="miss-tag">缺失</span>}
        </button>
        <button
          className={`tab-btn ${activeTab === 'visit' ? 'active' : ''}`}
          onClick={() => setActiveTab('visit')}
        >
          就诊分诊
          {!hasVisit && <span className="miss-tag">缺失</span>}
        </button>
        <button
          className={`tab-btn ${activeTab === 'followup' ? 'active' : ''}`}
          onClick={() => setActiveTab('followup')}
        >
          随访回访
          {!hasFollowUp && <span className="miss-tag">缺失</span>}
        </button>
      </div>

      <div className="evidence-content">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : (
          <>
            {activeTab === 'appointment' && (
              <div className="evidence-detail">
                {selectedAppointment ? (
                  <div className="detail-card linked">
                    <div className="card-badge">已关联</div>
                    <div className="detail-item">
                      <span className="label">预约日期</span>
                      <span className="value">
                        {new Date(selectedAppointment.appointment_date).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="label">科室</span>
                      <span className="value">{selectedAppointment.department || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">医生</span>
                      <span className="value">{selectedAppointment.doctor_name || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">状态</span>
                      <span className="value">{selectedAppointment.status}</span>
                    </div>
                  </div>
                ) : (
                  <div className="detail-card missing">
                    <div className="card-badge miss">未关联</div>
                    <p className="miss-text">尚未关联预约登记记录</p>
                    {evidence?.appointments && evidence.appointments.length > 0 && (
                      <div className="alternative-list">
                        <p className="alt-title">可关联的预约记录（{evidence.appointments.length}条）：</p>
                        {evidence.appointments.map(apt => (
                          <div key={apt.id} className="alt-item">
                            <span>ID: {apt.id}</span>
                            <span>{new Date(apt.appointment_date).toLocaleDateString('zh-CN')}</span>
                            <span>{apt.department}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'visit' && (
              <div className="evidence-detail">
                {selectedVisit ? (
                  <div className="detail-card linked">
                    <div className="card-badge">已关联</div>
                    <div className="detail-item">
                      <span className="label">就诊日期</span>
                      <span className="value">
                        {new Date(selectedVisit.visit_date).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="label">分诊护士</span>
                      <span className="value">{selectedVisit.triage_nurse || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">科室</span>
                      <span className="value">{selectedVisit.department || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">诊断</span>
                      <span className="value">{selectedVisit.diagnosis || '-'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="detail-card missing">
                    <div className="card-badge miss">未关联</div>
                    <p className="miss-text">尚未关联就诊分诊记录</p>
                    {evidence?.visits && evidence.visits.length > 0 && (
                      <div className="alternative-list">
                        <p className="alt-title">可关联的就诊记录（{evidence.visits.length}条）：</p>
                        {evidence.visits.map(visit => (
                          <div key={visit.id} className="alt-item">
                            <span>ID: {visit.id}</span>
                            <span>{new Date(visit.visit_date).toLocaleDateString('zh-CN')}</span>
                            <span>{visit.department}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'followup' && (
              <div className="evidence-detail">
                {selectedFollowUp ? (
                  <div className="detail-card linked">
                    <div className="card-badge">已关联</div>
                    <div className="detail-item">
                      <span className="label">随访日期</span>
                      <span className="value">
                        {new Date(selectedFollowUp.follow_up_date).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="label">随访类型</span>
                      <span className="value">{selectedFollowUp.follow_up_type || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">操作人</span>
                      <span className="value">{selectedFollowUp.operator || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">随访内容</span>
                      <span className="value">{selectedFollowUp.content || '-'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="detail-card missing">
                    <div className="card-badge miss">未关联</div>
                    <p className="miss-text">尚未关联随访回访记录</p>
                    {evidence?.follow_up_visits && evidence.follow_up_visits.length > 0 && (
                      <div className="alternative-list">
                        <p className="alt-title">可关联的随访记录（{evidence.follow_up_visits.length}条）：</p>
                        {evidence.follow_up_visits.map(fuv => (
                          <div key={fuv.id} className="alt-item">
                            <span>ID: {fuv.id}</span>
                            <span>{new Date(fuv.follow_up_date).toLocaleDateString('zh-CN')}</span>
                            <span>{fuv.follow_up_type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EvidencePanel;
