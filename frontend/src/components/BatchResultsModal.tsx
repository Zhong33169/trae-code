import type { BatchReviewResponse } from '../types';
import { statusDisplayMap } from '../types';

interface Props {
  result: BatchReviewResponse;
  onClose: () => void;
}

type FailureCategory = 'version_conflict' | 'status_error' | 'role_error' | 'evidence_missing' | 'not_found' | 'other';

function classifyFailure(message: string): { category: FailureCategory; label: string; suggestion: string; color: string } {
  if (message.includes('版本冲突')) {
    return {
      category: 'version_conflict',
      label: '版本冲突',
      suggestion: '请刷新列表获取最新版本后重试',
      color: '#f59e0b',
    };
  }
  if (message.includes('状态')) {
    return {
      category: 'status_error',
      label: '状态不允许',
      suggestion: '该申请当前状态不允许此操作',
      color: '#8b5cf6',
    };
  }
  if (message.includes('角色') || message.includes('权限')) {
    return {
      category: 'role_error',
      label: '角色权限不足',
      suggestion: '请切换到正确的角色后办理',
      color: '#ef4444',
    };
  }
  if (message.includes('凭证') || message.includes('证据') || message.includes('上传')) {
    return {
      category: 'evidence_missing',
      label: '证据缺失',
      suggestion: '请进入详情补全凭证材料',
      color: '#ec4899',
    };
  }
  if (message.includes('不存在')) {
    return {
      category: 'not_found',
      label: '申请不存在',
      suggestion: '该申请可能已被删除，请刷新确认',
      color: '#6b7280',
    };
  }
  return {
    category: 'other',
    label: '其他错误',
    suggestion: '请稍后重试或联系管理员',
    color: '#6b7280',
  };
}

export default function BatchResultsModal({ result, onClose }: Props) {
  const failedItems = result.results.filter(r => !r.success);
  const versionConflicts = failedItems.filter(r => classifyFailure(r.message).category === 'version_conflict').length;
  const statusErrors = failedItems.filter(r => classifyFailure(r.message).category === 'status_error').length;
  const evidenceMissing = failedItems.filter(r => classifyFailure(r.message).category === 'evidence_missing').length;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          width: '640px',
          maxWidth: '92vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>
              批量操作结果
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
              共 {result.results.length} 条，成功 {result.success_count} 条，失败 {result.failed_count} 条
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              border: 'none',
              background: 'transparent',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#6b7280',
              borderRadius: '6px',
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: result.failed_count > 0 ? '1fr 1fr 2fr' : '1fr',
          gap: '12px',
          padding: '16px 24px',
          background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
        }}>
          <div style={{
            padding: '12px',
            background: 'white',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#10b981' }}>
              {result.success_count}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              ✅ 成功办理
            </div>
          </div>
          {result.failed_count > 0 && (
            <>
              <div style={{
                padding: '12px',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '24px', fontWeight: 600, color: '#ef4444' }}>
                  {result.failed_count}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                  ❌ 失败 / 需重试
                </div>
              </div>
              <div style={{
                padding: '10px 12px',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '12px',
                color: '#4b5563',
              }}>
                <div style={{ fontWeight: 500, marginBottom: '6px', color: '#374151' }}>失败原因分析：</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {versionConflicts > 0 && (
                    <div>⚠️ 版本冲突：{versionConflicts} 条，请刷新后重试</div>
                  )}
                  {statusErrors > 0 && (
                    <div>🔄 状态不符：{statusErrors} 条，当前状态不允许操作</div>
                  )}
                  {evidenceMissing > 0 && (
                    <div>📎 证据缺失：{evidenceMissing} 条，需进入详情补全</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {result.results.map((item, idx) => {
              const failureInfo = !item.success ? classifyFailure(item.message) : null;
              return (
                <div
                  key={idx}
                  style={{
                    padding: '14px',
                    background: item.success ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${item.success ? '#bbf7d0' : '#fecaca'}`,
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: item.success ? '#10b981' : '#ef4444',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '15px',
                    flexShrink: 0,
                    marginTop: '1px',
                  }}>
                    {item.success ? '✓' : '✗'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: item.success ? '#166534' : '#991b1b',
                        fontFamily: 'monospace',
                      }}>
                        {item.application_no}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {failureInfo && (
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: `${failureInfo.color}15`,
                            color: failureInfo.color,
                            fontWeight: 500,
                          }}>
                            {failureInfo.label}
                          </span>
                        )}
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: item.success ? '#dcfce7' : '#fee2e2',
                          color: item.success ? '#15803d' : '#b91c1c',
                          fontWeight: 500,
                        }}>
                          {item.success ? '成功' : '失败'}
                        </span>
                      </div>
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: item.success ? '#15803d' : '#b91c1c',
                      marginTop: '6px',
                      lineHeight: 1.5,
                    }}>
                      {item.message}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flexWrap: 'wrap',
                      marginTop: '6px',
                      fontSize: '11px',
                      color: '#6b7280',
                    }}>
                      <span>
                        状态：<b style={{ color: '#374151' }}>
                          {statusDisplayMap[item.status as keyof typeof statusDisplayMap] || item.status}
                        </b>
                      </span>
                      {failureInfo && (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'white',
                          border: '1px solid #e5e7eb',
                          color: '#4b5563',
                        }}>
                          💡 {failureInfo.suggestion}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            点击确定后将自动刷新列表和详情面板
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '10px 28px',
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
