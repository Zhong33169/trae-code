import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, Plus, ChevronLeft, ChevronRight, User, Handshake, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { RiskBadge, StatusBadge, StageBadge } from '@/components/Badges';
import { cn } from '@/lib/utils';
import type { RiskLevel, Stage, TicketStatus } from '@/types';

const stageOptions: { value: Stage | ''; label: string }[] = [
  { value: '', label: '全部阶段' },
  { value: 'confirm', label: '需求确认' },
  { value: 'schedule', label: '排期评估' },
  { value: 'acceptance', label: '交付验收' },
];

const riskOptions: { value: RiskLevel | ''; label: string }[] = [
  { value: '', label: '全部风险' },
  { value: 'high', label: '高风险' },
  { value: 'medium', label: '中风险' },
  { value: 'low', label: '低风险' },
];

const statusOptions: { value: TicketStatus | ''; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待处理' },
  { value: 'processing', label: '处理中' },
  { value: 'returned', label: '已退回' },
  { value: 'completed', label: '已完成' },
  { value: 'overdue', label: '已逾期' },
];

export default function TicketList() {
  const { tickets, ticketsTotal, fetchTickets, user, loading } = useAppStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<'all' | 'my_todo'>(() => {
    return searchParams.get('tab') === 'my_todo' ? 'my_todo' : 'all';
  });
  const [stage, setStage] = useState<Stage | ''>(() => {
    const s = searchParams.get('stage');
    return (s && ['confirm', 'schedule', 'acceptance'].includes(s)) ? s as Stage : '';
  });
  const [riskLevel, setRiskLevel] = useState<RiskLevel | ''>(() => {
    const r = searchParams.get('risk_level');
    return (r && ['high', 'medium', 'low'].includes(r)) ? r as RiskLevel : '';
  });
  const [status, setStatus] = useState<TicketStatus | ''>(() => {
    const s = searchParams.get('status');
    return (s && ['pending', 'processing', 'returned', 'completed', 'overdue'].includes(s)) ? s as TicketStatus : '';
  });
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchTickets({
      stage,
      risk_level: riskLevel,
      status,
      keyword,
      page,
      page_size: pageSize,
      my_todo: tab === 'my_todo',
    });
  }, [stage, riskLevel, status, keyword, page, tab, fetchTickets]);

  const totalPages = Math.ceil(ticketsTotal / pageSize);
  const canCreate = user?.role === 'registrar';

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">需求队列</h1>
        {canCreate && (
          <button
            onClick={() => navigate('/tickets/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            发起需求
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => { setTab('all'); setPage(1); }}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                tab === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              全部需求
            </button>
            <button
              onClick={() => { setTab('my_todo'); setPage(1); }}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                tab === 'my_todo' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              我的待办
            </button>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              placeholder="搜索需求标题或描述..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={stage}
              onChange={(e) => {
                setStage(e.target.value as Stage | '');
                setPage(1);
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {stageOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={riskLevel}
              onChange={(e) => {
                setRiskLevel(e.target.value as RiskLevel | '');
                setPage(1);
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {riskOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as TicketStatus | '');
                setPage(1);
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-slate-500 ml-auto">
            共 <span className="font-medium text-slate-700">{ticketsTotal}</span> 条
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                需求信息
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-28">
                阶段
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-24">
                风险
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-24">
                状态
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-28">
                优先级
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-32">
                当前处理人
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-36">
                创建时间
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {tickets.map((ticket) => (
              <tr
                key={ticket.id}
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-1 h-10 rounded-full flex-shrink-0',
                        ticket.risk_level === 'high' ? 'bg-red-500' :
                        ticket.risk_level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                      )}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{ticket.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">
                        {ticket.description}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <StageBadge stage={ticket.stage} />
                </td>
                <td className="px-5 py-4">
                  <RiskBadge level={ticket.risk_level} pulse={ticket.risk_level === 'high'} />
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={ticket.status} />
                </td>
                <td className="px-5 py-4">
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      ticket.priority >= 100 ? 'text-red-600' :
                      ticket.priority >= 50 ? 'text-amber-600' : 'text-emerald-600'
                    )}
                  >
                    {ticket.priority}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="space-y-1">
                    <span className={cn(
                      'text-sm',
                      ticket.current_handler_id === user?.id ? 'font-semibold text-blue-600' : 'text-slate-600'
                    )}>
                      {ticket.current_handler_name || '-'}
                      {ticket.current_handler_id === user?.id && (
                        <span className="ml-1 text-xs text-blue-500">(我)</span>
                      )}
                    </span>
                    {ticket.handler_status !== 'other' && (
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                        ticket.handler_status === 'handling' && 'bg-blue-100 text-blue-700',
                        ticket.handler_status === 'pending_takeover' && 'bg-amber-100 text-amber-700',
                        ticket.handler_status === 'returned_fix' && 'bg-orange-100 text-orange-700'
                      )}>
                        {ticket.handler_status === 'handling' && <User className="w-3 h-3" />}
                        {ticket.handler_status === 'pending_takeover' && <Handshake className="w-3 h-3" />}
                        {ticket.handler_status === 'returned_fix' && <RefreshCw className="w-3 h-3" />}
                        {ticket.handler_status === 'handling' && '当前处理'}
                        {ticket.handler_status === 'pending_takeover' && '待我接手'}
                        {ticket.handler_status === 'returned_fix' && '待我补正'}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm text-slate-500">
                    {formatDate(ticket.created_at)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {tickets.length === 0 && !loading.tickets && (
          <div className="py-16 text-center text-slate-400 text-sm">
            暂无需求数据
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              第 {page} / {totalPages} 页
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5) {
                  if (page <= 3) pageNum = i + 1;
                  else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                      page === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
