import type { BatchReviewResponse } from '../types';
import { statusDisplayMap, statusColorMap, roleDisplayMap } from '../types';

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
          width: '760px',
          maxWidth: '95vw',
          maxHeight: '88vh',
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
              📋 批量操作审计回执
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
                <div style={{ fontWeight: 500, marginBottom: '6px', color: '#374151' }}>📊 失败原因分析：</div>
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
                  {failedItems.length - versionConflicts - statusErrors - evidenceMissing > 0 && (
                    <div>
                      🔍 其他：{failedItems.length - versionConflicts - statusErrors - evidenceMissing} 条
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {result.results.map((item, idx) => {
              const failureInfo = !item.success ? classifyFailure(item.message) : null;
              return (
                <div
                  key={idx}
                  style={{
                    padding: '14px 16px',
                    background: item.success ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${item.success ? '#bbf7d0' : '#fecaca'}`,
                    borderRadius: '12px',
                  }}
                >
                  {/* 第一行：单号 + 状态 + 结果 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '8px',
                    flexWrap: 'wrap',
                    marginBottom: '10px',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}>
                      <span style={{
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
                      }}>
                        {item.success ? '✓' : '✗'}
                      </span>
                      <span style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: item.success ? '#166534' : '#991b1b',
                        fontFamily: 'monospace',
                        letterSpacing: '0.5px',
                      }}>
                        {item.application_no}
                      </span>
                      {item.performer_role && item.performer_name && (
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 9px',
                          borderRadius: '12px',
                          background: '#eef2ff',
                          color: '#4338ca',
                          fontWeight: 500,
                        }}>
                          👤 {item.performer_name} · {roleDisplayMap[item.performer_role as keyof typeof roleDisplayMap] || item.performer_role}
                        </span>
                      )}
                      {failureInfo && (
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 9px',
                          borderRadius: '12px',
                          background: `${failureInfo.color}15`,
                          color: failureInfo.color,
                          fontWeight: 600,
                          border: `1px solid ${failureInfo.color}30`,
                        }}>
                          {failureInfo.label}
                        </span>
                      )}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap',
                    }}>
                      {/* 版本流转 */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 10px',
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}>
                        <span style={{ color: item.success && item.new_version ? '#10b981' : '#6b7280' }}>
                          v{item.attempted_version}
                        </span>
                        <span style={{ color: '#d1d5db' }}>→</span>
                        <span style={{
                          color: item.success && item.new_version ? '#10b981' : '#9ca3af',
                          fontWeight: item.success && item.new_version ? 700 : 500,
                        }}>
                          {item.success && item.new_version ? `v${item.new_version}` : '不推进'}
                        </span>
                      </div>
                      {/* 状态流转 */}
                      {item.status_from && item.status_to && item.status_from !== item.status_to && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 10px',
                          background: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '10px',
                          fontSize: '11px',
                        }}>
                          <span style={{ color: statusColorMap[item.status_from as keyof typeof statusColorMap] || '#6b7280' }}>
                            {statusDisplayMap[item.status_from as keyof typeof statusDisplayMap] || item.status_from}
                          </span>
                          <span style={{ color: '#d1d5db', fontWeight: 700 }}>→</span>
                          <span style={{
                            color: statusColorMap[item.status_to as keyof typeof statusColorMap] || '#10b981',
                            fontWeight: 700,
                          }}>
                            {statusDisplayMap[item.status_to as keyof typeof statusDisplayMap] || item.status_to}
                          </span>
                        </div>
                      )}
                      <span style={{
                        fontSize: '12px',
                        padding: '3px 10px',
                        borderRadius: '10px',
                        background: item.success ? '#dcfce7' : '#fee2e2',
                        color: item.success ? '#15803d' : '#b91c1c',
                        fontWeight: 600,
                      }}>
                        {item.success ? '✅ 办理成功' : '❌ 办理失败'}
                      </span>
                    </div>
                  </div>

                  {/* 办理消息 */}
                  <div style={{
                    fontSize: '13px',
                    color: item.success ? '#15803d' : '#b91c1c',
                    lineHeight: 1.5,
                    padding: '6px 10px',
                    background: item.success ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                    borderRadius: '6px',
                    marginBottom: '10px',
                  }}>
                    <b>{item.success ? '📝 ' : '❌ '}</b>
                    {item.message}
                  </div>

                  {/* 办理备注 */}
                  {item.remarks && (
                    <div style={{
                      marginBottom: '10px',
                      padding: '8px 12px',
                      background: '#fffbeb',
                      borderLeft: '3px solid #f59e0b',
                      borderRadius: '0 6px 6px 0',
                      fontSize: '12px',
                      color: '#92400e',
                      lineHeight: 1.5,
                    }}>
                      <b style={{ color: '#b45309' }}>💬 办理备注：</b>
                      {item.remarks}
                    </div>
                  )}

                  {/* 证据快照 */}
                  {(item.evidence_store_replenishment || item.evidence_delivery_confirmation || item.evidence_registration) && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '6px',
                      padding: '10px',
                      background: item.success ? 'white' : 'rgba(254, 242, 242, 0.5)',
                      border: `1px solid ${item.success ? '#e5e7eb' : '#fecaca'}`,
                      borderRadius: '8px',
                    }}>
                      <div style={{
                        fontSize: '11px',
                        color: '#9ca3af',
                        gridColumn: '1 / -1',
                        marginBottom: '2px',
                        fontWeight: 500,
                      }}>
                        📎 办理时证据快照 {item.items_count ? `· 商品 ${item.items_count} 种` : ''}
                      </div>
                      {[
                        { label: '门店补货凭证', value: item.evidence_store_replenishment },
                        { label: '配送确认单', value: item.evidence_delivery_confirmation },
                        { label: '补货登记凭证', value: item.evidence_registration },
                      ].map((ev, eIdx) => (
                        <div key={eIdx} style={{
                          padding: '6px 8px',
                          background: ev.value ? '#ecfdf5' : '#fef2f2',
                          border: `1px solid ${ev.value ? '#a7f3d0' : '#fecaca'}`,
                          borderRadius: '6px',
                        }}>
                          <div style={{
                            fontSize: '10px',
                            color: '#9ca3af',
                            marginBottom: '2px',
                          }}>{ev.label}</div>
                          <div style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: ev.value ? '#065f46' : '#991b1b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }} title={ev.value || ''}>
                            {ev.value ? (
                              <>
                                <span style={{ marginRight: '2px' }}>✅</span>
                                {ev.value}
                              </>
                            ) : '⛔ 未上传'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 失败建议 */}
                  {failureInfo && (
                    <div style={{
                      marginTop: '10px',
                      padding: '6px 10px',
                      background: 'white',
                      border: '1px dashed #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#4b5563',
                    }}>
                      💡 <b>建议操作：</b>{failureInfo.suggestion}
                    </div>
                  )}
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
          <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>
            <div>🔄 点击确定后将自动刷新队列、详情和证据面板</div>
            <div style={{ marginTop: '2px', color: '#9ca3af', fontSize: '11px' }}>
              成功办理的申请状态已推进；失败的申请需按建议处理后重新选择办理
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '10px 32px',
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: 600,
              boxShadow: '0 1px 2px 0 rgba(79, 70, 229, 0.2)',
            }}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
