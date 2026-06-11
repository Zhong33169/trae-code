import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Plus,
  User,
  Handshake,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { RiskBadge, StageBadge } from '@/components/Badges';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { dashboardStats, fetchDashboardStats, tickets, fetchTickets, user, loading } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardStats();
    fetchTickets({ page_size: 5 });
  }, [fetchDashboardStats, fetchTickets]);

  const stats = dashboardStats || {
    total_pending: 0,
    stage_counts: {} as Record<string, number>,
    risk_counts: {} as Record<string, number>,
    overdue_count: 0,
    my_todo_count: 0,
    my_handling_count: 0,
    my_pending_takeover_count: 0,
    my_returned_fix_count: 0,
  };

  const stageLabels: Record<string, string> = {
    confirm: '需求确认',
    schedule: '排期评估',
    acceptance: '交付验收',
  };

  const statCards = [
    {
      label: '待办总数',
      value: stats.total_pending,
      icon: FileText,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      onClick: () => navigate('/tickets'),
    },
    {
      label: '我的待办',
      value: stats.my_todo_count,
      icon: Clock,
      color: 'from-indigo-500 to-indigo-600',
      bgColor: 'bg-indigo-50',
      onClick: () => navigate('/tickets?tab=my_todo'),
    },
    {
      label: '已逾期',
      value: stats.overdue_count,
      icon: AlertTriangle,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      onClick: () => navigate('/tickets?status=overdue'),
    },
    {
      label: '高风险',
      value: stats.risk_counts?.high || 0,
      icon: TrendingUp,
      color: 'from-amber-500 to-orange-600',
      bgColor: 'bg-amber-50',
      onClick: () => navigate('/tickets?risk_level=high'),
    },
  ];

  const canCreate = user?.role === 'registrar';

  const myTodoCards = [
    {
      label: '当前处理',
      value: stats.my_handling_count || 0,
      icon: User,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      desc: '正在处理的需求单',
    },
    {
      label: '待我接手',
      value: stats.my_pending_takeover_count || 0,
      icon: Handshake,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
      desc: '他人转交待确认接手',
    },
    {
      label: '待我补正',
      value: stats.my_returned_fix_count || 0,
      icon: RefreshCw,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
      desc: '已退回需补正后重提',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">工作台</h1>
          <p className="text-sm text-slate-500 mt-1">
            欢迎回来，{user?.name}
          </p>
        </div>
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

      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <div
            key={index}
            onClick={card.onClick}
            className="bg-white rounded-xl p-5 border border-slate-100 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="text-3xl font-bold text-slate-800 mt-2">
                  {loading.dashboard ? '...' : card.value}
                </p>
              </div>
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', card.bgColor)}>
                <card.icon className={cn('w-5 h-5', card.color.includes('red') ? 'text-red-500' : card.color.includes('amber') ? 'text-amber-500' : card.color.includes('indigo') ? 'text-indigo-500' : 'text-blue-500')} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">我的待办分类</h3>
        <div className="grid grid-cols-3 gap-4">
          {myTodoCards.map((card, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-4 border border-slate-100 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate('/tickets?tab=my_todo')}
            >
              <div className="flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', card.bgColor)}>
                  <card.icon className={cn('w-5 h-5', card.color)} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">
                    {loading.dashboard ? '...' : card.value}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-3">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">各阶段分布</h3>
          </div>
          <div className="space-y-4">
            {Object.entries(stageLabels).map(([key, label]) => {
              const count = stats.stage_counts?.[key] || 0;
              const total = stats.total_pending || 1;
              const percent = (count / total) * 100;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-slate-600">{label}</span>
                    <span className="text-sm font-medium text-slate-800">{count} 条</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        key === 'confirm' ? 'bg-slate-400' :
                        key === 'schedule' ? 'bg-violet-500' : 'bg-teal-500'
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">风险分布</h3>
          </div>
          <div className="space-y-3">
            {(['high', 'medium', 'low'] as const).map((level) => {
              const count = stats.risk_counts?.[level] || 0;
              return (
                <div key={level} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <RiskBadge level={level} pulse={level === 'high'} />
                  <span className="text-lg font-bold text-slate-800">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">最近需求</h3>
          <button
            onClick={() => navigate('/tickets')}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            查看全部
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {tickets.slice(0, 5).map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => navigate(`/tickets/${ticket.id}`)}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-1 h-10 rounded-full',
                    ticket.risk_level === 'high' ? 'bg-red-500' :
                    ticket.risk_level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                  )}
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">{ticket.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    创建人：{ticket.creator_name} · {ticket.created_at?.split('T')[0]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StageBadge stage={ticket.stage} />
                <RiskBadge level={ticket.risk_level} />
              </div>
            </div>
          ))}
          {tickets.length === 0 && !loading.tickets && (
            <div className="py-12 text-center text-slate-400 text-sm">
              暂无需求数据
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
