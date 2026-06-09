import { createSignal } from 'solid-js';
import { useUser } from '../contexts/UserContext';
import { api } from '../services/api';
import './Modal.css';

interface BatchItem {
  id: string;
  version: number;
}

interface Props {
  action: string;
  items: BatchItem[];
  onClose: () => void;
  onSuccess: () => void;
}

const BatchOperationModal = (props: Props) => {
  const { currentUser } = useUser();
  const [remark, setRemark] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const getTitle = () => {
    switch (props.action) {
      case 'submit': return '批量提交核验';
      case 'verify_pass': return '批量核验通过';
      case 'verify_reject': return '批量核验退回';
      case 'review_pass': return '批量复核通过';
      case 'review_reject': return '批量复核退回';
      default: return '批量操作';
    }
  };

  const needRemark = () => {
    return props.action.includes('reject');
  };

  const handleSubmit = async () => {
    if (needRemark() && !remark().trim()) {
      setError('请填写退回原因');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let result;
      const baseData = {
        items: props.items,
        userId: currentUser()?.id,
        opinion: remark(),
      };

      switch (props.action) {
        case 'submit':
          result = await api.batchSubmitVerification(baseData);
          break;
        case 'verify_pass':
          result = await api.batchVerify({ ...baseData, result: 'pass' });
          break;
        case 'verify_reject':
          result = await api.batchVerify({ ...baseData, result: 'reject', rejectReason: remark() });
          break;
        case 'review_pass':
          result = await api.batchReview({ ...baseData, result: 'pass' });
          break;
        case 'review_reject':
          result = await api.batchReview({ ...baseData, result: 'reject', rejectReason: remark() });
          break;
      }

      if (result && result.failCount > 0) {
        const failed = result.results.filter((r: any) => !r.success);
        const reasons = failed.map((f: any) => `${f.planNo || f.id}: ${f.message}`).join('；');
        setError(`成功 ${result.successCount} 条，失败 ${result.failCount} 条：${reasons}`);
      } else {
        props.onSuccess();
      }
    } catch (e: any) {
      setError(e.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="modal-overlay" onClick={props.onClose}>
      <div class="modal-content" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h3 class="modal-title">{getTitle()}</h3>
          <button class="modal-close" onClick={props.onClose}>×</button>
        </div>
        <div class="modal-body">
          {error() && <div class="form-error">{error()}</div>}

          <p style="margin-bottom: 16px; color: #666;">
            共选中 <strong style="color: #1890ff;">{props.items.length}</strong> 条记录，确定执行此操作？
          </p>

          {needRemark() && (
            <div class="form-item">
              <label class="form-label">
                退回原因 <span class="required">*</span>
              </label>
              <textarea
                value={remark()}
                onInput={(e) => setRemark(e.target.value)}
                class="form-textarea"
                placeholder="请填写退回原因"
                rows={4}
              />
            </div>
          )}

          {!needRemark() && (
            <div class="form-item">
              <label class="form-label">处理意见（可选）</label>
              <textarea
                value={remark()}
                onInput={(e) => setRemark(e.target.value)}
                class="form-textarea"
                placeholder="请填写处理意见"
                rows={3}
              />
            </div>
          )}
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onClick={props.onClose}>取消</button>
          <button class="btn btn-primary" onClick={handleSubmit} disabled={loading()}>
            {loading() ? '处理中...' : '确定'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchOperationModal;
