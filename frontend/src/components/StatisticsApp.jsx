import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { toast } from './Toast.jsx';
import { getStatusText, getStatusColor } from '../utils/format';

export default function StatisticsApp() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api.statistics();
    setLoading(false);
    if (r.ok && r.data.code === 0) setStats(r.data.data);
    else toast(r.data.message || '加载失败', 'error');
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="card"><div className="empty">加载中...</div></div>;
  if (!stats) return null;

  return (
    <div>
      <div className="stat-cards">
        <div className="stat-card">
          <div className="label">发车计划总数</div>
          <div className="value primary">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="label">今日新增</div>
          <div className="value warning">{stats.todayCount}</div>
        </div>
        <div className="stat-card">
          <div className="label">已归档</div>
          <div className="value success">{stats.archivedCount}</div>
        </div>
        <div className="stat-card">
          <div className="label">待处理</div>
          <div className="value danger">
            {stats.total - stats.archivedCount}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">各状态分布</div>
        <table className="table">
          <thead>
            <tr>
              <th>状态</th>
              <th>数量</th>
              <th>占比</th>
              <th style={{ width: 300 }}>可视化</th>
            </tr>
          </thead>
          <tbody>
            {stats.statusList.map(s => (
              <tr key={s.status}>
                <td>
                  <span className="tag" style={{ background: getStatusColor(s.status) + '22', color: getStatusColor(s.status) }}>
                    {s.text}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>{s.count}</td>
                <td>{stats.total === 0 ? '0%' : ((s.count / stats.total) * 100).toFixed(1) + '%'}</td>
                <td>
                  <div style={{ background: '#f0f2f5', height: 12, borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{
                      width: `${stats.total === 0 ? 0 : (s.count / stats.total) * 100}%`,
                      height: '100%',
                      background: getStatusColor(s.status),
                      borderRadius: 6,
                      transition: 'width .3s'
                    }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
