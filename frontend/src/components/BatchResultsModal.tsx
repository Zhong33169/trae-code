import type { BatchReviewResponse } from '../types';
import { statusDisplayMap } from '../types';

interface Props {
  result: BatchReviewResponse;
  onClose: () => void;
}

export default function BatchResultsModal({ result, onClose }: Props) {
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
          width: '560px',
          maxWidth: '92vw',
          maxHeight: '80vh',
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
          display: 'flex',
          gap: '12px',
          padding: '16px 24px',
          background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
        }}>
          <div style={{
            flex: 1,
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
              成功
            </div>
          </div>
          <div style={{
            flex: 1,
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
              失败 / 需重试
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {result.results.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 14px',
                  background: item.success ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${item.success ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: item.success ? '#10b981' : '#ef4444',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
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
                  }}>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: item.success ? '#166534' : '#991b1b',
                      fontFamily: 'monospace',
                    }}>
                      {item.application_no}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: item.success ? '#dcfce7' : '#fee2e2',
                      color: item.success ? '#15803d' : '#b91c1c',
                    }}>
                      {item.success ? '成功' : '失败'}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: item.success ? '#15803d' : '#b91c1c',
                    marginTop: '4px',
                  }}>
                    {item.message}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#6b7280',
                    marginTop: '2px',
                  }}>
                    当前状态：{statusDisplayMap[item.status as keyof typeof statusDisplayMap] || item.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
          textAlign: 'right',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
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
