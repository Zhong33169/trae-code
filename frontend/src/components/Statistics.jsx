import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { fetchStats } from '../api/client';
import useRefreshEvent from '../hooks/useRefreshEvent';

const STATUS_LABELS = {
  draft: '待发起',
  pending_process: '待办理',
  pending_review: '待复核',
  stage_completed: '阶段完成',
  completed: '已完成',
  returned: '已退回',
  overdue: '逾期',
  conflict: '状态冲突',
};

const STATUS_COLORS = {
  draft: 'blue',
  pending_process: 'blue',
  pending_review: 'orange',
  stage_completed: 'green',
  completed: 'green',
  returned: 'red',
  overdue: 'red',
  conflict: 'purple',
};

export default function Statistics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchStats();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 15000);
    return () => clearInterval(interval);
  }, [loadStats]);

  useRefreshEvent(loadStats);

  if (loading) return <div class="page-container"><div class="loading">加载中...</div></div>;
  if (!stats) return <div class="page-container"><div class="empty-state">暂无统计数据</div></div>;

  const total = stats.total || 0;
  const byRisk = stats.by_risk || {};
  const highCount = byRisk.high || 0;
  const mediumCount = byRisk.medium || 0;
  const lowCount = byRisk.low || 0;
  const stageStats = stats.by_stage || {};
  const statusStats = stats.by_status || {};

  const maxBarValue = total || 1;

  const stageEntries = [
    { key: 'refund', label: '售后退款', color: 'blue' },
    { key: 'warehouse', label: '仓库核实', color: 'orange' },
    { key: 'followup', label: '客服回访', color: 'green' },
  ];

  return (
    <div class="page-container">
      <h1 class="page-title">统计概览</h1>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">总工单数</div>
          <div class="stat-value">{total}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">高风险</div>
          <div class="stat-value high">{highCount}</div>
          <div class="stat-bar">
            <div
              class="fill red"
              style={`width:${(highCount / maxBarValue) * 100}%`}
            />
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">中风险</div>
          <div class="stat-value medium">{mediumCount}</div>
          <div class="stat-bar">
            <div
              class="fill orange"
              style={`width:${(mediumCount / maxBarValue) * 100}%`}
            />
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">低风险</div>
          <div class="stat-value low">{lowCount}</div>
          <div class="stat-bar">
            <div
              class="fill green"
              style={`width:${(lowCount / maxBarValue) * 100}%`}
            />
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-title">按阶段分布</div>
        {stageEntries.map((se) => {
          const count = stageStats[se.key] || 0;
          return (
            <div key={se.key} style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
                <span>{se.label}</span>
                <span style="font-weight:600;">{count}</span>
              </div>
              <div class="stat-bar">
                <div
                  class={`fill ${se.color}`}
                  style={`width:${(count / maxBarValue) * 100}%`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div class="card">
        <div class="section-title">按状态分布</div>
        {Object.entries(statusStats).map(([key, count]) => (
          <div key={key} style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
              <span>{STATUS_LABELS[key] || key}</span>
              <span style="font-weight:600;">{count}</span>
            </div>
            <div class="stat-bar">
              <div
                class={`fill ${STATUS_COLORS[key] || 'blue'}`}
                style={`width:${(count / maxBarValue) * 100}%`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
