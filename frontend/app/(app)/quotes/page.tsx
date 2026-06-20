'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, formatDateTime, formatMoney, getCurrentUser } from '@/lib/api';
import { STATUS_COLORS } from '@/types';
import type { RepairQuote } from '@/types';

const STATUS_OPTIONS: { code: string; name: string }[] = [
  { code: 'all', name: '全部状态' },
  { code: 'draft', name: '草稿' },
  { code: 'pending_quote', name: '待报价' },
  { code: 'quoted', name: '已报价待确认' },
  { code: 'confirmed', name: '客户已确认' },
  { code: 'customer_paid', name: '客户已支付' },
  { code: 'repairing', name: '维修中' },
  { code: 'returned', name: '已退回' },
  { code: 'completed', name: '已完成归档' },
  { code: 'cancelled', name: '已取消' },
];

const SHIFT_OPTIONS = [
  { code: 'all', name: '全部班次' },
  { code: 'morning', name: '白班' },
  { code: 'afternoon', name: '中班' },
  { code: 'night', name: '夜班' },
];

export default function QuotesListPage() {
  const router = useRouter();
  const user = getCurrentUser();
  const [list, setList] = useState<RepairQuote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filters, setFilters] = useState({ status: 'all', keyword: '', myOnly: false, shift: 'all' });
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingIncoming, setPendingIncoming] = useState<number>(0);

  const canCreate = user?.role === 'customer_service' || user?.role === 'service_manager';

  const loadHandovers = useCallback(async () => {
    const r = await apiFetch<any>('/api/handovers/mine?status=pending');
    if (r.ok) {
      const hs = (r.data.handovers || []).filter((h: any) => h.is_incoming && h.status === 'pending');
      setPendingIncoming(hs.length);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page), page_size: String(pageSize),
      status: filters.status, keyword: filters.keyword,
      my_only: filters.myOnly ? 'true' : 'false', shift: filters.shift,
    });
    const [listRes, statsRes] = await Promise.all([
      apiFetch<any>(`/api/quotes?${params}`),
      apiFetch<any>(`/api/statistics`),
    ]);
    if (listRes.ok) { setList(listRes.data.list || []); setTotal(listRes.data.total || 0); }
    if (statsRes.ok) { setStats(statsRes.data || {}); }
    setLoading(false);
  }, [page, pageSize, filters]);

  useEffect(() => { load(); loadHandovers(); }, [load, loadHandovers]);

  useEffect(() => {
    const handler = () => { loadHandovers(); load(); };
    window.addEventListener('handover-updated', handler);
    window.addEventListener('quote-updated', handler);
    return () => {
      window.removeEventListener('handover-updated', handler);
      window.removeEventListener('quote-updated', handler);
    };
  }, [load, loadHandovers]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">维修报价单列表</h1>
          <p className="text-sm text-gray-500 mt-1">共 <b className="text-gray-800">{total}</b> 条记录，以后端数据库状态为准，刷新页面不会造成数据不一致</p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>＋ 登记维修报价单</button>
        )}
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {pendingIncoming > 0 && (
        <div className="alert bg-orange-50 border-orange-300 text-orange-800 mb-4 flex items-center justify-between">
          <span>
            🔔 你有 <b>{pendingIncoming}</b> 条待接收的交接，确认后你将成为新的处理人。
          </span>
          <Link href="/handovers" className="btn btn-sm btn-primary ml-4">前往交接中心批量处理 →</Link>
        </div>
      )}

      <div className="grid grid-cols-8 gap-3 mb-4">
        <StatCard label="进行中" value={stats.summary?.active || 0} color="blue" />
        <StatCard label="待报价" value={stats.summary?.pending_quote || 0} color="yellow" />
        <StatCard label="待客户确认" value={stats.summary?.to_confirm || 0} color="indigo" />
        <StatCard label="待客户支付" value={stats.summary?.to_pay || 0} color="emerald" />
        <StatCard label="维修中" value={stats.summary?.repairing || 0} color="purple" />
        <StatCard label="已退回" value={stats.summary?.returned || 0} color="red" />
        <StatCard label="已归档完成" value={stats.summary?.completed || 0} color="green" />
        <StatCard label="待交接确认" value={stats.summary?.pending_handovers || 0} color="orange" />
      </div>

      <div className="card p-4 mb-4">
        <div className="grid grid-cols-4 gap-3 items-end">
          <div>
            <label className="label">状态</label>
            <select className="select" value={filters.status} onChange={e => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}>
              {STATUS_OPTIONS.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">所属班次</label>
            <select className="select" value={filters.shift} onChange={e => { setFilters({ ...filters, shift: e.target.value }); setPage(1); }}>
              {SHIFT_OPTIONS.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">关键字搜索</label>
            <input className="input" placeholder="单号/客户/电话/设备" value={filters.keyword}
              onChange={e => { setFilters({ ...filters, keyword: e.target.value }); setPage(1); }} />
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={filters.myOnly} onChange={e => { setFilters({ ...filters, myOnly: e.target.checked }); setPage(1); }} />
              仅看我负责的
            </label>
            <button className="btn btn-secondary btn-sm" onClick={() => { setFilters({ status: 'all', keyword: '', myOnly: false, shift: 'all' }); setPage(1); }}>重置</button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>报价单号</th>
              <th>客户信息</th>
              <th>设备</th>
              <th>状态</th>
              <th>金额</th>
              <th>当前处理人</th>
              <th>班次</th>
              <th>交接次数</th>
              <th>最近更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={10} className="text-center text-gray-400 py-10">
                {loading ? '加载中...' : '暂无数据'}
              </td></tr>
            )}
            {list.map(q => (
              <tr key={q.id}>
                <td className="font-mono text-xs text-blue-700">{q.quote_no}</td>
                <td>
                  <div className="font-medium">{q.customer_name}</div>
                  <div className="text-xs text-gray-500">{q.customer_phone}</div>
                </td>
                <td>
                  <div>{q.device_type}</div>
                  <div className="text-xs text-gray-500">{q.device_model || '-'}</div>
                </td>
                <td>
                  <span className={`tag border ${STATUS_COLORS[q.status] || ''}`}>{q.status_display}</span>
                </td>
                <td>
                  <div className="font-semibold">{formatMoney(q.estimate_amount || q.actual_amount)}</div>
                  <div className="text-xs text-gray-500">
                    {q.payment_status === 'paid' ? <span className="text-emerald-600">已支付</span> : <span className="text-amber-600">{q.payment_status === 'unpaid' ? '未支付' : q.payment_status}</span>}
                  </div>
                </td>
                <td>
                  <div>{q.current_handler || '-'}</div>
                  {q.assigned_technician && <div className="text-xs text-orange-600">维修师傅: {q.assigned_technician}</div>}
                </td>
                <td className="text-xs">{q.shift_display}</td>
                <td className="text-center">
                  {q.handover_count > 0 ? <span className="tag bg-orange-50 text-orange-700 border-orange-200">×{q.handover_count}</span> : '0'}
                </td>
                <td className="text-xs text-gray-500">{formatDateTime(q.updated_at)}</td>
                <td>
                  <Link href={`/quotes/${q.id}`} className="btn btn-primary btn-xs">查看详情</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > pageSize && (
          <div className="pagination px-4">
            <span className="text-xs text-gray-500 mr-2">第 {page}/{totalPages} 页</span>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p = i + 1;
              if (totalPages > 5 && page > 3) p = page - 2 + i;
              if (p > totalPages) return null;
              return <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>;
            })}
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</button>
          </div>
        )}
      </div>

      {showCreate && <CreateQuoteModal onClose={() => setShowCreate(false)}
        onCreated={() => { setMessage({ type: 'success', text: '报价单已登记，稍后可在列表查看' }); setShowCreate(false); setTimeout(() => setMessage(null), 3000); load(); }} />}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const bg: Record<string, string> = {
    blue: 'from-blue-50 to-blue-100 border-blue-200', yellow: 'from-yellow-50 to-yellow-100 border-yellow-200',
    indigo: 'from-indigo-50 to-indigo-100 border-indigo-200', emerald: 'from-emerald-50 to-emerald-100 border-emerald-200',
    purple: 'from-purple-50 to-purple-100 border-purple-200', red: 'from-red-50 to-red-100 border-red-200',
    green: 'from-green-50 to-green-100 border-green-200', orange: 'from-orange-50 to-orange-100 border-orange-200',
  };
  const numColor: Record<string, string> = {
    blue: 'text-blue-700', yellow: 'text-yellow-700', indigo: 'text-indigo-700', emerald: 'text-emerald-700',
    purple: 'text-purple-700', red: 'text-red-700', green: 'text-green-700', orange: 'text-orange-700',
  };
  return (
    <div className={`stat-card bg-gradient-to-br ${bg[color]}`}>
      <div className="label">{label}</div>
      <div className={`num ${numColor[color]}`}>{value}</div>
    </div>
  );
}

function CreateQuoteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', device_type: '', device_model: '', fault_description: '', estimate_amount: 0 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!form.customer_name || !form.customer_phone || !form.device_type) {
      setErr('客户姓名、联系电话、设备类型为必填项');
      return;
    }
    setLoading(true);
    const r = await apiFetch('/api/quotes', { method: 'POST', body: JSON.stringify(form) });
    setLoading(false);
    if (!r.ok) { setErr(r.error || '创建失败'); return; }
    onCreated();
  };

  return (
    <div className="modal-mask" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span>登记维修报价单</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">×</button>
        </div>
        <div className="modal-body space-y-3">
          {err && <div className="alert alert-error">{err}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">客户姓名 *</label><input className="input" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></div>
            <div><label className="label">联系电话 *</label><input className="input" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">设备类型 *</label>
              <select className="select" value={form.device_type} onChange={e => setForm({ ...form, device_type: e.target.value })}>
                <option value="">请选择</option>
                {['空调', '冰箱', '洗衣机', '热水器', '电视机', '油烟机', '微波炉', '燃气灶', '净水器', '干衣机', '其他'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div><label className="label">设备型号</label><input className="input" value={form.device_model} onChange={e => setForm({ ...form, device_model: e.target.value })} /></div>
          </div>
          <div><label className="label">故障描述</label><textarea className="textarea" value={form.fault_description} onChange={e => setForm({ ...form, fault_description: e.target.value })} /></div>
          <div><label className="label">预估金额（元，可暂填0稍后由调度填写）</label>
            <input type="number" className="input" value={form.estimate_amount} onChange={e => setForm({ ...form, estimate_amount: Number(e.target.value) })} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" disabled={loading} onClick={submit}>{loading ? '提交中...' : '登 记'}</button>
        </div>
      </div>
    </div>
  );
}
