import { For } from 'solid-js';

function AuditLogList(props) {
  const actionLabels = {
    create: { text: '创建', icon: '➕', color: '#1890ff' },
    submit: { text: '提交', icon: '📤', color: '#13c2c2' },
    start_verify: { text: '开始核验', icon: '🔍', color: '#faad14' },
    verify_pass: { text: '核验通过', icon: '✅', color: '#52c41a' },
    verify_reject: { text: '核验驳回', icon: '❌', color: '#ff4d4f' },
    request_supplement: { text: '要求补材料', icon: '📝', color: '#faad14' },
    review_pass: { text: '复核通过', icon: '✅', color: '#52c41a' },
    review_reject: { text: '复核驳回', icon: '❌', color: '#ff4d4f' },
    update_deadline: { text: '调整截止时间', icon: '⏰', color: '#722ed1' },
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (!props.logs || props.logs.length === 0) {
    return <div class="empty-state" style={{ padding: '30px' }}>暂无审计记录</div>;
  }

  return (
    <div class="audit-log-list">
      <style>{`
        .audit-log-list { position: relative; padding-left: 24px; }
        .audit-log-list::before {
          content: '';
          position: absolute;
          left: 8px;
          top: 8px;
          bottom: 8px;
          width: 2px;
          background: #f0f0f0;
        }
        .log-item {
          position: relative;
          margin-bottom: 16px;
        }
        .log-item:last-child { margin-bottom: 0; }
        .log-dot {
          position: absolute;
          left: -24px;
          top: 2px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid #d9d9d9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
        }
        .log-content { }
        .log-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .log-action {
          font-weight: 500;
          font-size: 14px;
        }
        .log-time {
          font-size: 12px;
          color: #8c8c8c;
        }
        .log-user {
          font-size: 12px;
          color: #595959;
          margin-bottom: 4px;
        }
        .log-remark {
          font-size: 13px;
          color: #595959;
          line-height: 1.5;
        }
      `}</style>

      <For each={props.logs}>
        {(log) => {
          const actionInfo = actionLabels[log.action] || { text: log.action, icon: '📌', color: '#8c8c8c' };
          return (
            <div class="log-item">
              <div class="log-dot" style={{ borderColor: actionInfo.color, color: actionInfo.color }}>
                {actionInfo.icon}
              </div>
              <div class="log-content">
                <div class="log-header">
                  <span class="log-action" style={{ color: actionInfo.color }}>
                    {actionInfo.text}
                  </span>
                  <span class="log-time">{formatTime(log.time)}</span>
                </div>
                <div class="log-user">操作人：{log.userName}</div>
                <div class="log-remark">{log.remark}</div>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}

export default AuditLogList;
