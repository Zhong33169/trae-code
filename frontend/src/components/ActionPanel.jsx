import { h } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { submitAction, updateEvidence } from '../api/client';

const ALL_EVIDENCE = [
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

function triggerGlobalRefresh() {
  try {
    window.dispatchEvent(new CustomEvent('aftersales:refresh'));
  } catch (e) {}
}

export default function ActionPanel({ order, currentUser, onAction }) {
  const [opinion, setOpinion] = useState('');
  const [checkedEvidence, setCheckedEvidence] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requiredEvidence = useMemo(
    () => parseJSON(order?.required_evidence),
    [order?.required_evidence]
  );
  const providedEvidence = useMemo(
    () => parseJSON(order?.evidence_provided),
    [order?.evidence_provided]
  );

  useEffect(() => {
    setCheckedEvidence(providedEvidence);
  }, [order?.id, order?.evidence_provided]);

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

  const showEvidencePanel = canInitiate || canCorrect;

  const evidenceOptions = requiredEvidence.length > 0
    ? [...new Set([...requiredEvidence, ...ALL_EVIDENCE])]
    : ALL_EVIDENCE;

  const toggleEvidence = (ev) => {
    setCheckedEvidence((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  };

  const finalizeWithData = (data) => {
    triggerGlobalRefresh();
    if (onAction) onAction(data);
  };

  const extractErrorData = (e) => {
    if (e && e.details && e.details.order) {
      return {
        order: e.details.order,
        record: e.details.record,
        missing: e.details.missing,
      };
    }
    return null;
  };

  const handleSubmit = async (action) => {
    if (!opinion.trim()) {
      setError('请填写处理意见');
      return;
    }
    setError('');
    setSubmitting(true);

    let lastData = null;

    try {
      if (showEvidencePanel) {
        const finalEvidence = checkedEvidence.length > 0 ? checkedEvidence : providedEvidence;
        const evidenceChanged = finalEvidence.length !== providedEvidence.length ||
          finalEvidence.some((e, i) => e !== providedEvidence[i]);
        const hasEvidence = finalEvidence.length > 0;
        if (evidenceChanged || hasEvidence) {
          const eviData = await updateEvidence(order.id, {
            evidence: finalEvidence,
            handler_id: currentUser.id,
            version: order.version,
          });
          lastData = eviData;
        }
      }
      const actionData = await submitAction(order.id, {
        action,
        opinion: opinion.trim(),
        handler_id: currentUser.id,
        version: order.version,
      });
      lastData = actionData;
      setOpinion('');
    } catch (e) {
      const msg = e.message || '操作失败';
      if (e.details && e.details.missing && e.details.missing.length) {
        setError(`${msg}（缺失：${e.details.missing.join('、')}）`);
      } else {
        setError(msg);
      }
      const errData = extractErrorData(e);
      if (errData) lastData = errData;
    } finally {
      setSubmitting(false);
      finalizeWithData(lastData);
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

      {showEvidencePanel && (
        <div class="form-group">
          <label>
            必填证据
            <span style="color:#999;font-weight:normal;font-size:12px;margin-left:6px;">
              （打勾表示已提供；未打勾的必填项会触发校验失败）
            </span>
          </label>
          <div class="checkbox-group">
            {evidenceOptions.map((ev) => {
              const isRequired = requiredEvidence.includes(ev);
              return (
                <label key={ev} style={isRequired ? { fontWeight: 600 } : {}}>
                  <input
                    type="checkbox"
                    checked={checkedEvidence.includes(ev)}
                    onChange={() => toggleEvidence(ev)}
                  />
                  {ev}
                  {isRequired && <span style="color:#ff4d4f;margin-left:2px;">*</span>}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div style="color:#ff4d4f;font-size:12px;margin-bottom:12px;">{error}</div>
      )}

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
