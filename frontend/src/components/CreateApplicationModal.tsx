import { useState } from 'react';
import type { Store, ReplenishmentItem } from '../types';
import { createApplication } from '../lib/api';

interface Props {
  stores: Store[];
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateApplicationModal({ stores, onClose, onCreated }: Props) {
  const [storeId, setStoreId] = useState<number>(stores[0]?.id || 0);
  const [items, setItems] = useState<ReplenishmentItem[]>([
    { sku: '', name: '', quantity: 1, unit: '件' },
  ]);
  const [evStore, setEvStore] = useState('');
  const [evDelivery, setEvDelivery] = useState('');
  const [evReg, setEvReg] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addItem = () => {
    setItems([...items, { sku: '', name: '', quantity: 1, unit: '件' }]);
  };

  const updateItem = (idx: number, field: keyof ReplenishmentItem, value: string | number) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setItems(newItems);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createApplication({
        store_id: storeId,
        items: items.filter(i => i.sku && i.name),
        evidence_store_replenishment: evStore || null,
        evidence_delivery_confirmation: evDelivery || null,
        evidence_registration: evReg || null,
        remarks: remarks || null,
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

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
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
            新建补货申请
          </h3>
          <button
            onClick={onClose}
            style={{
              width: '28px',
              height: '28px',
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

        <form onSubmit={handleSubmit} style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {error && (
            <div style={{
              padding: '10px',
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

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#374151',
            }}>
              门店 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={storeId}
              onChange={e => setStoreId(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                background: 'white',
              }}
            >
              {stores.map(s => (
                <option key={s.id} value={s.id}>
                  {s.store_no} - {s.store_name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
                补货商品 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <button
                type="button"
                onClick={addItem}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#4b5563',
                }}
              >
                + 添加
              </button>
            </div>
            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{
                      padding: '6px 8px',
                      textAlign: 'left',
                      fontWeight: 500,
                      color: '#6b7280',
                      fontSize: '11px',
                    }}>SKU</th>
                    <th style={{
                      padding: '6px 8px',
                      textAlign: 'left',
                      fontWeight: 500,
                      color: '#6b7280',
                      fontSize: '11px',
                    }}>商品名称</th>
                    <th style={{
                      padding: '6px 8px',
                      textAlign: 'right',
                      fontWeight: 500,
                      color: '#6b7280',
                      fontSize: '11px',
                      width: '70px',
                    }}>数量</th>
                    <th style={{
                      padding: '6px 8px',
                      textAlign: 'left',
                      fontWeight: 500,
                      color: '#6b7280',
                      fontSize: '11px',
                      width: '60px',
                    }}>单位</th>
                    <th style={{ width: '30px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '4px 6px' }}>
                        <input
                          value={item.sku}
                          onChange={e => updateItem(idx, 'sku', e.target.value)}
                          placeholder="SKU"
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
                      <td style={{ padding: '4px 6px' }}>
                        <input
                          value={item.name}
                          onChange={e => updateItem(idx, 'name', e.target.value)}
                          placeholder="商品名称"
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
                      <td style={{ padding: '4px 6px' }}>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '12px',
                            textAlign: 'right',
                            boxSizing: 'border-box',
                          }}
                        />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <input
                          value={item.unit}
                          onChange={e => updateItem(idx, 'unit', e.target.value)}
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
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            style={{
                              color: '#ef4444',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '16px',
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#374151',
            }}>
              门店补货凭证
            </label>
            <input
              value={evStore}
              onChange={e => setEvStore(e.target.value)}
              placeholder="请输入凭证文件名或URL"
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

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#374151',
            }}>
              配送确认单
            </label>
            <input
              value={evDelivery}
              onChange={e => setEvDelivery(e.target.value)}
              placeholder="请输入配送单文件名或URL"
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

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#374151',
            }}>
              补货申请登记凭证
            </label>
            <input
              value={evReg}
              onChange={e => setEvReg(e.target.value)}
              placeholder="请输入登记凭证文件名或URL"
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

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#374151',
            }}>
              备注
            </label>
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              rows={2}
              placeholder="请输入备注信息（可选）"
              style={{
                width: '100%',
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
        </form>

        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end',
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer',
              color: '#374151',
            }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: '8px 18px',
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '创建中...' : '创建申请'}
          </button>
        </div>
      </div>
    </div>
  );
}
