import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { toast } from './Toast.jsx';
import { getStatusText } from '../utils/format';

export default function LogsApp() {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api.operationLogs({ page, pageSize });
    setLoading(false);
    if (r.ok && r.data.code === 0) {
      setList(r.data.data.list);
      setTotal(r.data.data.total);
    } else {
      toast(r.data.message || '加载失败', 'error');
    }
  }, [page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="card">
      <div className="card-title">全量操作记录（共 {total} 条）</div>
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 180 }}>时间</th>
            <th style={{ width: 120 }}>操作人</th>
            <th>操作内容</th>
            <th style={{ width: 200 }}>状态变更</th>
            <th style={{ width: 120 }}>关联计划</th>
          </tr>
        </thead>
        <tbody>
          {loading && list.length === 0 && (
            <tr><td colSpan="5" className="empty">加载中...</td></tr>
          )}
          {!loading && list.length === 0 && (
            <tr><td colSpan="5" className="empty">暂无数据</td></tr>
          )}
          {list.map(l => (
            <tr key={l.id}>
              <td style={{ color: '#909399', fontSize: 12 }}>{l.created_at}</td>
              <td>{l.user_name}</td>
              <td>{l.action_desc}</td>
              <td>
                {l.old_status && l.new_status ? (
                  <span style={{ color: '#606266' }}>
                    {getStatusText(l.old_status)} → <b style={{ color: '#409eff' }}>{getStatusText(l.new_status)}</b>
                  </span>
                ) : (
                  <span style={{ color: '#909399' }}>-</span>
                )}
              </td>
              <td>
                {l.schedule_id ? (
                  <a href={`/detail/${l.schedule_id}`} style={{ fontSize: 12 }}>查看 #{l.schedule_id}</a>
                ) : (
                  <span style={{ color: '#909399' }}>-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination">
        <span className="pagination-info">第 {page} / {totalPages} 页</span>
        <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>上一页</button>
        <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>下一页</button>
      </div>
    </div>
  );
}
