import { h } from 'preact';
import { useState } from 'preact/hooks';
import { submitAction, updateEvidence } from '../api/client';

const EVIDENCE_OPTIONS = [
  '订单截图',
  '退款申请',
  '支付凭证',
  '退货物流单',
  '仓库签收单',
  '身份验证',
  '大额审批单',
];

function parseJSON(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch (e) { return []; }
  }
  return [];
}

export default function ActionPanel({ order, currentUser, onAction }) {
  const [opinion, setOpinion] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!currentUser || !order) return null;

  const role = currentUser.role;
  const status = order.status;

  const canInitiate = role === 'clerk' && status === 'draft';
  const canCorrect = role === 'clerk' && status === 'returned';
  const canProcess = role === 'supervisor' && status === 'pending_process';
  const canReview = role === 'reviewer' && status === 'pending_review';

  if (!canInitiate && !canCorrect && !canProcess && !canReview) {
    return <div style="color:#999;font-size:13px;">当前角色无可用操作</div>;
  }

  const toggleEvidence = (ev) => {
    setSelectedEvidence((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  };

  const handleSubmit = async (action) => {
    if (!opinion.trim()) {
      setError('请填写处理意见');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      if (canCorrect && selectedEvidence.length > 0) {
        const existing = parseJSON(order.evidence_provided);
        const merged = [...new Set([...existing, ...selectedEvidence])];
        await updateEvidence(order.id, {
          evidence: merged,
          handler_id: currentUser.id,
        });
      }
      await submitAction(order.id, {
        action,
        opinion: opinion.trim(),
        handler_id: currentUser.id,
        version: order.version,
      });
      setOpinion('');
      setSelectedEvidence([]);
      onAction();
    } catch (e) {
      setError(e.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="action-panel">
      <div class="form-group">
        <label>处理意见</label>
        <textarea
          value={opinion}
          onInput={(e) => setOpinion(e.target.value)}
          placeholder="请输入处理意见..."
        />
      </div>

      {canCorrect && (
        <div class="form-group">
          <label>补充证据</label>
          <div class="checkbox-group">
            {EVIDENCE_OPTIONS.map((ev) => (
              <label key={ev}>
                <input
                  type="checkbox"
                  checked={selectedEvidence.includes(ev)}
                  onChange={() => toggleEvidence(ev)}
                />
                {ev}
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <div style="color:#ff4d4f;font-size:12px;margin-bottom:12px;">{error}</div>}

      <div class="action-buttons">
        {canInitiate && (
          <button
            class="btn-primary"
            disabled={submitting}
            onClick={() => handleSubmit('initiate')}
          >
            发起处理
          </button>
        )}
        {canCorrect && (
          <button
            class="btn-primary"
            disabled={submitting}
            onClick={() => handleSubmit('correct')}
          >
            补正提交
          </button>
        )}
        {canProcess && (
          <>
            <button
              class="btn-success"
              disabled={submitting}
              onClick={() => handleSubmit('process')}
            >
              办理通过
            </button>
            <button
              class="btn-danger"
              disabled={submitting}
              onClick={() => handleSubmit('return')}
            >
              退回补正
            </button>
          </>
        )}
        {canReview && (
          <>
            <button
              class="btn-success"
              disabled={submitting}
              onClick={() => handleSubmit('review_archive')}
            >
              复核归档
            </button>
            <button
              class="btn-danger"
              disabled={submitting}
              onClick={() => handleSubmit('return')}
            >
              退回补正
            </button>
          </>
        )}
      </div>
    </div>
  );
}
