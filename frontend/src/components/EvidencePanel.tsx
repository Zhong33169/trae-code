import type { ReplenishmentApplication, ApplicationVersion } from '../types';
import { statusDisplayMap, statusColorMap, actionDisplayMap } from '../types';

interface Props {
  application: ReplenishmentApplication | null;
  history: ApplicationVersion[];
}

export default function EvidencePanel({ application, history }: Props) {
  if (!application) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
        <p style={{ fontSize: '14px', margin: 0 }}>选择一条申请查看详情和证据</p>
      </div>
    );
  }

  const evidenceItems = [
    {
      key: 'evidence_store_replenishment',
      label: '门店补货凭证',
      value: application.evidence_store_replenishment,
      icon: '🏪',
    },
    {
      key: 'evidence_delivery_confirmation',
      label: '配送确认单',
      value: application.evidence_delivery_confirmation,
      icon: '🚚',
    },
    {
      key: 'evidence_registration',
      label: '补货申请登记凭证',
      value: application.evidence_registration,
      icon: '📝',
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e5e7eb',
        background: '#f9fafb',
      }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
          关键证据
        </h3>
        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
          申请编号：{application.application_no}
        </p>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
              当前状态
            </span>
            <span style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 500,
              background: `${statusColorMap[application.status]}15`,
              color: statusColorMap[application.status],
            }}>
              {statusDisplayMap[application.status]}
            </span>
          </div>
          <div style={{
            padding: '12px',
            background: '#f9fafb',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#6b7280',
          }}>
            <div>门店：{application.store_name}（{application.store_no}）</div>
            <div style={{ marginTop: '4px' }}>创建人：{application.created_by_name}</div>
            <div style={{ marginTop: '4px' }}>版本：v{application.current_version}</div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: '13px',
            fontWeight: 600,
            color: '#374151',
          }}>
            证据材料
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {evidenceItems.map(item => (
              <div
                key={item.key}
                style={{
                  padding: '10px 12px',
                  background: item.value ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${item.value ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '20px' }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: item.value ? '#166534' : '#991b1b',
                  }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: item.value ? '#15803d' : '#b91c1c',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.value || '暂未上传'}
                  </div>
                </div>
                {item.value ? (
                  <span style={{ fontSize: '14px' }}>✓</span>
                ) : (
                  <span style={{ fontSize: '14px' }}>✗</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: '13px',
            fontWeight: 600,
            color: '#374151',
          }}>
            补货商品（{application.items.length} 种）
          </h4>
          <div style={{
            maxHeight: '200px',
            overflow: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>
                <tr>
                  <th style={{
                    padding: '8px 10px',
                    textAlign: 'left',
                    fontWeight: 500,
                    color: '#6b7280',
                    borderBottom: '1px solid #e5e7eb',
                  }}>
                    商品
                  </th>
                  <th style={{
                    padding: '8px 10px',
                    textAlign: 'right',
                    fontWeight: 500,
                    color: '#6b7280',
                    borderBottom: '1px solid #e5e7eb',
                  }}>
                    数量
                  </th>
                </tr>
              </thead>
              <tbody>
                {application.items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ color: '#374151' }}>{item.name}</div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>{item.sku}</div>
                    </td>
                    <td style={{
                      padding: '8px 10px',
                      textAlign: 'right',
                      color: '#374151',
                      fontWeight: 500,
                    }}>
                      {item.quantity} {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {application.remarks && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{
              margin: '0 0 8px 0',
              fontSize: '13px',
              fontWeight: 600,
              color: '#374151',
            }}>
              备注
            </h4>
            <div style={{
              padding: '10px 12px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#92400e',
            }}>
              {application.remarks}
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div>
            <h4 style={{
              margin: '0 0 12px 0',
              fontSize: '13px',
              fontWeight: 600,
              color: '#374151',
            }}>
              变更历史
            </h4>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '10px',
                top: '8px',
                bottom: '8px',
                width: '2px',
                background: '#e5e7eb',
              }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {history.slice(0, 8).map((version, idx) => (
                  <div key={version.id} style={{
                    position: 'relative',
                    paddingLeft: '28px',
                  }}>
                    <div style={{
                      position: 'absolute',
                      left: '4px',
                      top: '4px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: idx === 0 ? '#4f46e5' : '#d1d5db',
                      border: '3px solid white',
                      boxShadow: '0 0 0 1px #d1d5db',
                    }} />
                    <div style={{
                      fontSize: '12px',
                      color: '#374151',
                      fontWeight: 500,
                    }}>
                      {actionDisplayMap[version.action]}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      marginTop: '2px',
                    }}>
                      v{version.version} · {version.performed_by_name}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: '#9ca3af',
                      marginTop: '2px',
                    }}>
                      {new Date(version.performed_at).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
