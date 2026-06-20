'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface BatchResult {
  handover_id: number;
  quote_id: number;
  quote_no: string;
  success: boolean;
  action: string;
  message: string;
  new_handler?: string;
  new_shift?: string;
  error_code?: string;
}

export interface BatchConfirmResponse {
  message: string;
  batch_id: string;
  total: number;
  success_count: number;
  fail_count: number;
  results: BatchResult[];
}

interface Props {
  open: boolean;
  action: 'confirm' | 'reject' | null;
  selectedCount: number;
  handoverIDs: number[];
  onClose: () => void;
  onCompleted: (data: BatchConfirmResponse) => void;
}

export default function BatchHandoverModal({ open, action, selectedCount, handoverIDs, onClose, onCompleted }: Props) {
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open || !action) return null;

  const execute = async () => {
    if (action === 'reject' && !remark.trim()) return;
    if (handoverIDs.length === 0) return;

    setLoading(true);
    const items = handoverIDs.map(hid => ({
      handover_id: hid,
      action,
      remark: action === 'reject' ? remark : remark || '批量接收',
    }));

    const r = await apiFetch<BatchConfirmResponse>('/api/handovers/batch-confirm', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });

    setLoading(false);
    if (!r.ok) {
      alert(r.error || '批量处理失败');
      onClose();
      return;
    }
    setRemark('');
    onCompleted(r.data!);
  };

  return (
    <div className="modal-mask" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span>{action === 'confirm' ? '批量确认接收交接' : '批量拒绝交接'}</span>
          <button className="text-gray-400 hover:text-gray-700 text-lg leading-none" onClick={onClose}>×</button>
        </div>
        <div className="modal-body space-y-3">
          <div className="alert alert-info">
            已选择 <b>{selectedCount}</b> 条待接收交接{action === 'confirm' ? '进行批量接收' : '进行批量拒绝'}
          </div>
          <div>
            <label className="label">{action === 'confirm' ? '批量备注（可选）' : '拒绝原因 *'}</label>
            <textarea className="textarea" value={remark} onChange={e => setRemark(e.target.value)}
              placeholder={action === 'confirm' ? '如：已了解情况，后续跟进' : '请详细说明拒绝原因'} />
          </div>
          <div className="text-xs text-gray-500">
            提示：后端会逐条独立校验权限、状态、拒绝原因等，成功/失败逐条返回结果；
            服务经理可代处理所有人的交接，其他角色仅能处理交接给自己的单。
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button
            className={`btn ${action === 'confirm' ? 'btn-success' : 'btn-danger'}`}
            disabled={loading || (action === 'reject' && !remark.trim())}
            onClick={execute}>
            {loading ? '处理中...' : `确认${action === 'confirm' ? '接收' : '拒绝'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
