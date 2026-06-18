import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFailuresOnly, setShowFailuresOnly] = useState(false);

  const loadData = () => {
    setLoading(true);
    const req = showFailuresOnly ? api.getAuditFailures() : api.getAuditLogs();
    req
      .then(data => setLogs(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [showFailuresOnly]);

  if (loading) return <div>加载中...</div>;

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 className="section-title">审计日志</h2>
          <div className="actions">
            <button 
              className={`btn ${showFailuresOnly ? 'btn-warning' : 'btn-outline'}`}
              onClick={() => setShowFailuresOnly(!showFailuresOnly)}
            >
              {showFailuresOnly ? '显示全部' : '仅显示失败'}
            </button>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="empty-state">
            <p>暂无审计日志</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作人</th>
                <th>角色</th>
                <th>操作</th>
                <th>关联申请</th>
                <th>详情</th>
                <th>失败原因</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className={l.has_failure ? 'row-abnormal' : ''}>
                  <td>{l.created_at}</td>
                  <td>{l.user_name}</td>
                  <td>{l.user_role_name}</td>
                  <td>{l.action_name}</td>
                  <td>
                    {l.application_id ? (
                      <Link to={`/applications/${l.application_id}`} className="link">
                        {l.application_id}
                      </Link>
                    ) : '-'}
                    {l.batch_no && <div style={{ fontSize: 12, color: '#64748b' }}>批次: {l.batch_no}</div>}
                  </td>
                  <td>{l.details || '-'}</td>
                  <td>
                    {l.failure_reason ? (
                      <div className="failure-detail">{l.failure_reason}</div>
                    ) : (
                      <span style={{ color: '#16a34a', fontSize: 13 }}>✓</span>
                    )}
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

export default AuditLogs;
