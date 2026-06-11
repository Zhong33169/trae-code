import { createSignal, onMount } from 'solid-js';

function ActionModal(props) {
  const [inputValue, setInputValue] = createSignal('');
  const [reasonValue, setReasonValue] = createSignal('');

  onMount(() => {
    setInputValue('');
    setReasonValue('');
  });

  const handleSubmit = () => {
    const type = props.type;

    if (type === 'submit' || type === 'startVerify') {
      props.onSubmit?.({});
      return;
    }

    if (type === 'passVerify') {
      if (!inputValue() || inputValue().trim().length < 5) {
        alert('请填写核验意见（至少5个字）');
        return;
      }
      props.onSubmit?.({ opinion: inputValue().trim() });
      return;
    }

    if (type === 'rejectVerify') {
      if (!reasonValue() || reasonValue().trim().length < 5) {
        alert('请填写驳回原因（至少5个字）');
        return;
      }
      props.onSubmit?.({ reason: reasonValue().trim() });
      return;
    }

    if (type === 'requestSupplement') {
      if (!reasonValue() || reasonValue().trim().length < 5) {
        alert('请填写补材料说明（至少5个字）');
        return;
      }
      props.onSubmit?.({ reason: reasonValue().trim() });
      return;
    }

    if (type === 'passReview') {
      if (!inputValue() || inputValue().trim().length < 3) {
        alert('请填写复核意见（至少3个字）');
        return;
      }
      props.onSubmit?.({ opinion: inputValue().trim() });
      return;
    }

    if (type === 'rejectReview') {
      if (!reasonValue() || reasonValue().trim().length < 5) {
        alert('请填写驳回原因（至少5个字）');
        return;
      }
      props.onSubmit?.({ reason: reasonValue().trim() });
      return;
    }

    props.onSubmit?.({});
  };

  if (!props.visible) return null;

  const isDanger = props.type === 'rejectVerify' || props.type === 'rejectReview';
  const needsOpinion = props.type === 'passVerify' || props.type === 'passReview';
  const needsReason = props.type === 'rejectVerify' || props.type === 'rejectReview' || props.type === 'requestSupplement';
  const isConfirmOnly = props.type === 'submit' || props.type === 'startVerify';

  const opinionPlaceholder = props.type === 'passVerify'
    ? '请输入核验意见（至少5个字）'
    : '请输入复核意见（至少3个字）';

  const reasonPlaceholder = props.type === 'requestSupplement'
    ? '请输入需要补充的材料说明（至少5个字）'
    : '请输入驳回原因（至少5个字）';

  return (
    <div class="modal-overlay" onClick={() => !props.submitting && props.onClose?.()}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">{props.title}</div>
        <div class="modal-body">
          {isConfirmOnly && (
            <p>确定要执行此操作吗？</p>
          )}

          {needsOpinion && (
            <div class="form-item">
              <label class="form-label">处理意见 *</label>
              <textarea
                class="form-textarea"
                placeholder={opinionPlaceholder}
                value={inputValue()}
                onInput={(e) => setInputValue(e.target.value)}
                disabled={props.submitting}
              />
            </div>
          )}

          {needsReason && (
            <div class="form-item">
              <label class="form-label">{props.type === 'requestSupplement' ? '补材料说明' : '驳回原因'} *</label>
              <textarea
                class="form-textarea"
                placeholder={reasonPlaceholder}
                value={reasonValue()}
                onInput={(e) => setReasonValue(e.target.value)}
                disabled={props.submitting}
              />
            </div>
          )}

          <p style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '12px' }}>
            ⚠️ 操作将即时生效，并记录到审计日志中
          </p>
        </div>
        <div class="modal-footer">
          <button
            class="btn"
            onClick={() => props.onClose?.()}
            disabled={props.submitting}
          >
            取消
          </button>
          <button
            class={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleSubmit}
            disabled={props.submitting}
          >
            {props.submitting ? '提交中...' : '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ActionModal;
