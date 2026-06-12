import { useState, useEffect, useMemo } from 'preact/hooks';
import { api } from '../api.js';

function formatTime(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  } catch (e) { return iso; }
}

const FAILURE_TYPE_LABELS = {
  version_missing: { label: '缺版本', color: 'danger' },
  version_format:  { label: '版本格式错', color: 'warning' },
  version:         { label: '版本冲突', color: 'warning' },
  materials:       { label: '缺材料', color: 'warning' },
  permission:      { label: '越权', color: 'danger' },
  lock:            { label: '锁失效', color: 'danger' },
  overdue:         { label: '逾期', color: 'danger' },
  opinion:         { label: '意见过短', color: 'warning' },
  reject:          { label: '退回', color: 'warning' },
  not_found:       { label: '不存在', color: 'danger' },
  unknown:         { label: '失败', color: 'danger' },
};

const VERSION_SUBTYPE_LABELS = {
  missing: '缺版本',
  format: '格式错',
  conflict: '版本冲突',
};

function tagClass(color) {
  const map = { success: 'green', warning: 'orange', danger: 'red', info: 'blue', neutral: 'gray' };
  return `tag ${map[color] || 'gray'}`;
}

export default function AuditLogPage({ meta, user, navigate, showToast }) {
  const [filters, setFilters] = useState({ orderId: '', operator: '', action: '', success: '', failureType: '', batch: '' });
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

  useEffect(() => { load(); }, [filters, page]);

  const actionLabelMap = meta?.actionNames || {};
  const roleLabelMap = meta?.roleNames || {};
  const statusLabelMap = meta?.statusNames || {};

  const stats = useMemo(() => {
    const s = { total: 0, success: 0, failed: 0, batch: 0, versionFail: 0 };
    for (const l of result.data) {
      s.total++;
      if (l.success) s.success++; else s.failed++;
      if (l.batch) s.batch++;
      if (l.failureType === 'version_missing' || l.failureType === 'version_format' || l.failureType === 'version') {
        s.versionFail++;
      }
    }
    return s;
  }, [result.data]);

  return (
    <div>
      <div className="page-title-row">
        <h2>📜 审计日志 · 全量操作记录</h2>
        <div>
          <button onClick={() => load()}>🔄 刷新</button>
        </div>
      </div>

      <div className="stats-row" style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="stat-chip primary">共 {stats.total} 条</div>
        <div className="stat-chip success">成功 {stats.success}</div>
        <div className="stat-chip danger">失败 {stats.failed}</div>
        <div className="stat-chip warning">批量操作 {stats.batch}</div>
        {stats.versionFail > 0 && <div className="stat-chip danger">版本异常 {stats.versionFail}</div>}
      </div>

      <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
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
        <div className="filter-item">
          <label>结果：</label>
          <select value={filters.success} onChange={(e) => { setFilters(f => ({ ...f, success: e.target.value })); setPage(1); }}>
            <option value="">全部</option>
            <option value="true">成功</option>
            <option value="false">失败</option>
          </select>
        </div>
        <div className="filter-item">
          <label>失败类型：</label>
          <select value={filters.failureType} onChange={(e) => { setFilters(f => ({ ...f, failureType: e.target.value })); setPage(1); }}>
            <option value="">全部</option>
            {Object.entries(FAILURE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <label>批量：</label>
          <select value={filters.batch} onChange={(e) => { setFilters(f => ({ ...f, batch: e.target.value })); setPage(1); }}>
            <option value="">全部</option>
            <option value="true">仅批量</option>
            <option value="false">仅单条</option>
          </select>
        </div>
        <div className="spacer" />
        <button onClick={() => { setFilters({ orderId: '', operator: '', action: '', success: '', failureType: '', batch: '' }); setPage(1); }}>重置</button>
      </div>

      <div className="table-wrap">
        <table className="audit-table" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ width: 160 }}>时间</th>
              <th style={{ width: 110 }}>操作人 / 角色</th>
              <th style={{ width: 110 }}>动作 / 批量</th>
              <th style={{ width: 110 }}>结果 / 类型</th>
              <th style={{ width: 130 }}>状态变更</th>
              <th style={{ width: 120 }}>版本（期望→当前→后）</th>
              <th style={{ width: 130 }}>单据</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="8" className="empty">加载中...</td></tr>
            )}
            {!loading && result.data.length === 0 && (
              <tr><td colSpan="8" className="empty">暂无日志</td></tr>
            )}
            {!loading && result.data.map(l => {
              const ft = l.failureType ? FAILURE_TYPE_LABELS[l.failureType] : null;
              const vst = l.versionSubtype ? VERSION_SUBTYPE_LABELS[l.versionSubtype] : null;
              return (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{formatTime(l.createdAt)}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{l.operator || '-'}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{roleLabelMap[l.operatorRole] || l.operatorRole || '-'}</div>
                  </td>
                  <td>
                    <div>
                      <span className="tag gray" style={{ fontSize: 11 }}>{actionLabelMap[l.action] || l.actionName || l.action}</span>
                    </div>
                    {l.batch && <div style={{ marginTop: 3 }}><span className="tag blue" style={{ fontSize: 10 }}>📦 批量</span></div>}
                  </td>
                  <td>
                    {l.success !== false ? (
                      <span className={tagClass('success')} style={{ fontSize: 11 }}>✅ 成功</span>
                    ) : (
                      <>
                        <div>
                          <span className={tagClass('danger')} style={{ fontSize: 11 }}>❌ 失败</span>
                        </div>
                        {ft && (
                          <div style={{ marginTop: 3 }}>
                            <span className={tagClass(ft.color)} style={{ fontSize: 10 }}>{ft.label}</span>
                          </div>
                        )}
                        {vst && !ft && (
                          <div style={{ marginTop: 3 }}>
                            <span className={tagClass('warning')} style={{ fontSize: 10 }}>{vst}</span>
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td style={{ fontSize: 11 }}>
                    {l.oldStatus || l.newStatus ? (
                      <>
                        <div>
                          {l.oldStatus
                            ? <span className={`tag ${l.oldStatus === l.newStatus ? 'gray' : 'orange'}`} style={{ fontSize: 10 }}>{statusLabelMap[l.oldStatus] || l.oldStatus}</span>
                            : <span style={{ color: 'var(--gray-400)' }}>-</span>}
                          <span style={{ margin: '0 4px', color: 'var(--gray-400)' }}>→</span>
                          {l.newStatus
                            ? <span className={`tag ${l.oldStatus === l.newStatus ? 'gray' : 'green'}`} style={{ fontSize: 10 }}>{statusLabelMap[l.newStatus] || l.newStatus}</span>
                            : <span style={{ color: 'var(--gray-400)' }}>-</span>}
                        </div>
                      </>
                    ) : <span style={{ color: 'var(--gray-400)' }}>-</span>}
                  </td>
                  <td style={{ fontSize: 11, fontFamily: 'monospace' }}>
                    {(l.expectedVersion !== null && l.expectedVersion !== undefined) || l.currentVersion !== null || l.versionAfter !== null ? (
                      <>
                        <div>
                          <span style={{ color: l.failureType && l.failureType.startsWith('version') ? 'var(--danger)' : 'var(--gray-600)' }}>
                            {l.expectedVersion !== null && l.expectedVersion !== undefined ? `v${l.expectedVersion}` : '-'}
                          </span>
                          <span style={{ color: 'var(--gray-400)', margin: '0 2px' }}>→</span>
                          <span>{l.currentVersion !== null && l.currentVersion !== undefined ? `v${l.currentVersion}` : '-'}</span>
                        </div>
                        {l.versionAfter !== null && l.versionAfter !== undefined && (
                          <div style={{ color: 'var(--success)', marginTop: 2 }}>→后 v{l.versionAfter}</div>
                        )}
                      </>
                    ) : <span style={{ color: 'var(--gray-400)' }}>-</span>}
                  </td>
                  <td>
                    {l.orderNo && (
                      <a onClick={() => navigate('detail', { id: l.orderId })} style={{ fontWeight: 500 }}>
                        {l.orderNo}
                      </a>
                    )}
                    {!l.orderNo && <span style={{ color: 'var(--gray-400)' }}>-</span>}
                  </td>
                  <td style={{ lineHeight: 1.6, color: 'var(--gray-700)' }}>
                    <div>{l.details}</div>
                    {l.failureReason && l.failureReason !== l.details && (
                      <div style={{ marginTop: 3, color: 'var(--danger)', fontSize: 11 }}>
                        💬 {l.failureReason}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
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
