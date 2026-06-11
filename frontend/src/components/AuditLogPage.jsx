import { useState, useEffect } from 'preact/hooks';
import { api } from '../api.js';

function formatTime(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  } catch (e) { return iso; }
}

export default function AuditLogPage({ meta, user, navigate, showToast }) {
  const [filters, setFilters] = useState({ orderId: '', operator: '', action: '' });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [result, setResult] = useState({ total: 0, data: [] });
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.auditLogs({ ...filters, page, pageSize });
      setResult(res);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filters, page]);

  const actionLabelMap = meta?.actionNames || {};
  const roleLabelMap = meta?.roleNames || {};

  return (
    <div>
      <div className="page-title-row">
        <h2>📜 审计日志 · 全量操作记录</h2>
        <div>
          <button onClick={() => load()}>🔄 刷新</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-item">
          <label>单号：</label>
          <input
            placeholder="完整 orderId"
            value={filters.orderId}
            onInput={(e) => { setFilters(f => ({ ...f, orderId: e.target.value })); setPage(1); }}
          />
        </div>
        <div className="filter-item">
          <label>操作人：</label>
          <input
            placeholder="如 registrar_wang"
            value={filters.operator}
            onInput={(e) => { setFilters(f => ({ ...f, operator: e.target.value })); setPage(1); }}
          />
        </div>
        <div className="filter-item">
          <label>动作：</label>
          <select value={filters.action} onChange={(e) => { setFilters(f => ({ ...f, action: e.target.value })); setPage(1); }}>
            <option value="">全部</option>
            {(meta?.actions || []).map(a => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
            <option value="create">创建</option>
            <option value="update_draft">编辑草稿</option>
          </select>
        </div>
        <div className="spacer" />
        <button onClick={() => { setFilters({ orderId: '', operator: '', action: '' }); setPage(1); }}>重置</button>
      </div>

      <div className="table-wrap">
        <table className="audit-table" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ width: 160 }}>时间</th>
              <th style={{ width: 140 }}>操作人</th>
              <th style={{ width: 100 }}>角色</th>
              <th style={{ width: 130 }}>动作</th>
              <th style={{ width: 140 }}>单据</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="6" className="empty">加载中...</td></tr>
            )}
            {!loading && result.data.length === 0 && (
              <tr><td colSpan="6" className="empty">暂无日志</td></tr>
            )}
            {!loading && result.data.map(l => (
              <tr key={l.id}>
                <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{formatTime(l.createdAt)}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{l.operator}</div>
                </td>
                <td>
                  <span className="tag blue" style={{ fontSize: 11 }}>{roleLabelMap[l.operatorRole] || l.operatorRole}</span>
                </td>
                <td>
                  <span className="tag gray" style={{ fontSize: 11 }}>{actionLabelMap[l.action] || l.actionName || l.action}</span>
                </td>
                <td>
                  {l.orderNo && (
                    <a onClick={() => navigate('detail', { id: l.orderId })} style={{ fontWeight: 500 }}>
                      {l.orderNo}
                    </a>
                  )}
                  {!l.orderNo && <span style={{ color: 'var(--gray-400)' }}>-</span>}
                </td>
                <td style={{ lineHeight: 1.6, color: 'var(--gray-700)' }}>{l.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination">
          <div>共 {result.total} 条，第 {page} / {result.totalPages || 1} 页</div>
          <div className="pages">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>上一页</button>
            <button disabled={page >= (result.totalPages || 1)} onClick={() => setPage(p => p + 1)}>下一页</button>
          </div>
        </div>
      </div>
    </div>
  );
}
