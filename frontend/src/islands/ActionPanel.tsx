import { useState } from 'react';
import { parseEvidenceList } from '../lib/types';

interface Props {
  consultation: any;
  userRole: string;
  onAction: (action: string, data: any) => void;
}

interface ActionConfig {
  key: string;
  label: string;
  type: 'primary' | 'success' | 'warning' | 'danger' | 'default';
  requireFields: string[];
  description: string;
}

export default function ActionPanel({ consultation, userRole, onAction }: Props) {
  const [action, setAction] = useState<string | null>(null);
  const [opinion, setOpinion] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [appealReason, setAppealReason] = useState('');
  const [evidenceList, setEvidenceList] = useState<string[]>(
    parseEvidenceList(consultation.evidence_list)
  );
  const [newEvidence, setNewEvidence] = useState('');

  const availableEvidenceOptions = [
    '病历记录', '实验室检查', '影像学检查', '心电图',
    '超声检查', '病理报告', '手术记录', '会诊记录',
    '护理记录', '知情同意书', '体温单', '医嘱单',
  ];

  const getAvailableActions = (): ActionConfig[] => {
    const status = consultation.status;
    const actions: ActionConfig[] = [];

    if (userRole === 'registrar') {
      if (status === 'draft' || status === 'correction_requested') {
        actions.push({
          key: 'submit',
          label: status === 'correction_requested' ? '补正重提' : '提交申请',
          type: 'primary',
          requireFields: ['opinion'],
          description: '提交申请单进入审核流程',
        });
      }
      if (status === 'evidence_missing' || status === 'correction_requested') {
        actions.push({
          key: 'correct',
          label: '补正资料',
          type: 'warning',
          requireFields: ['opinion', 'evidence'],
          description: '补充证据材料后重新提交',
        });
      }
      if (
        status === 'evidence_missing' ||
        status === 'correction_requested' ||
        status === 'status_conflict' ||
        status === 'rejected'
      ) {
        actions.push({
          key: 'appeal_submit',
          label: '提交申诉',
          type: 'danger',
          requireFields: ['reason', 'opinion'],
          description: '对处理结果有异议，提交申诉',
        });
      }
    }

    if (userRole === 'reviewer') {
      if (status === 'submitted' || status === 'resubmitted') {
        actions.push({
          key: 'review_pass',
          label: '审核通过',
          type: 'success',
          requireFields: ['opinion'],
          description: '审核通过，进入医务部复核',
        });
        actions.push({
          key: 'review_reject',
          label: '退回补正',
          type: 'warning',
          requireFields: ['reject_reason'],
          description: '资料不全，退回登记员补正',
        });
        actions.push({
          key: 'evidence_missing',
          label: '证据不足',
          type: 'danger',
          requireFields: ['reject_reason'],
          description: '证据材料不充分，无法通过审核',
        });
      }
    }

    if (userRole === 'director') {
      if (status === 'review_passed' || status === 'under_final_review') {
        actions.push({
          key: 'final_start',
          label: '开始复核',
          type: 'primary',
          requireFields: ['opinion'],
          description: '开始医务部复核流程',
        });
        actions.push({
          key: 'archive',
          label: '复核归档',
          type: 'success',
          requireFields: ['opinion'],
          description: '复核通过，完成归档',
        });
        actions.push({
          key: 'final_conflict',
          label: '状态冲突',
          type: 'danger',
          requireFields: ['reject_reason'],
          description: '发现患者状态与申请信息不符',
        });
        actions.push({
          key: 'final_reject',
          label: '复核驳回',
          type: 'danger',
          requireFields: ['reject_reason'],
          description: '复核不通过，予以驳回',
        });
      }

      if (status === 'appeal_submitted') {
        actions.push({
          key: 'appeal_accept',
          label: '受理申诉',
          type: 'primary',
          requireFields: ['opinion'],
          description: '受理申诉，将重新核实',
        });
        actions.push({
          key: 'appeal_reject',
          label: '驳回申诉',
          type: 'danger',
          requireFields: ['opinion'],
          description: '申诉理由不充分，予以驳回',
        });
      }

      if (status === 'appeal_accepted') {
        actions.push({
          key: 'archive',
          label: '处理后归档',
          type: 'success',
          requireFields: ['opinion'],
          description: '申诉处理完成，归档保存',
        });
      }

      if (status === 'status_conflict' || status === 'evidence_missing' || status === 'correction_requested') {
        actions.push({
          key: 'archive',
          label: '直接归档',
          type: 'warning',
          requireFields: ['opinion'],
          description: '特殊情况，直接归档',
        });
      }
    }

    return actions;
  };

  const actions = getAvailableActions();

  const handleActionClick = (actionKey: string) => {
    setAction(actionKey);
  };

  const handleCancel = () => {
    setAction(null);
    setOpinion('');
    setRejectReason('');
    setAppealReason('');
  };

  const handleConfirm = () => {
    if (!action) return;

    const formData: any = {};

    if (action === 'appeal_submit') {
      formData.reason = appealReason;
      formData.opinion = opinion;
    } else if (action.includes('reject') || action === 'evidence_missing' || action === 'final_conflict') {
      formData.reject_reason = rejectReason;
      formData.opinion = opinion;
    } else if (action === 'correct') {
      formData.evidence_list = evidenceList;
      formData.opinion = opinion;
    } else {
      formData.opinion = opinion;
    }

    onAction(action, formData);
    handleCancel();
  };

  const addEvidence = () => {
    if (newEvidence.trim() && !evidenceList.includes(newEvidence.trim())) {
      setEvidenceList([...evidenceList, newEvidence.trim()]);
      setNewEvidence('');
    }
  };

  const removeEvidence = (item: string) => {
    setEvidenceList(evidenceList.filter((e) => e !== item));
  };

  const toggleEvidenceOption = (item: string) => {
    if (evidenceList.includes(item)) {
      removeEvidence(item);
    } else {
      setEvidenceList([...evidenceList, item]);
    }
  };

  const getActionButtonClass = (type: string) => {
    const base = 'btn btn-sm';
    switch (type) {
      case 'primary': return `${base} btn-primary`;
      case 'success': return `${base} btn-success`;
      case 'warning': return `${base} btn-warning`;
      case 'danger': return `${base} btn-danger`;
      default: return base;
    }
  };

  const currentActionConfig = actions.find(a => a.key === action);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">操作面板</div>
      </div>
      <div className="card-body">
        {actions.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px 0' }}>
            当前状态无可用操作
          </div>
        ) : !action ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {actions.map((act) => (
              <div key={act.key}>
                <button
                  className={getActionButtonClass(act.type)}
                  style={{ width: '100%', justifyContent: 'space-between', padding: '10px 14px' }}
                  onClick={() => handleActionClick(act.key)}
                >
                  <span>{act.label}</span>
                  <span>→</span>
                </button>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, paddingLeft: 4 }}>
                  {act.description}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 12, color: '#111827' }}>
              {currentActionConfig?.label}
            </div>

            {action === 'correct' && (
              <div className="form-group">
                <label className="form-label">证据材料</label>
                <div className="checkbox-group" style={{ marginBottom: 12 }}>
                  {availableEvidenceOptions.map((item) => (
                    <label key={item} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={evidenceList.includes(item)}
                        onChange={() => toggleEvidenceOption(item)}
                      />
                      {item}
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="自定义证据名称"
                    value={newEvidence}
                    onChange={(e) => setNewEvidence(e.target.value)}
                  />
                  <button type="button" className="btn btn-sm" onClick={addEvidence}>
                    添加
                  </button>
                </div>
                <div className="evidence-tags">
                  {evidenceList.map((item, idx) => (
                    <span key={idx} className="evidence-tag">
                      {item}
                      <span
                        style={{ cursor: 'pointer', marginLeft: 4, fontWeight: 'bold' }}
                        onClick={() => removeEvidence(item)}
                      >
                        ×
                      </span>
                    </span>
                  ))}
                </div>
                <div className="form-hint">
                  必填证据：病历记录、实验室检查
                </div>
              </div>
            )}

            {action === 'appeal_submit' && (
              <div className="form-group">
                <label className="form-label">
                  申诉理由 <span className="required">*</span>
                </label>
                <textarea
                  className="form-textarea"
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  placeholder="请详细说明申诉理由..."
                  rows={4}
                />
              </div>
            )}

            {(action.includes('reject') || action === 'evidence_missing' || action === 'final_conflict') && (
              <div className="form-group">
                <label className="form-label">
                  驳回/原因 <span className="required">*</span>
                </label>
                <textarea
                  className="form-textarea"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="请详细说明原因..."
                  rows={4}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                {action === 'appeal_submit' ? '补充说明' : '处理意见'}
              </label>
              <textarea
                className="form-textarea"
                value={opinion}
                onChange={(e) => setOpinion(e.target.value)}
                placeholder="请输入您的意见..."
                rows={3}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={handleCancel}>
                取消
              </button>
              <button
                className={`btn btn-sm ${currentActionConfig ? getActionButtonClass(currentActionConfig.type).replace('btn-sm ', '') : 'btn-primary'}`}
                onClick={handleConfirm}
              >
                确认
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
