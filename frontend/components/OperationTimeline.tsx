import type { OperationRecord, RiskLevelLog } from '@/lib/types';

interface OperationTimelineProps {
  operations: OperationRecord[];
  riskLogs: RiskLevelLog[];
}

export default function OperationTimeline({ operations, riskLogs }: OperationTimelineProps) {
  const allEvents = [
    ...operations.map((op) => ({
      ...op,
      type: 'operation' as const,
      sortTime: op.created_at,
    })),
    ...riskLogs.map((log) => ({
      ...log,
      type: 'risk' as const,
      sortTime: log.created_at,
    })),
  ].sort((a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime());

  if (allEvents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        暂无操作记录
      </div>
    );
  }

  const getRiskLevelLabel = (level: string) => {
    switch (level) {
      case 'high':
        return '高风险';
      case 'medium':
        return '中风险';
      default:
        return '低风险';
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'text-red-600 bg-red-100';
      case 'medium':
        return 'text-amber-600 bg-amber-100';
      default:
        return 'text-green-600 bg-green-100';
    }
  };

  const isOpFailed = (event: any) => {
    if (event.type !== 'operation') return false;
    return event.is_success === 0 || event.operation_type === '操作失败';
  };

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
      <div className="space-y-4">
        {allEvents.map((event, index) => {
          const failed = isOpFailed(event);
          return (
          <div key={`${event.type}-${event.id}`} className="relative pl-10">
            <div
              className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${
                event.type === 'risk'
                  ? 'bg-amber-500'
                  : failed
                  ? 'bg-red-500'
                  : 'bg-blue-500'
              }`}
            >
              {event.type === 'risk' ? (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : failed ? (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>

            <div className={`rounded-lg p-3 border ${
              failed
                ? 'bg-red-50 border-red-200'
                : event.type === 'risk'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-gray-50 border-gray-100'
            }`}>
              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {event.type === 'risk'
                      ? `风险等级变更`
                      : event.operation_type}
                  </span>
                  {failed && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-200 text-red-800 font-medium">
                      ❌ 失败
                    </span>
                  )}
                  {!failed && event.type === 'operation' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                      ✅ 成功
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(event.sortTime).toLocaleString('zh-CN')}
                </span>
              </div>

              <div className="text-xs text-gray-600 mb-2">
                操作人：
                <span className="font-medium">
                  {event.operator_name}（{event.operator_role}）
                </span>
                {(event as any).version_before !== undefined && event.type === 'operation' && (
                  <span className="ml-3 font-mono bg-gray-200 px-1.5 py-0.5 rounded text-gray-700">
                    v{(event as any).version_before} → v{(event as any).version_after}
                  </span>
                )}
              </div>

              {event.type === 'risk' ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className={`px-2 py-0.5 rounded ${getRiskLevelColor(event.from_level)}`}>
                    {getRiskLevelLabel(event.from_level)}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <span className={`px-2 py-0.5 rounded ${getRiskLevelColor(event.to_level)}`}>
                    {getRiskLevelLabel(event.to_level)}
                  </span>
                </div>
              ) : (
                <>
                  {(event.from_stage || event.to_stage) && (
                    <div className="text-sm text-gray-700 mb-1">
                      阶段：{event.from_stage || '-'} → {event.to_stage || '-'}
                    </div>
                  )}
                  {(event.from_status || event.to_status) && (
                    <div className="text-sm text-gray-700 mb-1">
                      状态：{event.from_status || '-'} → {event.to_status || '-'}
                    </div>
                  )}
                  {(event.from_risk_level || event.to_risk_level) &&
                    event.from_risk_level !== event.to_risk_level && (
                      <div className="flex items-center gap-2 text-sm mb-1">
                        风险：
                        <span className={`px-2 py-0.5 rounded text-xs ${getRiskLevelColor(event.from_risk_level || '')}`}>
                          {getRiskLevelLabel(event.from_risk_level || '')}
                        </span>
                        <span>→</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${getRiskLevelColor(event.to_risk_level || '')}`}>
                          {getRiskLevelLabel(event.to_risk_level || '')}
                        </span>
                      </div>
                    )}
                </>
              )}

              {(event as any).remark && (
                <div className="text-sm text-gray-700 mt-2 pt-2 border-t border-gray-200">
                  <span className="font-medium">备注：</span>
                  {(event as any).remark}
                </div>
              )}
              {(event as any).change_reason && (
                <div className="text-sm text-gray-700 mt-2 pt-2 border-t border-gray-200">
                  <span className="font-medium">变更原因：</span>
                  {(event as any).change_reason}
                </div>
              )}
              {event.evidence_checked && (
                <div className="text-xs text-gray-500 mt-1">
                  核验证据ID：{event.evidence_checked}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
