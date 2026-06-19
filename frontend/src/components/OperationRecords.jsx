import { h } from 'preact';

const ROLE_MAP = {
  clerk: '文员',
  supervisor: '主管',
  reviewer: '复核员',
};

const ACTION_LABELS = {
  initiate: '发起处理',
  process: '办理通过',
  return: '退回补正',
  review_archive: '复核归档',
  correct: '补正提交',
  validation_failed: '验证失败',
  stage_advance: '阶段推进',
  risk_change: '风险等级变更',
  update_evidence: '更新证据',
  create: '创建工单',
};

export default function OperationRecords({ records }) {
  if (!records || records.length === 0) {
    return <div style="color:#999;font-size:13px;">暂无处理记录</div>;
  }

  const sorted = [...records].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  return (
    <div class="timeline">
      {sorted.map((rec, i) => {
        const isReturn = rec.action === 'return';
        const isValidationFailed = rec.action === 'validation_failed';
        let itemClass = '';
        if (isReturn) itemClass = 'action-return';
        if (isValidationFailed) itemClass = 'action-validation_failed';

        let actionTextClass = '';
        if (isReturn) actionTextClass = 'action-return';
        if (isValidationFailed) actionTextClass = 'action-validation_failed';

        return (
          <div key={i} class={`timeline-item ${itemClass}`}>
            <div class="time">
              {new Date(rec.created_at).toLocaleString('zh-CN')}
            </div>
            <div class="handler">
              {rec.handler_name}（{ROLE_MAP[rec.handler_role] || rec.handler_role}）
            </div>
            <div class={`action-text ${actionTextClass}`}>
              操作：{ACTION_LABELS[rec.action] || rec.action}
            </div>
            {rec.opinion && (
              <div class="action-text">意见：{rec.opinion}</div>
            )}
            {rec.result && (
              <div class="action-text">结果：{rec.result}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
