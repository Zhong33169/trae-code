import Link from 'next/link';
import type { AccountApplication } from '@/lib/types';
import RiskBadge from './RiskBadge';
import StatusBadge from './StatusBadge';

interface ApplicationListProps {
  applications: AccountApplication[];
  loading?: boolean;
}

export default function ApplicationList({ applications, loading }: ApplicationListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="mt-2">暂无开户申请记录</p>
      </div>
    );
  }

  const getRiskBorderClass = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high':
        return 'border-l-4 border-l-red-600';
      case 'medium':
        return 'border-l-4 border-l-amber-500';
      default:
        return 'border-l-4 border-l-transparent';
    }
  };

  return (
    <div className="space-y-3">
      {applications.map((app) => (
        <Link
          key={app.id}
          href={`/application/${app.id}`}
          className={`block bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 border border-gray-100 ${getRiskBorderClass(app.risk_level)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-sm text-gray-500">{app.application_no}</span>
                <RiskBadge level={app.risk_level} />
                <StatusBadge
                  status={app.status}
                  isOverdue={app.is_overdue}
                  isReturned={app.is_returned}
                />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {app.applicant_name} - {app.account_type}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                <span className="inline-flex items-center">
                  <span className="font-medium">当前阶段：</span>
                  <span className="text-blue-600 font-semibold">{app.stage}</span>
                </span>
                <span>
                  <span className="font-medium">处理人：</span>
                  {app.current_handler_name || '未分配'}
                  {app.current_handler_role && ` (${app.current_handler_role})`}
                </span>
                <span>
                  <span className="font-medium">版本：</span>
                  v{app.version}
                </span>
              </div>
              {app.risk_reason && (
                <p className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
                  <span className="font-medium">风险原因：</span>
                  {app.risk_reason}
                </p>
              )}
              {app.returned_reason && (
                <p className="mt-2 text-sm text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg">
                  <span className="font-medium">退回原因：</span>
                  {app.returned_reason}
                </p>
              )}
              {app.evidences && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">证据材料：</span>
                  {app.evidences.map((ev) => (
                    <span
                      key={ev.id}
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                        ev.is_provided === 1
                          ? 'bg-green-100 text-green-700'
                          : ev.is_required === 1
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {ev.evidence_name}
                      {ev.is_provided === 1 ? '✓' : ev.is_required === 1 ? '✗' : '○'}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="ml-4 flex flex-col items-end text-xs text-gray-500 flex-shrink-0">
              <span>创建: {new Date(app.created_at).toLocaleString('zh-CN')}</span>
              <span>更新: {new Date(app.updated_at).toLocaleString('zh-CN')}</span>
              {app.deadline && (
                <span className={app.is_overdue ? 'text-red-600 font-medium' : ''}>
                  截止: {new Date(app.deadline).toLocaleDateString('zh-CN')}
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
