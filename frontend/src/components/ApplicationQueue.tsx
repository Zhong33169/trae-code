import { useState } from 'react';
import type {
  ReplenishmentApplication,
  Store,
  UserRole,
  BatchReviewResponse,
} from '../types';
import { statusDisplayMap, statusColorMap } from '../types';
import { batchReview } from '../lib/api';

interface Props {
  applications: ReplenishmentApplication[];
  selectedApp: ReplenishmentApplication | null;
  onSelectApp: (app: ReplenishmentApplication) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  storeFilter: number | null;
  onStoreFilterChange: (storeId: number | null) => void;
  stores: Store[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onRefresh: () => void;
  loading: boolean;
  error: string | null;
  userRole: UserRole;
  onBatchResult: (result: BatchReviewResponse) => void;
  onApplicationsUpdated: () => void;
}

export default function ApplicationQueue({
  applications,
  selectedApp,
  onSelectApp,
  statusFilter,
  onStatusFilterChange,
  storeFilter,
  onStoreFilterChange,
  stores,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onRefresh,
  loading,
  error,
  userRole,
  onBatchResult,
}: Props) {
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  const [batchApproved, setBatchApproved] = useState(true);
  const [batchRemarks, setBatchRemarks] = useState('');

  const statusOptions = [
    { value: '', label: '全部状态' },
    { value: 'draft', label: '草稿' },
    { value: 'pending_review', label: '待审核' },
    { value: 'reviewed', label: '审核通过' },
    { value: 'needs_correction', label: '需补正' },
    { value: 'archived', label: '已归档' },
  ];

  const canReview = userRole === 'reviewer';
  const canFinalReview = userRole === 'final_reviewer';
  const showBatchActions = canReview || canFinalReview;

  const handleBatchReview = async () => {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    setBatchError(null);
    try {
      const apps = applications.filter(a => selectedIds.has(a.id));
      const result = await batchReview({
        applications: apps.map(a => ({
          application_id: a.id,
          current_version: a.current_version,
        })),
        approved: batchApproved,
        remarks: batchRemarks || null,
      });
      onBatchResult(result);
      setShowBatchConfirm(false);
      setBatchRemarks('');
    } catch (e) {
      setBatchError(e instanceof Error ? e.message : '批量操作失败');
    } finally {
      setBatchLoading(false);
    }
  };

  const openBatchConfirm = (approved: boolean) => {
    setBatchApproved(approved);
    setBatchError(null);
    setShowBatchConfirm(true);
  };

  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending_review').length,
    needsFix: applications.filter(a => a.status === 'needs_correction').length,
    archived: applications.filter(a => a.status === 'archived').length,
  };

  return (
    <div style={{ maxWidth: '100%' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#1f2937' }}>
          补货申请队列
        </h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            padding: '8px 14px',
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: loading ? 'not-allowed' : 'pointer',
            color: '#374151',
          }}
        >
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        marginBottom: '16px',
      }}>
        <div style={{
          background: 'white',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>全部申请</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937' }}>{stats.total}</div>
        </div>
        <div style={{
          background: 'white',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          borderLeft: '4px solid #f59e0b',
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>待审核</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#f59e0b' }}>{stats.pending}</div>
        </div>
        <div style={{
          background: 'white',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          borderLeft: '4px solid #ef4444',
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>需补正</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#ef4444' }}>{stats.needsFix}</div>
        </div>
        <div style={{
          background: 'white',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          borderLeft: '4px solid #10b981',
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>已归档</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#10b981' }}>{stats.archived}</div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '12px',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <select
          value={statusFilter}
          onChange={e => onStatusFilterChange(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '13px',
            background: 'white',
          }}
        >
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          value={storeFilter ?? ''}
          onChange={e => onStoreFilterChange(e.target.value ? Number(e.target.value) : null)}
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '13px',
            background: 'white',
          }}
        >
          <option value="">全部门店</option>
          {stores.map(s => (
            <option key={s.id} value={s.id}>{s.store_no} - {s.store_name}</option>
          ))}
        </select>

        {showBatchActions && selectedIds.size > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            {canReview && (
              <>
                <button
                  onClick={() => openBatchConfirm(true)}
                  style={{
                    padding: '8px 14px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  批量通过 ({selectedIds.size})
                </button>
                <button
                  onClick={() => openBatchConfirm(false)}
                  style={{
                    padding: '8px 14px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  批量驳回
                </button>
              </>
            )}
            {canFinalReview && (
              <>
                <button
                  onClick={() => openBatchConfirm(true)}
                  style={{
                    padding: '8px 14px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  批量归档 ({selectedIds.size})
                </button>
                <button
                  onClick={() => openBatchConfirm(false)}
                  style={{
                    padding: '8px 14px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  批量驳回
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: '12px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          color: '#dc2626',
          marginBottom: '12px',
          fontSize: '13px',
        }}>
          {error}
        </div>
      )}

      <div style={{
        background: 'white',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {showBatchActions && (
                <th style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#6b7280',
                  width: '40px',
                }}>
                  <input
                    type="checkbox"
                    checked={applications.length > 0 && selectedIds.size === applications.length}
                    onChange={onSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
              )}
              <th style={{
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 500,
                color: '#6b7280',
              }}>
                申请单号
              </th>
              <th style={{
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 500,
                color: '#6b7280',
              }}>
                门店
              </th>
              <th style={{
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 500,
                color: '#6b7280',
              }}>
                状态
              </th>
              <th style={{
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 500,
                color: '#6b7280',
              }}>
                商品数
              </th>
              <th style={{
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 500,
                color: '#6b7280',
              }}>
                版本
              </th>
              <th style={{
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 500,
                color: '#6b7280',
              }}>
                创建人
              </th>
              <th style={{
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 500,
                color: '#6b7280',
              }}>
                创建时间
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={showBatchActions ? 8 : 7} style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#6b7280',
                  fontSize: '14px',
                }}>
                  加载中...
                </td>
              </tr>
            ) : applications.length === 0 ? (
              <tr>
                <td colSpan={showBatchActions ? 8 : 7} style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#6b7280',
                  fontSize: '14px',
                }}>
                  暂无申请数据
                </td>
              </tr>
            ) : (
              applications.map(app => (
                <tr
                  key={app.id}
                  onClick={() => onSelectApp(app)}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                    background: selectedApp?.id === app.id ? '#eff6ff' : 'white',
                  }}
                  className="app-row"
                >
                  {showBatchActions && (
                    <td style={{ padding: '10px 12px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(app.id)}
                        onChange={e => {
                          e.stopPropagation();
                          onToggleSelect(app.id);
                        }}
                        onClick={e => e.stopPropagation()}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                  )}
                  <td style={{
                    padding: '10px 12px',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    color: '#4f46e5',
                    fontWeight: 500,
                  }}>
                    {app.application_no}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', color: '#374151' }}>
                    <div>{app.store_name}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>{app.store_no}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      background: `${statusColorMap[app.status]}15`,
                      color: statusColorMap[app.status],
                    }}>
                      {statusDisplayMap[app.status]}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', color: '#374151' }}>
                    {app.items.length} 种
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', color: '#6b7280' }}>
                    v{app.current_version}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', color: '#374151' }}>
                    {app.created_by_name}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#6b7280' }}>
                    {new Date(app.created_at).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showBatchConfirm && (
        <div style={{
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
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '420px',
            maxWidth: '90vw',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>
              {batchApproved ? (canFinalReview ? '批量归档确认' : '批量通过确认') : '批量驳回确认'}
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#374151' }}>
              确定要对选中的 <strong style={{ color: '#4f46e5' }}>{selectedIds.size}</strong> 条申请
              执行<strong> {batchApproved ? (canFinalReview ? '归档' : '审核通过') : '驳回'} </strong>操作吗？
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#374151',
              }}>
                备注（可选）
              </label>
              <textarea
                value={batchRemarks}
                onChange={e => setBatchRemarks(e.target.value)}
                rows={3}
                placeholder={batchApproved ? '' : '请输入驳回原因...'}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '13px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {batchError && (
              <div style={{
                padding: '10px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#dc2626',
                fontSize: '13px',
                marginBottom: '16px',
              }}>
                {batchError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowBatchConfirm(false);
                  setBatchRemarks('');
                  setBatchError(null);
                }}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: '#374151',
                }}
              >
                取消
              </button>
              <button
                onClick={handleBatchReview}
                disabled={batchLoading}
                style={{
                  padding: '10px 20px',
                  background: batchApproved ? '#10b981' : '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: batchLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: batchLoading ? 0.6 : 1,
                }}
              >
                {batchLoading ? '处理中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
