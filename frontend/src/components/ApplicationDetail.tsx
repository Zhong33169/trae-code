import { useState } from 'react';
import type {
  ReplenishmentApplication,
  ApplicationVersion,
  User,
  ReplenishmentItem,
} from '../types';
import {
  statusDisplayMap,
  statusColorMap,
  actionDisplayMap,
  roleDisplayMap,
} from '../types';
import {
  updateApplication,
  submitApplication,
  reviewApplication,
  finalReviewApplication,
} from '../lib/api';

interface Props {
  application: ReplenishmentApplication;
  history: ApplicationVersion[];
  user: User;
  onClose: () => void;
  onUpdated: () => void;
}

export default function ApplicationDetail({
  application,
  history,
  user,
  onClose,
  onUpdated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'history'>('info');

  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<ReplenishmentItem[]>(application.items);
  const [editEvStore, setEditEvStore] = useState(application.evidence_store_replenishment || '');
  const [editEvDelivery, setEditEvDelivery] = useState(application.evidence_delivery_confirmation || '');
  const [editEvReg, setEditEvReg] = useState(application.evidence_registration || '');
  const [editRemarks, setEditRemarks] = useState(application.remarks || '');

  const canEdit = user.role === 'registrar' &&
    (application.status === 'draft' || application.status === 'needs_correction');
  const canSubmit = user.role === 'registrar' &&
    (application.status === 'draft' || application.status === 'needs_correction');
  const canReview = user.role === 'reviewer' && application.status === 'pending_review';
  const canFinalReview = user.role === 'final_reviewer' && application.status === 'reviewed';

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await submitApplication(application.id, {
        current_version: application.current_version,
      });
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (approved: boolean) => {
    setLoading(true);
    setError(null);
    try {
      await reviewApplication(application.id, {
        current_version: application.current_version,
        approved,
        remarks: remarks || null,
      });
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : '审核失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalReview = async (approved: boolean) => {
    setLoading(true);
    setError(null);
    try {
      await finalReviewApplication(application.id, {
        current_version: application.current_version,
        approved,
        remarks: remarks || null,
      });
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : '复核失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    setError(null);
    try {
      await updateApplication(application.id, {
        current_version: application.current_version,
        items: editItems,
        evidence_store_replenishment: editEvStore || null,
        evidence_delivery_confirmation: editEvDelivery || null,
        evidence_registration: editEvReg || null,
        remarks: editRemarks || null,
      });
      setIsEditing(false);
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setEditItems([...editItems, { sku: '', name: '', quantity: 1, unit: '件' }]);
  };

  const updateItem = (idx: number, field: keyof ReplenishmentItem, value: string | number) => {
    const newItems = [...editItems];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setEditItems(newItems);
  };

  const removeItem = (idx: number) => {
    setEditItems(editItems.filter((_, i) => i !== idx));
  };

  return (
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
    }} onClick={onClose}>
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          width: '720px',
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
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>
              补货申请详情
            </h2>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '13px',
              color: '#6b7280',
              fontFamily: 'monospace',
            }}>
              {application.application_no}
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
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
        }}>
          <button
            onClick={() => setActiveTab('info')}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'transparent',
              fontSize: '14px',
              cursor: 'pointer',
              color: activeTab === 'info' ? '#4f46e5' : '#6b7280',
              fontWeight: activeTab === 'info' ? 500 : 400,
              borderBottom: '2px solid ' + (activeTab === 'info' ? '#4f46e5' : 'transparent'),
              marginBottom: '-1px',
            }}
          >
            申请信息
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'transparent',
              fontSize: '14px',
              cursor: 'pointer',
              color: activeTab === 'history' ? '#4f46e5' : '#6b7280',
              fontWeight: activeTab === 'history' ? 500 : 400,
              borderBottom: '2px solid ' + (activeTab === 'history' ? '#4f46e5' : 'transparent'),
              marginBottom: '-1px',
            }}
          >
            变更历史
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {error && (
            <div style={{
              padding: '12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#dc2626',
              fontSize: '13px',
              marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          {activeTab === 'info' && (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '20px',
              }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#6b7280' }}>门店</label>
                  <div style={{
                    marginTop: '4px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#1f2937',
                  }}>
                    {application.store_name}
                    <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '6px' }}>
                      {application.store_no}
                    </span>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#6b7280' }}>当前状态</label>
                  <div style={{ marginTop: '4px' }}>
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
                    <span style={{
                      fontSize: '12px',
                      color: '#9ca3af',
                      marginLeft: '8px',
                    }}>
                      v{application.current_version}
                    </span>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#6b7280' }}>创建人</label>
                  <div style={{
                    marginTop: '4px',
                    fontSize: '14px',
                    color: '#374151',
                  }}>
                    {application.created_by_name}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#6b7280' }}>创建时间</label>
                  <div style={{
                    marginTop: '4px',
                    fontSize: '14px',
                    color: '#374151',
                  }}>
                    {new Date(application.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>

              {isEditing ? (
                <div>
                  <h4 style={{
                    margin: '0 0 12px 0',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1f2937',
                  }}>
                    补货商品
                  </h4>
                  <div style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    overflow: 'hidden',
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{
                            padding: '8px 10px',
                            textAlign: 'left',
                            fontWeight: 500,
                            color: '#6b7280',
                            fontSize: '12px',
                          }}>SKU</th>
                          <th style={{
                            padding: '8px 10px',
                            textAlign: 'left',
                            fontWeight: 500,
                            color: '#6b7280',
                            fontSize: '12px',
                          }}>商品名称</th>
                          <th style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontWeight: 500,
                            color: '#6b7280',
                            fontSize: '12px',
                          }}>数量</th>
                          <th style={{
                            padding: '8px 10px',
                            textAlign: 'left',
                            fontWeight: 500,
                            color: '#6b7280',
                            fontSize: '12px',
                          }}>单位</th>
                          <th style={{
                            padding: '8px 10px',
                            textAlign: 'center',
                            width: '50px',
                          }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {editItems.map((item, idx) => (
                          <tr key={idx} style={{ borderTop: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                value={item.sku}
                                onChange={e => updateItem(idx, 'sku', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '4px 6px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  boxSizing: 'border-box',
                                }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                value={item.name}
                                onChange={e => updateItem(idx, 'name', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '4px 6px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  boxSizing: 'border-box',
                                }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                                style={{
                                  width: '80px',
                                  padding: '4px 6px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  textAlign: 'right',
                                }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                value={item.unit}
                                onChange={e => updateItem(idx, 'unit', e.target.value)}
                                style={{
                                  width: '60px',
                                  padding: '4px 6px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              <button
                                onClick={() => removeItem(idx)}
                                style={{
                                  color: '#ef4444',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '16px',
                                }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={addItem}
                    style={{
                      padding: '6px 12px',
                      background: '#f3f4f6',
                      border: '1px dashed #d1d5db',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      color: '#4b5563',
                      marginBottom: '20px',
                    }}
                  >
                    + 添加商品
                  </button>

                  <h4 style={{
                    margin: '0 0 12px 0',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1f2937',
                  }}>
                    证据材料
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280' }}>门店补货凭证</label>
                      <input
                        value={editEvStore}
                        onChange={e => setEditEvStore(e.target.value)}
                        placeholder="请输入凭证文件名或URL"
                        style={{
                          width: '100%',
                          marginTop: '4px',
                          padding: '8px 10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280' }}>配送确认单</label>
                      <input
                        value={editEvDelivery}
                        onChange={e => setEditEvDelivery(e.target.value)}
                        placeholder="请输入配送单文件名或URL"
                        style={{
                          width: '100%',
                          marginTop: '4px',
                          padding: '8px 10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280' }}>补货申请登记凭证</label>
                      <input
                        value={editEvReg}
                        onChange={e => setEditEvReg(e.target.value)}
                        placeholder="请输入登记凭证文件名或URL"
                        style={{
                          width: '100%',
                          marginTop: '4px',
                          padding: '8px 10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280' }}>备注</label>
                    <textarea
                      value={editRemarks}
                      onChange={e => setEditRemarks(e.target.value)}
                      rows={3}
                      placeholder="请输入备注信息"
                      style={{
                        width: '100%',
                        marginTop: '4px',
                        padding: '8px 10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '13px',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <h4 style={{
                    margin: '0 0 12px 0',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1f2937',
                  }}>
                    补货商品（{application.items.length} 种）
                  </h4>
                  <div style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    overflow: 'hidden',
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>
                        <tr>
                          <th style={{
                            padding: '8px 12px',
                            textAlign: 'left',
                            fontWeight: 500,
                            color: '#6b7280',
                            fontSize: '12px',
                          }}>SKU</th>
                          <th style={{
                            padding: '8px 12px',
                            textAlign: 'left',
                            fontWeight: 500,
                            color: '#6b7280',
                            fontSize: '12px',
                          }}>商品名称</th>
                          <th style={{
                            padding: '8px 12px',
                            textAlign: 'right',
                            fontWeight: 500,
                            color: '#6b7280',
                            fontSize: '12px',
                          }}>数量</th>
                          <th style={{
                            padding: '8px 12px',
                            textAlign: 'left',
                            fontWeight: 500,
                            color: '#6b7280',
                            fontSize: '12px',
                          }}>单位</th>
                        </tr>
                      </thead>
                      <tbody>
                        {application.items.map((item, idx) => (
                          <tr key={idx} style={{ borderTop: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '12px', color: '#6b7280' }}>
                              {item.sku}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#374151' }}>{item.name}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500, color: '#374151' }}>
                              {item.quantity}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: '12px' }}>{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <h4 style={{
                    margin: '0 0 12px 0',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1f2937',
                  }}>
                    证据材料
                  </h4>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '10px',
                    marginBottom: '20px',
                  }}>
                    {[
                      { label: '门店补货凭证', value: application.evidence_store_replenishment, icon: '🏪' },
                      { label: '配送确认单', value: application.evidence_delivery_confirmation, icon: '🚚' },
                      { label: '补货登记凭证', value: application.evidence_registration, icon: '📝' },
                    ].map((ev, idx) => (
                      <div key={idx} style={{
                        padding: '10px',
                        background: ev.value ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${ev.value ? '#bbf7d0' : '#fecaca'}`,
                        borderRadius: '8px',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '20px', marginBottom: '4px' }}>{ev.icon}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>{ev.label}</div>
                        <div style={{
                          fontSize: '11px',
                          fontWeight: 500,
                          color: ev.value ? '#166534' : '#991b1b',
                          marginTop: '4px',
                        }}>
                          {ev.value ? '已上传' : '未上传'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {application.remarks && (
                    <div>
                      <h4 style={{
                        margin: '0 0 8px 0',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1f2937',
                      }}>
                        备注
                      </h4>
                      <div style={{
                        padding: '12px',
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#92400e',
                      }}>
                        {application.remarks}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <div style={{ position: 'relative', paddingLeft: '10px' }}>
                <div style={{
                  position: 'absolute',
                  left: '10px',
                  top: '8px',
                  bottom: '8px',
                  width: '2px',
                  background: '#e5e7eb',
                }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {history.map((version, idx) => (
                    <div key={version.id} style={{
                      position: 'relative',
                      paddingLeft: '28px',
                      paddingBottom: idx === history.length - 1 ? 0 : '4px',
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
                        background: idx === 0 ? '#eef2ff' : '#f9fafb',
                        border: `1px solid ${idx === 0 ? '#c7d2fe' : '#e5e7eb'}`,
                        borderRadius: '10px',
                        padding: '14px',
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                          gap: '8px',
                          marginBottom: '10px',
                        }}>
                          <div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              flexWrap: 'wrap',
                            }}>
                              <span style={{
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#1f2937',
                              }}>
                                {actionDisplayMap[version.action]}
                              </span>
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '11px',
                                fontWeight: 600,
                                background: '#4f46e5',
                                color: 'white',
                                fontFamily: 'monospace',
                              }}>
                                v{version.version}
                              </span>
                              {idx === 0 && (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  fontSize: '11px',
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  fontWeight: 500,
                                }}>
                                  当前
                                </span>
                              )}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              marginTop: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flexWrap: 'wrap',
                            }}>
                              <span>办理人：<b style={{ color: '#374151' }}>{version.performed_by_name}</b></span>
                              <span style={{ color: '#d1d5db' }}>|</span>
                              {version.status_from && (
                                <>
                                  <span>
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '1px 6px',
                                      borderRadius: '8px',
                                      fontSize: '10px',
                                      background: '#e5e7eb',
                                      color: '#6b7280',
                                    }}>
                                      {statusDisplayMap[version.status_from as ApplicationStatus] || version.status_from}
                                    </span>
                                  </span>
                                  <span style={{ color: '#9ca3af' }}>→</span>
                                </>
                              )}
                              <span style={{
                                display: 'inline-block',
                                padding: '1px 6px',
                                borderRadius: '8px',
                                fontSize: '10px',
                                fontWeight: 500,
                                background: `${statusColorMap[version.status_to as ApplicationStatus]}15`,
                                color: statusColorMap[version.status_to as ApplicationStatus] || '#6b7280',
                              }}>
                                {statusDisplayMap[version.status_to as ApplicationStatus] || version.status_to}
                              </span>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#9ca3af',
                            fontFamily: 'monospace',
                          }}>
                            {new Date(version.performed_at).toLocaleString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </div>
                        </div>

                        {version.remarks && (
                          <div style={{
                            marginBottom: '10px',
                            padding: '8px 10px',
                            background: 'white',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: '#4b5563',
                            borderLeft: '3px solid #f59e0b',
                          }}>
                            <span style={{ fontWeight: 600, color: '#92400e' }}>办理备注：</span>
                            {version.remarks}
                          </div>
                        )}

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gap: '6px',
                          fontSize: '11px',
                        }}>
                          {[
                            { label: '门店补货凭证', value: version.evidence_store_replenishment },
                            { label: '配送确认单', value: version.evidence_delivery_confirmation },
                            { label: '补货登记凭证', value: version.evidence_registration },
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
                                {ev.value || '未上传'}
                              </div>
                            </div>
                          ))}
                        </div>

                        {version.items && version.items.length > 0 && (
                          <div style={{
                            marginTop: '10px',
                            padding: '8px 10px',
                            background: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                          }}>
                            <div style={{
                              fontSize: '11px',
                              color: '#6b7280',
                              marginBottom: '6px',
                              fontWeight: 500,
                            }}>
                              商品明细（{version.items.length} 种）
                            </div>
                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '6px',
                            }}>
                              {version.items.slice(0, 5).map((item, iIdx) => (
                                <span key={iIdx} style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  background: '#f3f4f6',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  color: '#4b5563',
                                }}>
                                  {item.name} × {item.quantity}{item.unit}
                                </span>
                              ))}
                              {version.items.length > 5 && (
                                <span style={{
                                  fontSize: '11px',
                                  color: '#9ca3af',
                                  alignSelf: 'center',
                                }}>
                                  等 {version.items.length} 项
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}>
          {(canReview || canFinalReview) && (
            <div style={{ flex: 1, marginRight: '12px' }}>
              <input
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder={canReview ? '审核备注（驳回必填）' : '复核备注（驳回必填）'}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditItems(application.items);
                  setEditEvStore(application.evidence_store_replenishment || '');
                  setEditEvDelivery(application.evidence_delivery_confirmation || '');
                  setEditEvReg(application.evidence_registration || '');
                  setEditRemarks(application.remarks || '');
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
                onClick={handleSaveEdit}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  background: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </>
          ) : (
            <>
              {canEdit && (
                <button
                  onClick={() => setIsEditing(true)}
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
                  编辑
                </button>
              )}
              {canSubmit && (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? '提交中...' : '提交审核'}
                </button>
              )}
              {canReview && (
                <>
                  <button
                    onClick={() => handleReview(false)}
                    disabled={loading}
                    style={{
                      padding: '10px 20px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    驳回
                  </button>
                  <button
                    onClick={() => handleReview(true)}
                    disabled={loading}
                    style={{
                      padding: '10px 20px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    通过
                  </button>
                </>
              )}
              {canFinalReview && (
                <>
                  <button
                    onClick={() => handleFinalReview(false)}
                    disabled={loading}
                    style={{
                      padding: '10px 20px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    驳回
                  </button>
                  <button
                    onClick={() => handleFinalReview(true)}
                    disabled={loading}
                    style={{
                      padding: '10px 20px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    归档
                  </button>
                </>
              )}
              {!canEdit && !canSubmit && !canReview && !canFinalReview && (
                <span style={{ fontSize: '13px', color: '#9ca3af' }}>
                  当前角色（{roleDisplayMap[user.role]}）无操作权限
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
