'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { getAuditLogs, getUsers, getCurrentUser } from '../lib/api';
import { AuditLog, actionLabels, roleLabels, statusLabels } from '../types';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    operator: '',
    action: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  async function loadData() {
    setLoading(true);
    try {
      const [logsRes, usersRes] = await Promise.all([
        getAuditLogs(filters),
        getUsers(),
      ]);
      if (logsRes.success) {
        setLogs(logsRes.data);
      }
      if (usersRes.success) {
        setUsers(usersRes.data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }

  const actions = [
    { value: 'CREATE', label: '创建入驻单' },
    { value: 'SUBMIT', label: '提交审核' },
    { value: 'START_REVIEW', label: '开始审核' },
    { value: 'REQUEST_MATERIALS', label: '退回补正' },
    { value: 'RESUBMIT', label: '补正后重提' },
    { value: 'APPROVE_QUALIFICATION', label: '资质审核通过' },
    { value: 'REJECT', label: '驳回申请' },
    { value: 'OPEN_STORE', label: '开通店铺' },
    { value: 'ARCHIVE', label: '复核归档' },
    { value: 'ADD_ATTACHMENT', label: '上传附件' },
    { value: 'REMOVE_ATTACHMENT', label: '删除附件' },
    { value: 'ADD_AUDIT_NOTE', label: '添加审计备注' },
  ];

  return (
    <div>
      <Header />
      <main className="main-content">
        <div className="container">
          <div className="breadcrumb">
            <Link href="/">待处理队列</Link>
            <span className="separator">/</span>
            <span>审计日志</span>
          </div>

          <div className="filter-bar">
            <div className="filter-item">
              <label>操作人：</label>
              <select
                value={filters.operator}
                onChange={(e) => setFilters({ ...filters, operator: e.target.value })}
              >
                <option value="">全部</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-item">
              <label>操作类型：</label>
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              >
                <option value="">全部</option>
                {actions.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>

            <div className="filter-item">
              <label>开始日期：</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>

            <div className="filter-item">
              <label>结束日期：</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>

            <button className="btn btn-secondary" onClick={loadData}>
              查询
            </button>
          </div>

          <div className="queue-header">
            <div className="queue-title">审计日志</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>
              共 {logs.length} 条记录
            </div>
          </div>

          {loading ? (
            <div className="empty-state">加载中...</div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div>暂无审计日志</div>
            </div>
          ) : (
            <div className="queue-table">
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>操作人</th>
                    <th>角色</th>
                    <th>操作类型</th>
                    <th>商家入驻单</th>
                    <th>状态变更</th>
                    <th>原因/备注</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td>{log.operatorName}</td>
                      <td>{log.operatorRoleLabel}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          fontSize: '12px',
                        }}>
                          {log.actionLabel}
                        </span>
                      </td>
                      <td>{log.formId.substring(0, 8)}...</td>
                      <td>
                        {log.oldStatusLabel && log.newStatusLabel ? (
                          <span style={{ fontSize: '12px' }}>
                            {log.oldStatusLabel} → {log.newStatusLabel}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.reason || log.remark || '-'}
                      </td>
                      <td>
                        <Link
                          href={`/forms/${log.formId}`}
                          className="btn btn-primary"
                          style={{ padding: '4px 12px', fontSize: '12px' }}
                        >
                          查看
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
