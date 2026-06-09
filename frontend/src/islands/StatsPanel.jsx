import { useState, useEffect } from 'react';
import { getStats } from '../lib/api';

export default function StatsPanel({ userId, userRole }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !userRole) return;
    setLoading(true);
    getStats(userId, userRole)
      .then(res => {
        if (res.success) {
          setStats(res.stats);
        }
      })
      .finally(() => setLoading(false));
  }, [userId, userRole]);

  if (loading || !stats) {
    return (
      <div className="stats-grid">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="stat-card">
            <div className="stat-label">&nbsp;</div>
            <div className="stat-value">&nbsp;</div>
          </div>
        ))}
      </div>
    );
  }

  const statItems = [
    { key: 'total', label: '全部订单', value: stats.total, color: 'primary' },
    { key: 'myPending', label: '待我处理', value: stats.myPending, color: 'danger' },
    { key: 'pendingAudit', label: '待审核', value: stats.pendingAudit, color: 'warning' },
    { key: 'pendingReview', label: '待复核', value: stats.pendingReview, color: 'purple' },
    { key: 'returned', label: '退回补正', value: stats.returned, color: 'teal' },
    { key: 'highRisk', label: '高风险', value: stats.highRisk, color: 'danger' },
    { key: 'mediumRisk', label: '中风险', value: stats.mediumRisk, color: 'warning' },
    { key: 'archived', label: '已归档', value: stats.archived, color: 'success' }
  ];

  return (
    <div className="stats-grid">
      {statItems.map(item => (
        <div key={item.key} className={`stat-card ${item.color}`}>
          <div className="stat-label">{item.label}</div>
          <div className="stat-value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
