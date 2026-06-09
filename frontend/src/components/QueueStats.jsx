import { STATUS_OPTIONS } from '../utils/constants'

const STATUS_KEY_MAP = {
  pending_registration: 'pending_registration',
  pending_review: 'pending_review',
  pending_final: 'pending_final',
  returned: 'returned',
  abnormal: 'abnormal',
}

export default function QueueStats({ stats, onFilterClick }) {
  if (!stats) {
    return (
      <div className="queue-stats">
        <div className="stats-skeleton">加载中...</div>
      </div>
    )
  }

  const queueItems = [
    {
      key: 'pending_registration',
      label: '待登记',
      value: stats.pending_registration,
      color: '#8c8c8c',
      desc: '配镜登记员处理',
    },
    {
      key: 'pending_review',
      label: '待审核',
      value: stats.pending_review,
      color: '#faad14',
      desc: '配镜审核主管处理',
    },
    {
      key: 'pending_final',
      label: '待复核',
      value: stats.pending_final,
      color: '#1890ff',
      desc: '眼科诊所复核负责人处理',
    },
    {
      key: 'returned',
      label: '已退回',
      value: stats.returned,
      color: '#f5222d',
      desc: '等待补正',
    },
    {
      key: 'abnormal',
      label: '异常订单',
      value: stats.abnormal,
      color: '#fa541c',
      desc: '含异常标记',
    },
    {
      key: 'overdue',
      label: '超时订单',
      value: stats.overdue,
      color: '#f5222d',
      desc: '超过处理时限',
    },
  ]

  return (
    <div className="queue-stats">
      <div className="queue-stats-header">
        <h3>待处理队列</h3>
        <span className="queue-total">总计 {stats.total} 条订单</span>
      </div>
      <div className="queue-stats-grid">
        {queueItems.map((item) => (
          <div
            key={item.key}
            className="queue-card"
            onClick={() =>
              item.key === 'abnormal'
                ? onFilterClick?.({ anomaly: 'has' })
                : item.key === 'overdue'
                ? onFilterClick?.({ is_overdue: true })
                : onFilterClick?.({ status: item.key })
            }
            style={{ borderLeftColor: item.color }}
          >
            <div className="queue-card-value" style={{ color: item.color }}>
              {item.value}
            </div>
            <div className="queue-card-label">{item.label}</div>
            <div className="queue-card-desc">{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
