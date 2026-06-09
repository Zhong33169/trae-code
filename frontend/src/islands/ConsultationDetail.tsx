import { useState, useEffect } from 'react';
import {
  getConsultation,
  getConsultationHistory,
  submitConsultation,
  reviewConsultation,
  correctConsultation,
  finalReviewConsultation,
  archiveConsultation,
  submitAppeal,
  acceptAppeal,
  rejectAppeal,
  getCurrentUserRole,
} from '../lib/api';
import { formatDate, parseEvidenceList } from '../lib/types';
import HistoryTimeline from './HistoryTimeline.tsx';
import ActionPanel from './ActionPanel.tsx';

interface Props {
  consultationId: string;
}

export default function ConsultationDetail({ consultationId }: Props) {
  const id = consultationId;
  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [userRole, setUserRole] = useState('');

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [detailRes, historyRes] = await Promise.all([
        getConsultation(id),
        getConsultationHistory(id),
      ]);
      setData(detailRes);
      setHistory(historyRes.data || []);
      setUserRole(getCurrentUserRole());
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUserChange = () => {
      setUserRole(getCurrentUserRole());
      loadData();
    };
    window.addEventListener('userChanged', handleUserChange);
    return () => window.removeEventListener('userChanged', handleUserChange);
  }, [id]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleAction = async (action: string, formData: any) => {
    if (!id || !data) return;
    try {
      let result: any;
      switch (action) {
        case 'submit':
          result = await submitConsultation(id, {
            version: data.version,
            opinion: formData.opinion,
            evidence_list: formData.evidence_list || parseEvidenceList(data.evidence_list),
          });
          break;
        case 'review_pass':
          result = await reviewConsultation(id, {
            version: data.version,
            action: 'pass',
            opinion: formData.opinion,
          });
          break;
        case 'review_reject':
          result = await reviewConsultation(id, {
            version: data.version,
            action: 'reject',
            opinion: formData.opinion,
            reject_reason: formData.reject_reason,
          });
          break;
        case 'evidence_missing':
          result = await reviewConsultation(id, {
            version: data.version,
            action: 'evidence_missing',
            opinion: formData.opinion,
            reject_reason: formData.reject_reason,
          });
          break;
        case 'correct':
          result = await correctConsultation(id, {
            version: data.version,
            evidence_list: formData.evidence_list,
            opinion: formData.opinion,
          });
          break;
        case 'final_start':
          result = await finalReviewConsultation(id, {
            version: data.version,
            action: 'start',
            opinion: formData.opinion,
          });
          break;
        case 'final_conflict':
          result = await finalReviewConsultation(id, {
            version: data.version,
            action: 'conflict',
            opinion: formData.opinion,
            reject_reason: formData.reject_reason,
          });
          break;
        case 'final_reject':
          result = await finalReviewConsultation(id, {
            version: data.version,
            action: 'reject',
            opinion: formData.opinion,
            reject_reason: formData.reject_reason,
          });
          break;
        case 'archive':
          result = await archiveConsultation(id, {
            version: data.version,
            opinion: formData.opinion,
          });
          break;
        case 'appeal_submit':
          result = await submitAppeal(id, {
            version: data.version,
            reason: formData.reason,
            opinion: formData.opinion,
          });
          break;
        case 'appeal_accept':
          result = await acceptAppeal(id, {
            version: data.version,
            opinion: formData.opinion,
          });
          break;
        case 'appeal_reject':
          result = await rejectAppeal(id, {
            version: data.version,
            opinion: formData.opinion,
          });
          break;
      }
      showSuccess(result.message || '操作成功');
      loadData();
    } catch (err: any) {
      setError(err.message || '操作失败');
      setTimeout(() => setError(''), 5000);
    }
  };

  const goBack = () => {
    window.history.back();
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>;
  }

  if (error && !data) {
    return (
      <div style={{ padding: 40 }}>
        <div className="alert alert-error">{error}</div>
        <button className="btn" onClick={goBack}>返回</button>
      </div>
    );
  }

  if (!data) return null;

  const evidenceItems = parseEvidenceList(data.evidence_list);

  return (
    <div>
      <div className="breadcrumb">
        <a href="/consultations">申请单列表</a>
        <span>/</span>
        <span>申请单详情</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div className="card-title">基本信息</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`status-tag status-${data.status}`}>
                  {data.status_name}
                </span>
                {data.is_overdue && (
                  <span className="status-tag status-overdue">逾期</span>
                )}
                <span style={{ fontSize: 12, color: '#9ca3af' }}>
                  版本: v{data.version}
                </span>
              </div>
            </div>
            <div className="card-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">申请单编号</div>
                  <div className="detail-value" style={{ fontFamily: 'monospace' }}>{data.id}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">申请标题</div>
                  <div className="detail-value">{data.title}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">患者姓名</div>
                  <div className="detail-value">{data.patient_name}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">患者ID</div>
                  <div className="detail-value">{data.patient_id}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">申请科室</div>
                  <div className="detail-value">{data.dept}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">会诊类型</div>
                  <div className="detail-value">{data.consult_type}</div>
                </div>
                <div className="detail-item full">
                  <div className="detail-label">会诊科室</div>
                  <div className="detail-value">{data.consult_dept}</div>
                </div>
                <div className="detail-item full">
                  <div className="detail-label">主诉/病情摘要</div>
                  <div className="detail-value" style={{ fontWeight: 'normal', lineHeight: 1.7 }}>
                    {data.chief_complaint || '-'}
                  </div>
                </div>
              </div>

              <div className="divider"></div>

              <div className="detail-section-title" style={{ fontSize: 14, marginBottom: 12 }}>
                证据材料
              </div>
              <div className="evidence-tags">
                {evidenceItems.length === 0 ? (
                  <span style={{ color: '#9ca3af', fontSize: 13 }}>暂无证据材料</span>
                ) : (
                  evidenceItems.map((item, idx) => (
                    <span key={idx} className="evidence-tag">
                      📄 {item}
                    </span>
                  ))
                )}
              </div>

              <div className="divider"></div>

              <div className="info-grid">
                <div className="info-box">
                  <div className="info-label">申请期限</div>
                  <div className="info-value">{formatDate(data.deadline)}</div>
                </div>
                <div className="info-box">
                  <div className="info-label">创建时间</div>
                  <div className="info-value">{formatDate(data.created_at)}</div>
                </div>
                <div className="info-box">
                  <div className="info-label">更新时间</div>
                  <div className="info-value">{formatDate(data.updated_at)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">处理历史记录</div>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>共 {history.length} 条记录</span>
            </div>
            <div className="card-body">
              <HistoryTimeline records={history} />
            </div>
          </div>
        </div>

        <div>
          <ActionPanel
            consultation={data}
            userRole={userRole}
            onAction={handleAction}
          />

          {data.has_appeal && (
            <div className="card" style={{ marginTop: 20 }}>
              <div className="card-header">
                <div className="card-title">申诉信息</div>
                <span className={`status-tag status-${data.appeal_status}`}>
                  {data.appeal_status_name}
                </span>
              </div>
              <div className="card-body">
                <div className="detail-item" style={{ marginBottom: 12 }}>
                  <div className="detail-label">申诉理由</div>
                  <div className="detail-value" style={{ fontWeight: 'normal', fontSize: 13, lineHeight: 1.7 }}>
                    {data.appeal_reason || '-'}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <div className="card-title">处理人员</div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table>
                <tbody>
                  <tr>
                    <td style={{ color: '#6b7280', width: 80 }}>登记员</td>
                    <td>{data.registrar_name || '-'}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#6b7280' }}>审核主管</td>
                    <td>{data.reviewer_name || '-'}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#6b7280' }}>复核负责人</td>
                    <td>{data.director_name || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
