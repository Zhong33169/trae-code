'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, formatDateTime, getCurrentUser } from '@/lib/api';

export default function HandoversPage() {
  const user = getCurrentUser();
  const [handovers, setHandovers] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [status, setStatus] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('all');
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const load = async (s = status) => {
    const r = await apiFetch<any>(`/api/handovers/mine?status=${s === 'all' ? '' : s}`);
    if (r.ok) setHandovers(r.data.handovers || []);
  };

  useEffect(() => { load(); }, [status]);

  const showMsg = (t: string, text: string) => { setMessage({ type: t, text }); setTimeout(() => setMessage(null), 3000); };

  const handleConfirm = async (hid: number, accept: boolean) => {
    const remark = accept ? '' : (prompt('请填写拒绝原因') || '');
    if (!accept && !remark) { showMsg('error', '拒绝原因必填'); return; }
    const r = await apiFetch(`/api/handovers/${hid}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ action: accept ? 'confirm' : 'reject', remark }),
    });
    if (!r.ok) { showMsg('error', r.error || '操作失败'); return; }
    showMsg('success', accept ? '已确认接收，你已成为新的处理人（刷新列表与详情均已同步）' : '已拒绝交接');
    load();
  };

  const filtered = handovers.filter(h => {
    if (filter === 'incoming') return h.is_incoming;
    if (filter === 'outgoing') return !h.is_incoming;
    return true;
  });

  const pendingCount = handovers.filter(h => h.status === 'pending').length;
  const incPending = handovers.filter(h => h.status === 'pending' && h.is_incoming).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">🔁 换班交接中心</h1>
          <p className="text-sm text-gray-500 mt-1">以后端数据库为准，谁交出、谁接收、哪个班次，全流程可追溯。确认接收后报价单的处理人、班次同步更新到列表和详情。</p>
        </div>
        <Link href="/quotes" className="btn btn-secondary">查看报价单列表 →</Link>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="stat-card">
          <div className="label">待处理交接</div>
          <div className="num text-orange-600">{pendingCount}</div>
        </div>
        <div className="stat-card">
          <div className="label">需要我确认</div>
          <div className="num text-red-600">{incPending}</div>
        </div>
        <div className="stat-card">
          <div className="label">已完成接收</div>
          <div className="num text-green-600">{handovers.filter(h => h.status === 'confirmed').length}</div>
        </div>
        <div className="stat-card">
          <div className="label">累计交接次数</div>
          <div className="num text-blue-700">{handovers.length}</div>
        </div>
      </div>

      <div className="card p-4 mb-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-600">方向:</span>
          {[['all', '全部'], ['incoming', '收 → 我'], ['outgoing', '我 → 发']].map(([k, n]) => (
            <button key={k} onClick={() => setFilter(k as any)}
              className={`btn btn-sm ${filter === k ? 'btn-primary' : 'btn-secondary'}`}>{n}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-600">状态:</span>
          {[['all', '全部'], ['pending', '待确认'], ['confirmed', '已接收'], ['rejected', '已拒绝']].map(([k, n]) => (
            <button key={k} onClick={() => setStatus(k as any)}
              className={`btn btn-sm ${status === k ? 'btn-primary' : 'btn-secondary'}`}>{n}</button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            暂无交接记录
            <div className="text-xs mt-1">在报价单详情页可以发起交接</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>报价单</th>
                <th>方向</th>
                <th>交出方</th>
                <th>接收方</th>
                <th>交接备注</th>
                <th>关联单状态</th>
                <th>状态</th>
                <th>发起时间</th>
                <th>确认时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(h => (
                <tr key={h.id}>
                  <td>
                    <Link href={`/quotes/${h.quote_id}`} className="text-blue-700 hover:underline">
                      <div className="font-mono text-xs">{h.quote_no}</div>
                      <div className="text-xs">{h.customer_name} - {h.device_type}</div>
                    </Link>
                  </td>
                  <td>
                    {h.is_incoming ? <span className="tag bg-green-50 text-green-700 border-green-200">→ 收到</span> : <span className="tag bg-blue-50 text-blue-700 border-blue-200">发出 →</span>}
                  </td>
                  <td>
                    <div className="font-medium">{h.from.user_name}</div>
                    <div className="text-xs text-gray-500">{h.from.role} · {h.from.shift}</div>
                  </td>
                  <td>
                    <div className="font-medium">{h.to.user_name}</div>
                    <div className="text-xs text-gray-500">{h.to.role} · {h.to.shift}</div>
                  </td>
                  <td className="text-xs max-w-[260px]"><div className="line-clamp-2">{h.handover_remark}</div></td>
                  <td><span className="text-xs">{h.quote_status_name}</span></td>
                  <td>
                    <span className={`tag border ${
                      h.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-300' :
                      h.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-300' :
                      'bg-yellow-50 text-yellow-700 border-yellow-300'
                    }`}>{h.status_name}</span>
                  </td>
                  <td className="text-xs">{formatDateTime(h.created_at)}</td>
                  <td className="text-xs">{h.confirmed_at ? formatDateTime(h.confirmed_at) : '-'}</td>
                  <td>
                    {h.status === 'pending' && h.is_incoming && user && h.to_user_id === user.id ? (
                      <div className="flex gap-1">
                        <button className="btn btn-success btn-xs" onClick={() => handleConfirm(h.id, true)}>确认接收</button>
                        <button className="btn btn-danger btn-xs" onClick={() => handleConfirm(h.id, false)}>拒绝</button>
                      </div>
                    ) : <Link href={`/quotes/${h.quote_id}`} className="btn btn-xs btn-secondary">查看详情</Link>}
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
