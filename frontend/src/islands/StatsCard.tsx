import { useState, useEffect } from 'react';
import { getStats } from '../lib/api';
import type { Stats } from '../lib/types';

export default function StatsCard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getStats();
      setStats(data);
    } catch (err) {
      console.error('加载统计失败', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUserChange = () => loadData();
    window.addEventListener('userChanged', handleUserChange);
    return () => window.removeEventListener('userChanged', handleUserChange);
  }, []);

  if (loading && !stats) {
    return <div className="stats-grid"><div>加载中...</div></div>;
  }

  if (!stats) return null;

  const statItems = [
    { label: '申请单总数', value: stats.total, cls: 'highlight' },
    { label: '待审核', value: stats.submitted + stats.resubmitted, cls: '' },
    { label: '审核通过', value: stats.review_passed, cls: 'success' },
    { label: '复核中', value: stats.under_final, cls: '' },
    { label: '已归档', value: stats.archived, cls: 'success' },
    { label: '退回补正', value: stats.correction_requested, cls: 'warning' },
    { label: '缺证据', value: stats.evidence_missing, cls: 'warning' },
    { label: '状态冲突', value: stats.status_conflict, cls: 'danger' },
    { label: '申诉中', value: stats.appeal_total, cls: 'danger' },
  ];

  return (
    <div className="stats-grid">
      {statItems.map((item) => (
        <div key={item.label} className="stat-card">
          <div className="stat-label">{item.label}</div>
          <div className={`stat-value ${item.cls}`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
