'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch, formatDateTime, getCurrentUser } from '@/lib/api';

interface Handover {
  id: number;
  quote_id: number;
  quote_no: string;
  customer_name: string;
  device_type: string;
  is_incoming: boolean;
  quote_status: string;
  quote_status_name: string;
  status: string;
  status_name: string;
  from: { user_name: string; role: string; shift: string };
  to: { user_name: string; role: string; shift: string };
  handover_remark: string;
  created_at: string;
  confirmed_at: string | null;
}

interface BatchResult {
  handover_id: number;
  quote_id: number;
  quote_no: string;
  success: boolean;
  action: string;
  message: string;
  new_handler?: string;
  new_shift?: string;
}

export default function HandoversPage() {
  const user = getCurrentUser();
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('incoming');
  const [status, setStatus] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('pending');
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showBatchConfirm, setShowBatchConfirm] = useState<null | { action: 'confirm' | 'reject' }>(null);
  const [showBatchResult, setShowBatchResult] = useState<{
    total: number; success_count: number; fail_count: number; results: BatchResult[];
  } | null>(null);
  const [batchRemark, setBatchRemark] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);

  const load = useCallback(async (s = status) => {
    const r = await apiFetch<any>(`/api/handovers/mine?status=${s === 'all' ? '' : s}`);
    if (r.ok) setHandovers(r.data.handovers || []);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setSelected(new Set());
  }, [filter, status]);

  const showMsg = (t: string, text: string) => {
    setMessage({ type: t, text });
    setTimeout(() => setMessage(null), 3500);
  };

  const filtered = handovers.filter(h => {
    if (filter === 'incoming') return h.is_incoming;
    if (filter === 'outgoing') return !h.is_incoming;
    return true;
  });

  const pendingIncoming = filtered.filter(h => h.is_incoming && h.status === 'pending');
  const canSelect = (h: Handover) => h.is_incoming && h.status === 'pending';

  const toggleSelect = (id: number) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };

  const selectAll = () => {
    if (selected.size === pendingIncoming.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingIncoming.map(h => h.id)));
    }
  };

  const handleConfirm = async (hid: number, accept: boolean) => {
    const remark = accept ? '' : (prompt('请填写拒绝原因') || '');
    if (!accept && !remark) { showMsg('error', '拒绝原因必填'); return; }
    const r = await apiFetch(`/api/handovers/${hid}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ action: accept ? 'confirm' : 'reject', remark }),
    });
    if (!r.ok) { showMsg('error', r.error || '操作失败'); return; }
    showMsg('success', accept ? '交接已接收，你成为新的处理人' : '已拒绝交接');
    load();
    // 通知父组件刷新侧边栏
    window.dispatchEvent(new CustomEvent('handover-updated'));
  };

  const executeBatch = async () => {
    if (!showBatchConfirm) return;
    const action = showBatchConfirm.action;
    if (action === 'reject' && !batchRemark.trim()) {
      showMsg('error', '批量拒绝必须填写原因');
      return;
    }
    if (selected.size === 0) {
      showMsg('error', '请先勾选待处理的交接');
      return;
    }

    setBatchLoading(true);
    const items = Array.from(selected).map(hid => ({
      handover_id: hid,
      action,
      remark: action === 'reject' ? batchRemark : batchRemark || '批量接收',
    }));

    const r = await apiFetch('/api/handovers/batch-confirm', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });

    setBatchLoading(false);
    if (!r.ok) {
      showMsg('error', r.error || '批量处理失败');
      setShowBatchConfirm(null);
      return;
    }

    setShowBatchConfirm(null);
    setSelected(new Set());
    setShowBatchResult(r.data);
    load();
    window.dispatchEvent(new CustomEvent('handover-updated'));
  };

  const pendingCount = handovers.filter(h => h.status === 'pending').length;
  const incPending = handovers.filter(h => h.status === 'pending' && h.is_incoming).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">🔁 换班交接中心</h1>
          <p className="text-sm text-gray-500 mt-1">以后端数据库为准，谁交出、谁接收、哪个班次，全流程可追溯。确认接收后报价单的处理人、班次同步更新到列表和详情。支持批量勾选处理。</p>
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
        <div className="flex-1" />
        {selected.size > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
            <span className="text-sm text-blue-700 font-medium">已选 {selected.size} 条</span>
            <button className="btn btn-success btn-sm" onClick={() => { setBatchRemark(''); setShowBatchConfirm({ action: 'confirm' }); }}>
              ✓ 批量接收
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => { setBatchRemark(''); setShowBatchConfirm({ action: 'reject' }); }}>
              ✗ 批量拒绝
            </button>
            <button className="btn btn-secondary btn-xs" onClick={() => setSelected(new Set())}>
              清空
            </button>
          </div>
        )}
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
                <th style={{ width: 38 }}>
                  {filter === 'incoming' && status === 'pending' && (
                    <input type="checkbox"
                      checked={selected.size > 0 && selected.size === pendingIncoming.length}
                      onChange={selectAll} />
                  )}
                </th>
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
              {filtered.map(h => {
                const selectable = canSelect(h);
                const isSelected = selected.has(h.id);
                return (
                  <tr key={h.id} className={isSelected ? 'bg-blue-50' : ''}>
                    <td>
                      {selectable ? (
                        <input type="checkbox" checked={isSelected}
                          onChange={() => toggleSelect(h.id)} />
                      ) : null}
                    </td>
                    <td>
                      <Link href={`/quotes/${h.quote_id}`} className="text-blue-700 hover:underline">
                        <div className="font-mono text-xs">{h.quote_no}</div>
                        <div className="text-xs">{h.customer_name} - {h.device_type}</div>
                      </Link>
                    </td>
                    <td>
                      {h.is_incoming
                        ? <span className="tag bg-green-50 text-green-700 border-green-200">→ 收到</span>
                        : <span className="tag bg-blue-50 text-blue-700 border-blue-200">发出 →</span>}
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
                      {h.status === 'pending' && h.is_incoming && user && h.to.user_name === getCurrentUser()?.real_name ? (
                        <div className="flex gap-1">
                          <button className="btn btn-success btn-xs" onClick={() => handleConfirm(h.id, true)}>确认接收</button>
                          <button className="btn btn-danger btn-xs" onClick={() => handleConfirm(h.id, false)}>拒绝</button>
                        </div>
                      ) : <Link href={`/quotes/${h.quote_id}`} className="btn btn-xs btn-secondary">查看详情</Link>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showBatchConfirm && (
        <div className="modal-mask" onClick={e => e.target === e.currentTarget && setShowBatchConfirm(null)}>
          <div className="modal">
            <div className="modal-header">
              <span>{showBatchConfirm.action === 'confirm' ? '批量确认接收' : '批量拒绝交接'}</span>
              <button className="text-gray-400 hover:text-gray-700 text-lg leading-none" onClick={() => setShowBatchConfirm(null)}>×</button>
            </div>
            <div className="modal-body space-y-3">
              <div className="alert alert-info">
                已选择 <b>{selected.size}</b> 条交接记录{showBatchConfirm.action === 'confirm' ? '批量接收' : '批量拒绝'}
              </div>
              <div>
                <label className="label">{showBatchConfirm.action === 'confirm' ? '批量备注（可选）' : '拒绝原因 *'}</label>
                <textarea className="textarea" value={batchRemark} onChange={e => setBatchRemark(e.target.value)}
                  placeholder={showBatchConfirm.action === 'confirm' ? '如：已了解情况，后续跟进' : '请详细说明拒绝原因'} />
              </div>
              <div className="text-xs text-gray-500">
                提示：每条交接记录后端都会独立校验权限和状态，成功/失败会逐条返回结果。
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBatchConfirm(null)}>取消</button>
              <button className={`btn ${showBatchConfirm.action === 'confirm' ? 'btn-success' : 'btn-danger'}`}
                disabled={batchLoading} onClick={executeBatch}>
                {batchLoading ? '处理中...' : `确认${showBatchConfirm.action === 'confirm' ? '接收' : '拒绝'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchResult && (
        <div className="modal-mask" onClick={e => e.target === e.currentTarget && setShowBatchResult(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span>批量处理结果</span>
              <button className="text-gray-400 hover:text-gray-700 text-lg leading-none" onClick={() => setShowBatchResult(null)}>×</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-700">{showBatchResult.total}</div>
                  <div className="text-xs text-blue-600">处理总数</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{showBatchResult.success_count}</div>
                  <div className="text-xs text-green-600">成功</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-700">{showBatchResult.fail_count}</div>
                  <div className="text-xs text-red-600">失败</div>
                </div>
              </div>

              <div>
                <div className="font-semibold text-sm text-gray-700 mb-2">逐条明细：</div>
                <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="data-table" style={{ fontSize: 12 }}>
                    <thead className="sticky top-0 bg-white">
                      <tr>
                        <th>结果</th>
                        <th>交接ID</th>
                        <th>报价单号</th>
                        <th>操作</th>
                        <th>说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {showBatchResult.results.map((res, i) => (
                        <tr key={i}>
                          <td style={{ width: 32 }}>
                            <span className={res.success ? 'text-green-600' : 'text-red-600'}>
                              {res.success ? '✅' : '❌'}
                            </span>
                          </td>
                          <td className="font-mono">{res.handover_id}</td>
                          <td className="font-mono text-blue-700">{res.quote_no}</td>
                          <td>
                            {res.action === 'confirm' ? '接收' : '拒绝'}
                            {res.new_handler && <div className="text-xs text-gray-500">处理人: {res.new_handler}</div>}
                            {res.new_shift && <div className="text-xs text-gray-500">班次: {res.new_shift}</div>}
                          </td>
                          <td className={!res.success ? 'text-red-600' : ''}>{res.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                注意：已成功处理的交接，报价单列表、详情页、统计数据均已自动同步更新，刷新即可看到最新状态。
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => { setShowBatchResult(null); load(); }}>好的，我知道了</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
