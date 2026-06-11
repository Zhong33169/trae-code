import { useState, useEffect } from 'react';
import { Search, Clock, FileText, CheckCircle2, XCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';

const actionOptions = [
  { value: '', label: '全部操作' },
  { value: 'create', label: '创建' },
  { value: 'submit', label: '提交' },
  { value: 'approve', label: '通过' },
  { value: 'reject', label: '退回' },
  { value: 'revise', label: '补正' },
  { value: 'archive', label: '归档' },
  { value: 'validate_fail', label: '校验失败' },
];

export default function Logs() {
  const { logs, logsTotal, fetchLogs, loading } = useAppStore();

  const [keyword, setKeyword] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    fetchLogs({
      action,
      page,
      page_size: pageSize,
    });
  }, [action, page, fetchLogs]);

  const totalPages = Math.ceil(logsTotal / pageSize);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'create':
      case 'submit':
        return <FileText className="w-4 h-4 text-blue-500" />;
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
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getActionBg = (actionType: string) => {
    switch (actionType) {
      case 'approve':
      case 'archive':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'reject':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'revise':
      case 'submit':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'validate_fail':
        return 'bg-orange-50 border-orange-200 text-orange-700';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">操作记录</h1>
        <span className="text-sm text-slate-500">
          共 <span className="font-medium text-slate-700">{logsTotal}</span> 条记录
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              placeholder="搜索操作备注..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {actionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="divide-y divide-slate-50">
          {logs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    getActionBg(log.action)
                  )}
                >
                  {getActionIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border',
                        getActionBg(log.action)
                      )}
                    >
                      {log.action_label}
                    </span>
                    <span className="text-sm text-slate-600">{log.operator_name}</span>
                    <span className="text-xs text-slate-400">
                      需求 #{log.ticket_id}
                    </span>
                    <span className="text-xs text-slate-400 ml-auto">
                      {formatDate(log.created_at)}
                    </span>
                  </div>
                  {log.comment && (
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {log.comment}
                    </p>
                  )}
                  {(log.from_stage || log.to_stage) && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <span className="px-2 py-0.5 bg-slate-100 rounded">
                        {log.from_stage || '新建'}
                      </span>
                      <span className="text-slate-300">→</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded">
                        {log.to_stage}
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded">
                        {log.from_status || '-'}
                      </span>
                      <span className="text-slate-300">→</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded">
                        {log.to_status}
                      </span>
                    </div>
                  )}
                  {log.evidences && log.evidences.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {log.evidences.map((ev) => (
                        <a
                          key={ev.id}
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 text-xs text-blue-600 rounded hover:bg-blue-50"
                        >
                          <FileText className="w-3 h-3" />
                          {ev.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {logs.length === 0 && !loading.logs && (
          <div className="py-16 text-center text-slate-400 text-sm">
            暂无操作记录
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
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                上一页
              </button>
              <span className="px-3 py-1.5 text-sm text-slate-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
