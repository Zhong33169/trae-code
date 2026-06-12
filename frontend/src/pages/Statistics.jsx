import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { api } from '../utils/api';
import { NODE_TEXT } from '../utils/format';
import { showToast } from '../components/Toast';

export default function Statistics({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.statistics();
      setData(res);
    } catch (err) {
      showToast(err.message || '加载统计失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    const iv = setInterval(fetch, 30000);
    return () => clearInterval(iv);
  }, []);

  if (loading) return <div class="page-card"><div class="empty-state">加载中...</div></div>;
  if (!data) return <div class="page-card"><div class="empty-state">加载失败</div></div>;

  const s = data.summary;
  const nodeStats = data.node_stats || [];

  const maxCount = Math.max(1, ...nodeStats.map((n) => n.count || 0));

  return (
    <div>
      <div class="stat-cards">
        <div class="stat-card info">
          <div class="stat-label">隐患单总数</div>
          <div class="stat-value">{s.total}</div>
        </div>
        <div class="stat-card warn">
          <div class="stat-label">待分派</div>
          <div class="stat-value">{s.pending}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">已转办（处理中）</div>
          <div class="stat-value">{s.assigned}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">已回访</div>
          <div class="stat-value">{s.revisited}</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">节点超时</div>
          <div class="stat-value">{s.timeout}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">本月新增</div>
          <div class="stat-value">{s.this_month}</div>
        </div>
      </div>

      <div class="page-card" style={{ marginBottom: 16 }}>
        <div class="detail-title" style={{ marginBottom: 16 }}>状态分布</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 30, padding: 20, height: 240 }}>
          {[
            { label: '待分派', value: s.pending, color: '#fa8c16' },
            { label: '已转办', value: s.assigned, color: '#1890ff' },
            { label: '已回访', value: s.revisited, color: '#52c41a' },
            { label: '超时', value: s.timeout, color: '#ff4d4f' },
          ].map((item) => {
            const max = Math.max(1, s.total);
            const h = (item.value / max) * 180;
            return (
              <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: item.color, marginBottom: 8 }}>{item.value}</div>
                <div
                  style={{
                    width: 60,
                    height: Math.max(4, h),
                    background: item.color,
                    borderRadius: '4px 4px 0 0',
                    opacity: 0.85,
                  }}
                />
                <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>{item.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div class="page-card">
        <div class="detail-title" style={{ marginBottom: 16 }}>各节点分布（含超时）</div>
        {nodeStats.length === 0 ? (
          <div class="empty-state">暂无数据</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>节点</th>
                <th>数量</th>
                <th>超时数</th>
                <th>分布</th>
              </tr>
            </thead>
            <tbody>
              {nodeStats.map((n) => (
                <tr key={n.node}>
                  <td style={{ fontWeight: 600 }}>{NODE_TEXT[n.node] || n.node}</td>
                  <td>{n.count}</td>
                  <td>
                    {n.timeout_count > 0 ? (
                      <span class="timeout-tag">{n.timeout_count}</span>
                    ) : (
                      <span style={{ color: '#999' }}>0</span>
                    )}
                  </td>
                  <td style={{ width: 300 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        flex: 1,
                        height: 10,
                        background: '#f0f0f0',
                        borderRadius: 5,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${(n.count / maxCount) * 100}%`,
                          height: '100%',
                          background: n.timeout_count > 0 ? '#ff4d4f' : '#1890ff',
                        }} />
                      </div>
                      <span style={{ color: '#666', fontSize: 12, width: 50 }}>
                        {s.total > 0 ? ((n.count / s.total) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
