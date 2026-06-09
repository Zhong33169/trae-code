import { formatDate } from '../lib/types';

interface Props {
  records: any[];
}

function getDotColor(action: string, toStatus: string): string {
  if (action.includes('pass') || action === 'archive' || action === 'appeal_resolve' || toStatus === 'archived') {
    return 'success';
  }
  if (action.includes('reject') || action === 'conflict' || action.includes('missing') || toStatus === 'rejected' || toStatus === 'status_conflict') {
    return 'danger';
  }
  if (action === 'appeal_submit' || action === 'appeal_accept' || toStatus.startsWith('appeal_')) {
    return 'purple';
  }
  if (action === 'submit' || action === 'resubmit' || action === 'correct') {
    return 'info';
  }
  if (action === 'start_final' || action === 'review') {
    return 'purple';
  }
  return 'info';
}

export default function HistoryTimeline({ records }: Props) {
  if (records.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <div>暂无处理记录</div>
      </div>
    );
  }

  return (
    <div className="timeline">
      {records.map((record) => (
        <div key={record.id} className="timeline-item">
          <div className={`timeline-dot ${getDotColor(record.action, record.to_status)}`}></div>
          <div className="timeline-header">
            <span className="timeline-action">{record.action_name}</span>
            <span className="timeline-time">{formatDate(record.created_at)}</span>
            <span className="status-tag" style={{ fontSize: 11 }}>
              v{record.version}
            </span>
          </div>
          <div className="timeline-operator">
            {record.operator_name}
            <span style={{ color: '#9ca3af', margin: '0 6px' }}>·</span>
            <span style={{ color: '#6b7280' }}>{record.operator_role_name}</span>
            {record.from_status && (
              <>
                <span style={{ color: '#9ca3af', margin: '0 6px' }}>·</span>
                <span style={{ color: '#6b7280' }}>
                  {record.from_status_name} → {record.to_status_name}
                </span>
              </>
            )}
          </div>
          {(record.opinion || record.reject_reason) && (
            <div className="timeline-content">
              {record.opinion && (
                <div>
                  <div className="label">处理意见</div>
                  <div>{record.opinion}</div>
                </div>
              )}
              {record.reject_reason && (
                <div style={{ marginTop: record.opinion ? 8 : 0 }}>
                  <div className="label" style={{ color: '#dc2626' }}>驳回/原因</div>
                  <div style={{ color: '#b91c1c' }}>{record.reject_reason}</div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
