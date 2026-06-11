import { createSignal, createMemo } from 'solid-js';
import { expenseApi } from '../api/expenseApi';
import { useToast } from '../stores/toastStore';
import { useAuth } from '../stores/authStore';

function BatchActions(props) {
  const [loading, setLoading] = createSignal(false);
  const [showBatchModal, setShowBatchModal] = createSignal(false);
  const [batchType, setBatchType] = createSignal('');
  const [opinion, setOpinion] = createSignal('');
  const [reason, setReason] = createSignal('');

  const toast = useToast();
  const { userInfo } = useAuth();

  const selectedItems = createMemo(() => {
    if (!props.list || !props.selectedIds || props.selectedIds.length === 0) {
      return [];
    }
    return props.list.filter(item => props.selectedIds.includes(item.id));
  });

  const materialStats = createMemo(() => {
    const items = selectedItems();
    if (items.length === 0) {
      return { total: 0, complete: 0, incomplete: 0, incompleteList: [] };
    }
    const incomplete = items.filter(item => {
      const mi = item.materialInfo || {};
      return !mi.isComplete;
    });
    return {
      total: items.length,
      complete: items.length - incomplete.length,
      incomplete: incomplete.length,
      incompleteList: incomplete,
    };
  });

  const openBatchModal = (type) => {
    setBatchType(type);
    setOpinion('');
    setReason('');
    setShowBatchModal(true);
  };

  const handleBatchStartVerify = async () => {
    setLoading(true);
    try {
      const res = await expenseApi.batchStartVerify(props.selectedIds);
      if (res.success) {
        toast.success(`批量开始核验成功：${res.data.success} 项成功，${res.data.failed} 项失败`);
        if (res.data.errors && res.data.errors.length > 0) {
          res.data.errors.forEach(err => {
            toast.warning(`${err.id}: ${err.message}`);
          });
        }
        props.onRefresh();
        setShowBatchModal(false);
      }
    } catch (err) {
      toast.error(err.message || '批量操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchPassReview = async () => {
    if (!opinion() || opinion().trim().length < 3) {
      toast.warning('请填写复核意见（至少3个字）');
      return;
    }

    setLoading(true);
    try {
      const res = await expenseApi.batchPassReview(props.selectedIds, opinion());
      if (res.success) {
        toast.success(`批量复核通过成功：${res.data.success} 项成功，${res.data.failed} 项失败`);
        if (res.data.errors && res.data.errors.length > 0) {
          res.data.errors.forEach(err => {
            toast.warning(`${err.id}: ${err.message}`);
          });
        }
        props.onRefresh();
        setShowBatchModal(false);
      }
    } catch (err) {
      toast.error(err.message || '批量操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchRejectReview = async () => {
    if (!reason() || reason().trim().length < 5) {
      toast.warning('请填写驳回原因（至少5个字）');
      return;
    }

    setLoading(true);
    try {
      const res = await expenseApi.batchRejectReview(props.selectedIds, reason());
      if (res.success) {
        toast.success(`批量驳回成功：${res.data.success} 项成功，${res.data.failed} 项失败`);
        if (res.data.errors && res.data.errors.length > 0) {
          res.data.errors.forEach(err => {
            toast.warning(`${err.id}: ${err.message}`);
          });
        }
        props.onRefresh();
        setShowBatchModal(false);
      }
    } catch (err) {
      toast.error(err.message || '批量操作失败');
    } finally {
      setLoading(false);
    }
  };

  const submitBatchAction = () => {
    switch (batchType()) {
      case 'startVerify':
        handleBatchStartVerify();
        break;
      case 'passReview':
        handleBatchPassReview();
        break;
      case 'rejectReview':
        handleBatchRejectReview();
        break;
      default:
        break;
    }
  };

  if (props.selectedIds.length === 0) return null;

  const hasBatchAction = props.canBatchVerify || props.canBatchReview;

  if (!hasBatchAction) return null;

  const stats = materialStats();

  return (
    <div>
      <style>{`
        .batch-bar {
          background: #e6f7ff;
          border: 1px solid #91d5ff;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .batch-info { font-size: 13px; color: #1890ff; flex: 1; }
        .batch-material-info { font-size: 12px; color: #595959; }
        .batch-material-info .complete { color: #52c41a; }
        .batch-material-info .incomplete { color: #faad14; }
        .batch-actions { display: flex; gap: 8px; }
        .batch-warn {
          background: #fffbe6;
          border: 1px solid #ffe58f;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 16px;
          font-size: 13px;
          color: #faad14;
        }
        .batch-warn-list {
          margin-top: 8px;
          padding-left: 20px;
        }
        .batch-warn-list li {
          margin-bottom: 4px;
          font-size: 12px;
        }
      `}</style>

      <div class="batch-bar">
        <div class="batch-info">
          已选择 <strong>{props.selectedIds.length}</strong> 项报销申请
          {stats.incomplete > 0 && (
            <span class="batch-material-info" style="margin-left: 12px;">
              （材料齐全：<span class="complete">{stats.complete}</span> 项，
              材料不全：<span class="incomplete">{stats.incomplete}</span> 项）
            </span>
          )}
        </div>
        <div class="batch-actions">
          {props.canBatchVerify && (
            <button
              class="btn btn-primary btn-sm"
              onClick={() => openBatchModal('startVerify')}
            >
              批量开始核验
            </button>
          )}
          {props.canBatchReview && (
            <>
              <button
                class="btn btn-success btn-sm"
                onClick={() => openBatchModal('passReview')}
              >
                批量通过
              </button>
              <button
                class="btn btn-danger btn-sm"
                onClick={() => openBatchModal('rejectReview')}
              >
                批量驳回
              </button>
            </>
          )}
        </div>
      </div>

      {showBatchModal() && (
        <div class="modal-overlay" onClick={() => !loading() && setShowBatchModal(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              {batchType() === 'startVerify' && '批量开始核验'}
              {batchType() === 'passReview' && '批量复核通过'}
              {batchType() === 'rejectReview' && '批量驳回'}
            </div>
            <div class="modal-body">
              <p style={{ marginBottom: '16px' }}>
                即将对选中的 <strong>{props.selectedIds.length}</strong> 项报销申请执行操作。
              </p>

              {stats.incomplete > 0 && (
                <div class="batch-warn">
                  ⚠️ 有 <strong>{stats.incomplete}</strong> 项材料不全，操作时会显示异常原因，请注意查看。
                  <ul class="batch-warn-list">
                    {stats.incompleteList.slice(0, 5).map(item => (
                      <li key={item.id}>
                        {item.title}（{item.id}）- 缺：
                        {(item.materialInfo?.missingLabels || []).slice(0, 2).join('、')}
                        {(item.materialInfo?.missingLabels?.length || 0) > 2 ? '...' : ''}
                      </li>
                    ))}
                    {stats.incompleteList.length > 5 && (
                      <li>...还有 {stats.incompleteList.length - 5} 项</li>
                    )}
                  </ul>
                </div>
              )}

              {batchType() === 'passReview' && (
                <div class="form-item">
                  <label class="form-label">复核意见 *</label>
                  <textarea
                    class="form-textarea"
                    placeholder="请输入复核意见（至少3个字）"
                    value={opinion()}
                    onInput={(e) => setOpinion(e.target.value)}
                  />
                </div>
              )}

              {batchType() === 'rejectReview' && (
                <div class="form-item">
                  <label class="form-label">驳回原因 *</label>
                  <textarea
                    class="form-textarea"
                    placeholder="请输入驳回原因（至少5个字）"
                    value={reason()}
                    onInput={(e) => setReason(e.target.value)}
                  />
                </div>
              )}

              {batchType() === 'startVerify' && (
                <p style={{ color: '#8c8c8c', fontSize: '13px' }}>
                  仅状态为「待核验」的申请会被处理，其他状态的会被跳过。
                </p>
              )}
            </div>
            <div class="modal-footer">
              <button
                class="btn"
                onClick={() => setShowBatchModal(false)}
                disabled={loading()}
              >
                取消
              </button>
              <button
                class={`btn ${batchType() === 'rejectReview' ? 'btn-danger' : 'btn-primary'}`}
                onClick={submitBatchAction}
                disabled={loading()}
              >
                {loading() ? '处理中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BatchActions;
