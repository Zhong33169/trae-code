import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { ROLE_LABELS, STATUS_LABELS } from '../lib/types';

export default function AuditLogList() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('');

  useEffect(() => {
    loadLogs();
  }, [userFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (userFilter) params.user = userFilter;
      const data = await api.getAllAuditLogs(params);
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const roleColors: Record<string, string> = {
    admission: '#10b981',
    academic: '#3b82f6',
    admin: '#8b5cf6',
  };

  return (
    <div className="audit-page">
      <div className="page-header">
        <h2 className="page-title">审计日志</h2>
        <div className="filter-bar">
          <input
            type="text"
            placeholder="搜索操作人..."
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作人</th>
                <th>角色</th>
                <th>操作</th>
                <th>报名单</th>
                <th>状态变化</th>
                <th>原因/备注</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">暂无数据</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td className="user-cell">
                      <span
                        className="user-dot"
                        style={{ background: roleColors[log.user_role] }}
                      ></span>
                      {log.user_name}
                    </td>
                    <td>
                      <span
                        className="role-badge"
                        style={{
                          background: (roleColors[log.user_role] || '#6b7280') + '20',
                          color: roleColors[log.user_role] || '#6b7280',
                        }}
                      >
                        {ROLE_LABELS[log.user_role] || log.user_role}
                      </span>
                    </td>
                    <td className="action-cell">{log.action}</td>
                    <td>#{log.enrollment_id}</td>
                    <td>
                      {log.from_status && log.to_status ? (
                        <>
                          {STATUS_LABELS[log.from_status as keyof typeof STATUS_LABELS] || log.from_status}
                          {' → '}
                          {STATUS_LABELS[log.to_status as keyof typeof STATUS_LABELS] || log.to_status}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="reason-cell">{log.reason || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .audit-page {
          padding: 24px;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .page-title {
          font-size: 24px;
          font-weight: 600;
          color: #1f2937;
          margin: 0;
        }
        .search-input {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          width: 200px;
          font-size: 14px;
        }
        .table-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        .data-table th {
          background: #f9fafb;
          padding: 12px 16px;
          text-align: left;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
        }
        .data-table td {
          padding: 12px 16px;
          font-size: 14px;
          color: #374151;
          border-bottom: 1px solid #f3f4f6;
        }
        .data-table tr:hover { background: #f9fafb; }
        .user-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .user-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .role-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 12px;
        }
        .action-cell {
          font-weight: 500;
          color: #1f2937;
        }
        .reason-cell {
          color: #6b7280;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .empty {
          text-align: center;
          padding: 40px;
          color: #9ca3af;
        }
        .loading {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}
