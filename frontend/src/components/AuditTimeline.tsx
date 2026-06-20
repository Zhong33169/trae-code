import { Timeline, Card } from 'antd';
import type { AuditLog } from '@/types';
import { ROLE_LABEL_MAP, Role } from '@/types';
import dayjs from 'dayjs';

const ACTION_LABEL_MAP: Record<string, string> = {
  create: '创建',
  submit: '提交',
  approve: '审核通过',
  reject: '退回补正',
  review: '复核归档',
  'review-reject': '复核退回',
  guest_confirm: '嘉宾确认',
  checkin_feedback: '签到反馈',
};

const STATUS_LABEL_MAP: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审核',
  review_rejected: '审核退回',
  pending_final: '待复核',
  final_rejected: '复核退回',
  archived: '已归档',
};

interface Props {
  logs: AuditLog[];
  loading?: boolean;
}

const AuditTimeline: React.FC<Props> = ({ logs, loading }) => {
  return (
    <Card title="处理记录" loading={loading}>
      {logs.length === 0 ? (
        <div className="text-gray-400 text-sm text-center py-4">暂无处理记录</div>
      ) : (
        <Timeline
          items={logs.map((log) => ({
            color: 'blue',
            children: (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{log.operatorName}</span>
                  <span className="text-gray-400 text-xs">
                    ({ROLE_LABEL_MAP[log.operatorRole as Role] ?? log.operatorRole})
                  </span>
                  <span className="text-gray-400 text-xs">
                    {dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-blue-600">{ACTION_LABEL_MAP[log.action] ?? log.action}</span>
                  {log.detail && <span className="text-gray-500 ml-2">{log.detail}</span>}
                </div>
                {log.beforeStatus && log.afterStatus && (
                  <div className="text-xs text-gray-400">
                    状态变更: {STATUS_LABEL_MAP[log.beforeStatus] ?? log.beforeStatus} → {STATUS_LABEL_MAP[log.afterStatus] ?? log.afterStatus}
                  </div>
                )}
              </div>
            ),
          }))}
        />
      )}
    </Card>
  );
};

export default AuditTimeline;
