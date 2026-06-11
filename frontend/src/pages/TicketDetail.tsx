import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  User,
  FileText,
  Paperclip,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { RiskBadge, StatusBadge, StageBadge } from '@/components/Badges';
import { cn } from '@/lib/utils';
import type { EvidenceCreate } from '@/types';

const stages = [
  { key: 'confirm', label: '需求确认' },
  { key: 'schedule', label: '排期评估' },
  { key: 'acceptance', label: '交付验收' },
];

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTicket, fetchTicketDetail, executeAction, user, loading, error, setError } = useAppStore();

  const [comment, setComment] = useState('');
  const [evidences, setEvidences] = useState<EvidenceCreate[]>([]);
  const [evName, setEvName] = useState('');
  const [evUrl, setEvUrl] = useState('');
  const [evType, setEvType] = useState('doc');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (id) {
      fetchTicketDetail(Number(id));
    }
  }, [id, fetchTicketDetail]);

  const ticket = currentTicket;

  const getStageIndex = (stage: string) => {
    return stages.findIndex((s) => s.key === stage);
  };

  const currentStageIndex = ticket ? getStageIndex(ticket.stage) : -1;

  const getAvailableActions = () => {
    if (!ticket || !user) return [];

    const actions: { key: string; label: string; type: 'primary' | 'danger' | 'default' }[] = [];

    if (user.role === 'registrar') {
      if (ticket.stage === 'confirm' && ticket.status === 'pending') {
        actions.push({ key: 'submit', label: '提交审核', type: 'primary' });
      }
      if (ticket.status === 'returned') {
        actions.push({ key: 'revise', label: '补正提交', type: 'primary' });
      }
    }

    if (user.role === 'auditor') {
      if ((ticket.stage === 'confirm' || ticket.stage === 'schedule') && ticket.status === 'pending') {
        actions.push({ key: 'approve', label: '通过', type: 'primary' });
        actions.push({ key: 'reject', label: '退回补正', type: 'danger' });
      }
    }

    if (user.role === 'reviewer') {
      if (ticket.stage === 'acceptance' && ticket.status === 'pending') {
        actions.push({ key: 'archive', label: '复核归档', type: 'primary' });
        actions.push({ key: 'reject', label: '退回补正', type: 'danger' });
      }
    }

    return actions;
  };

  const availableActions = getAvailableActions();

  const handleAction = async (action: string) => {
    if (!ticket) return;
    setActionError('');

    try {
      await executeAction(ticket.id, {
        action,
        comment,
        version: ticket.version,
        evidences,
      });
      setComment('');
      setEvidences([]);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const addEvidence = () => {
    if (!evName || !evUrl) return;
    setEvidences([...evidences, { name: evName, type: evType, url: evUrl }]);
    setEvName('');
    setEvUrl('');
  };

  const removeEvidence = (index: number) => {
    setEvidences(evidences.filter((_, i) => i !== index));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
      case 'submit':
        return <FileText className="w-4 h-4" />;
      case 'approve':
      case 'archive':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'reject':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'revise':
        return <RefreshCw className="w-4 h-4 text-amber-500" />;
      case 'validate_fail':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getLogBg = (action: string) => {
    switch (action) {
      case 'approve':
      case 'archive':
        return 'bg-green-50 border-green-200';
      case 'reject':
        return 'bg-red-50 border-red-200';
      case 'revise':
      case 'submit':
        return 'bg-blue-50 border-blue-200';
      case 'validate_fail':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const isOverdue = ticket?.status === 'overdue' || (ticket?.deadline && new Date(ticket.deadline) < new Date() && ticket?.status !== 'completed');

  if (!ticket && loading.ticketDetail) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12 text-slate-500">
        需求不存在或已被删除
      </div>
    );
  }

  const riskRequirements = {
    high: { minCount: 3, desc: '高风险需求需至少 3 份证据材料' },
    medium: { minCount: 2, desc: '中风险需求需至少 2 份证据材料' },
    low: { minCount: 1, desc: '低风险需求需至少 1 份证据材料' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/tickets')}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{ticket.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-slate-500">编号：#{ticket.id}</span>
            <span className="text-slate-300">|</span>
            <span className="text-sm text-slate-500">版本：v{ticket.version}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">流程进度</h3>
            <div className="relative">
              <div className="flex items-center justify-between">
                {stages.map((stage, index) => {
                  const isCompleted = index < currentStageIndex || (index === currentStageIndex && ticket.status === 'completed');
                  const isCurrent = index === currentStageIndex && ticket.status !== 'completed';
                  return (
                    <div key={stage.key} className="flex flex-col items-center relative flex-1">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold z-10',
                          isCompleted
                            ? 'bg-green-500 text-white'
                            : isCurrent
                            ? 'bg-blue-500 text-white ring-4 ring-blue-100 animate-pulse'
                            : 'bg-slate-200 text-slate-500'
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <span
                        className={cn(
                          'mt-2 text-xs font-medium',
                          isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-slate-400'
                        )}
                      >
                        {stage.label}
                      </span>
                      {index < stages.length - 1 && (
                        <div
                          className={cn(
                            'absolute top-5 h-0.5 -translate-y-1/2',
                            index < currentStageIndex ? 'bg-green-500' : 'bg-slate-200'
                          )}
                          style={{
                            left: 'calc(50% + 20px)',
                            right: 'calc(-50% + 20px)',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">需求描述</h3>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {ticket.description}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">处理历史</h3>
            <div className="space-y-4">
              {ticket.logs?.map((log, index) => (
                <div key={log.id} className="relative pl-8">
                  {index < (ticket.logs?.length || 0) - 1 && (
                    <div className="absolute left-[11px] top-6 bottom-0 w-px bg-slate-200" />
                  )}
                  <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center">
                    {getActionIcon(log.action)}
                  </div>
                  <div className={cn('rounded-lg border p-3', getLogBg(log.action))}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">
                          {log.action_label}
                        </span>
                        <span className="text-xs text-slate-500">
                          {log.operator_name}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    {log.comment && (
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {log.comment}
                      </p>
                    )}
                    {log.evidences && log.evidences.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200/50">
                        <p className="text-xs text-slate-500 mb-2">证据材料：</p>
                        <div className="space-y-1.5">
                          {log.evidences.map((ev) => (
                            <a
                              key={ev.id}
                              href={ev.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700"
                            >
                              <Paperclip className="w-3 h-3" />
                              {ev.name}
                              <span className="text-slate-400">({ev.type_label})</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {(log.from_stage !== log.to_stage || log.from_status !== log.to_status) && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <span>
                          {log.from_stage
                            ? `${getStageLabel(log.from_stage)} / ${getStatusLabel(log.from_status)}`
                            : '新建'}
                        </span>
                        <ArrowRightIcon className="w-3 h-3" />
                        <span>
                          {getStageLabel(log.to_stage)} / {getStatusLabel(log.to_status)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">基本信息</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">风险等级</span>
                <RiskBadge level={ticket.risk_level} pulse={ticket.risk_level === 'high'} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">当前阶段</span>
                <StageBadge stage={ticket.stage} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">当前状态</span>
                <StatusBadge status={ticket.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">优先级</span>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    ticket.priority >= 100 ? 'text-red-600' :
                    ticket.priority >= 50 ? 'text-amber-600' : 'text-emerald-600'
                  )}
                >
                  {ticket.priority}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">人员信息</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">创建人</p>
                  <p className="text-sm font-medium text-slate-800">{ticket.creator_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">当前处理人</p>
                  <p className="text-sm font-medium text-slate-800">
                    {ticket.current_handler_name || '暂无'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">时间信息</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">创建时间</p>
                  <p className="text-sm text-slate-700">{formatDate(ticket.created_at)}</p>
                </div>
              </div>
              <div className={cn(
                'flex items-center gap-2',
                isOverdue && 'text-red-600'
              )}>
                <Clock className={cn('w-4 h-4', isOverdue ? 'text-red-500' : 'text-slate-400')} />
                <div>
                  <p className={cn('text-xs', isOverdue ? 'text-red-500' : 'text-slate-500')}>
                    截止时间 {isOverdue && '(已逾期)'}
                  </p>
                  <p className={cn('text-sm font-medium', isOverdue ? 'text-red-600' : 'text-slate-700')}>
                    {formatDate(ticket.deadline)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {availableActions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">办理操作</h3>

              {actionError && (
                <div className="mb-3 p-2.5 bg-red-50 text-red-600 text-xs rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {actionError}
                </div>
              )}

              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  处理意见
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="请输入处理意见..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-600">
                    证据材料
                    <span className="text-slate-400 ml-1">
                      ({riskRequirements[ticket.risk_level as keyof typeof riskRequirements]?.desc || ''})
                    </span>
                  </label>
                </div>
                {evidences.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {evidences.map((ev, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded text-xs">
                        <Paperclip className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-700 truncate flex-1">{ev.name}</span>
                        <button
                          onClick={() => removeEvidence(idx)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={evName}
                    onChange={(e) => setEvName(e.target.value)}
                    placeholder="证据名称"
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <select
                    value={evType}
                    onChange={(e) => setEvType(e.target.value)}
                    className="px-2 py-1.5 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="doc">文档</option>
                    <option value="link">链接</option>
                    <option value="image">图片</option>
                    <option value="other">其他</option>
                  </select>
                </div>
                <div className="flex gap-2 mt-1.5">
                  <input
                    type="text"
                    value={evUrl}
                    onChange={(e) => setEvUrl(e.target.value)}
                    placeholder="证据链接/地址"
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={addEvidence}
                    className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs rounded hover:bg-slate-200 transition-colors"
                  >
                    添加
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                {availableActions.map((action) => (
                  <button
                    key={action.key}
                    onClick={() => handleAction(action.key)}
                    disabled={loading.action}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                      action.type === 'primary' && 'bg-blue-600 text-white hover:bg-blue-700',
                      action.type === 'danger' && 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
                      action.type === 'default' && 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    )}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getStageLabel(stage: string) {
  const map: Record<string, string> = {
    confirm: '需求确认',
    schedule: '排期评估',
    acceptance: '交付验收',
  };
  return map[stage] || stage;
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    returned: '已退回',
    completed: '已完成',
    overdue: '已逾期',
  };
  return map[status] || status;
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
