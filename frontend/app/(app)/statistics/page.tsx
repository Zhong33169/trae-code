'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, formatMoney } from '@/lib/api';

export default function StatisticsPage() {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<any>('/api/statistics').then(r => {
      if (r.ok) setData(r.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-10 text-center text-gray-500">加载统计中...</div>;

  const s = data.summary || {};
  const amt = data.amount || {};
  const ud = data.user_distribution || {};
  const statusBd = data.status_breakdown || [];
  const byHandler = data.active_by_handler || [];
  const byShift = data.active_by_shift || [];
  const byDevice = data.active_by_device || [];

  const maxCount = Math.max(1, ...statusBd.map((x: any) => x.count || 0));
  const maxHandler = Math.max(1, ...byHandler.map((x: any) => x.active_count || 0));
  const maxDevice = Math.max(1, ...byDevice.map((x: any) => x.count || 0));

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold">📊 统计分析</h1>
        <p className="text-sm text-gray-500 mt-1">所有统计均以后端 SQLite 数据库实时计算为准，与列表、详情数据一致，刷新页面数量相同。</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <BigStat label="报价单总数" value={s.total || 0} sub={`进行中 ${s.active} · 已完成 ${s.completed}`} />
        <BigStat label="累计报价金额" value={formatMoney(amt.total_estimate)} sub={`实际应收 ${formatMoney(amt.total_actual)}`} highlight />
        <BigStat label="已到账金额" value={formatMoney(amt.total_paid)} sub={`未收 ${formatMoney(amt.unpaid)}`} color="green" />
        <BigStat label="待交接确认" value={s.pending_handovers || 0} sub={`退回待处理 ${s.returned || 0}`} color="orange" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="card p-5">
          <div className="font-semibold mb-3 border-l-4 border-blue-500 pl-2">👥 人员配置</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <UserStat role="服务经理" count={ud.service_manager_count || 0} color="red" />
            <UserStat role="调度专员" count={ud.dispatcher_count || 0} color="blue" />
            <UserStat role="客服专员" count={ud.customer_service_count || 0} color="green" />
            <UserStat role="维修师傅" count={ud.technician_count || 0} color="orange" />
          </div>
        </div>
        <div className="card p-5">
          <div className="font-semibold mb-3 border-l-4 border-blue-500 pl-2">⏱️ 进行中按班次分布</div>
          {byShift.length === 0 ? <div className="text-gray-400 text-sm">暂无数据</div> :
            <div className="space-y-3 mt-2">
              {byShift.map((x: any) => (
                <div key={x.shift}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{x.name}</span>
                    <span className="text-gray-500">{x.count} 单</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(x.count / Math.max(1, byShift[0].count)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          }
        </div>
        <div className="card p-5">
          <div className="font-semibold mb-3 border-l-4 border-blue-500 pl-2">📈 处理中 TOP 维修师傅</div>
          {byHandler.length === 0 ? <div className="text-gray-400 text-sm">暂无数据</div> :
            <div className="space-y-2 mt-1">
              {byHandler.map((x: any, i: number) => (
                <div key={x.handler_id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">
                      <span className="inline-block w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-center leading-4 mr-1 text-[10px]">{i + 1}</span>
                      {x.handler_name}
                    </span>
                    <span className="text-gray-500">{x.active_count} 单</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full" style={{ width: `${(x.active_count / maxHandler) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          }
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 card p-5">
          <div className="font-semibold mb-4 border-l-4 border-blue-500 pl-2">🔎 各状态数量分布（与列表筛选计数一致）</div>
          <div className="space-y-3">
            {statusBd.map((x: any) => (
              <div key={x.code}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{x.name}</span>
                  <span className="text-gray-600"><b>{x.count}</b> 单 ({x.count > 0 ? ((x.count / (s.total || 1)) * 100).toFixed(1) : 0}%)</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${
                    ['bg-gray-300','bg-yellow-400','bg-blue-400','bg-indigo-400','bg-emerald-400','bg-purple-400','bg-red-400','bg-green-500','bg-gray-400']
                    [statusBd.indexOf(x)] || 'bg-blue-400'
                  }`} style={{ width: `${(x.count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100">
            <Link href="/quotes" className="text-sm text-blue-600 hover:underline">→ 根据状态筛选查看列表</Link>
          </div>
        </div>

        <div className="col-span-2 card p-5">
          <div className="font-semibold mb-4 border-l-4 border-blue-500 pl-2">📦 故障设备类型 TOP</div>
          {byDevice.length === 0 ? <div className="text-gray-400 text-sm">暂无数据</div> :
            <div className="space-y-3">
              {byDevice.map((x: any, i: number) => (
                <div key={x.device_type}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">
                      <span className="inline-block w-5 h-5 rounded bg-orange-100 text-orange-700 text-center leading-5 mr-1 text-[10px] font-bold">{i + 1}</span>
                      {x.device_type}
                    </span>
                    <span className="text-gray-500">{x.count} 单</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full" style={{ width: `${(x.count / maxDevice) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          }
        </div>
      </div>

      <div className="mt-5 grid grid-cols-8 gap-3">
        <StatCardMini label="草稿" value={s.draft || 0} />
        <StatCardMini label="待报价" value={s.pending_quote || 0} color="yellow" />
        <StatCardMini label="已报价待确认" value={s.to_confirm || 0} color="blue" />
        <StatCardMini label="客户已确认" value={s.to_pay || 0} color="indigo" />
        <StatCardMini label="维修中" value={s.repairing || 0} color="purple" />
        <StatCardMini label="已退回" value={s.returned || 0} color="red" />
        <StatCardMini label="已归档" value={s.completed || 0} color="green" />
        <StatCardMini label="已取消" value={s.cancelled || 0} />
      </div>
    </div>
  );
}

function BigStat({ label, value, sub, highlight, color }: { label: string; value: any; sub?: string; highlight?: boolean; color?: string }) {
  const bg = highlight ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white' :
    color === 'green' ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white' :
    color === 'orange' ? 'bg-gradient-to-br from-orange-500 to-amber-600 text-white' :
    'bg-white border border-gray-200';
  return (
    <div className={`p-5 rounded-xl ${bg}`} style={highlight || color ? { boxShadow: '0 4px 14px rgba(0,0,0,0.08)' } : {}}>
      <div className={`text-xs ${highlight || color ? 'text-white/80' : 'text-gray-500'}`}>{label}</div>
      <div className={`text-3xl font-bold mt-1 ${highlight || color ? '' : 'text-gray-900'}`}>{value}</div>
      {sub && <div className={`text-xs mt-1 ${highlight || color ? 'text-white/70' : 'text-gray-500'}`}>{sub}</div>}
    </div>
  );
}

function StatCardMini({ label, value, color }: { label: string; value: number; color?: string }) {
  const cls: Record<string, string> = { yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800', blue: 'bg-blue-50 border-blue-200 text-blue-800', indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800', purple: 'bg-purple-50 border-purple-200 text-purple-800', red: 'bg-red-50 border-red-200 text-red-800', green: 'bg-green-50 border-green-200 text-green-800' };
  return (
    <div className={`p-3 rounded-lg border text-center ${cls[color || ''] || 'bg-gray-50 border-gray-200 text-gray-700'}`}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-xl font-bold mt-0.5">{value}</div>
    </div>
  );
}

function UserStat({ role, count, color }: { role: string; count: number; color: string }) {
  const cls: Record<string, string> = { red: 'bg-red-50 text-red-700 border-red-100', blue: 'bg-blue-50 text-blue-700 border-blue-100', green: 'bg-green-50 text-green-700 border-green-100', orange: 'bg-orange-50 text-orange-700 border-orange-100' };
  return (
    <div className={`p-3 rounded-lg border ${cls[color] || ''}`}>
      <div className="text-xs opacity-80">{role}</div>
      <div className="text-2xl font-bold mt-0.5">{count}</div>
    </div>
  );
}
