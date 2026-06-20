import { useState } from 'react';
import { SHIFTS } from '@/lib/constants';

export interface HandoverFormData {
  shift: string;
  handover_from: number;
  handover_to: number;
  advance_reason: string;
}

interface HandoverModalProps {
  open: boolean;
  title: string;
  confirmText?: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (data: HandoverFormData) => void;
}

export function HandoverModal({
  open,
  title,
  confirmText = '确认',
  reasonLabel = '推进/退回原因',
  reasonPlaceholder = '请输入原因',
  loading = false,
  onClose,
  onConfirm,
}: HandoverModalProps) {
  const [shift, setShift] = useState('');
  const [handoverFrom, setHandoverFrom] = useState('');
  const [handoverTo, setHandoverTo] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setShift('');
    setHandoverFrom('');
    setHandoverTo('');
    setReason('');
    setErrors({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!shift) newErrors.shift = '请选择班次';
    if (!handoverFrom.trim()) newErrors.handover_from = '请输入交出人ID';
    if (isNaN(Number(handoverFrom))) newErrors.handover_from = '交出人ID必须是数字';
    if (!handoverTo.trim()) newErrors.handover_to = '请输入接收人ID';
    if (isNaN(Number(handoverTo))) newErrors.handover_to = '接收人ID必须是数字';
    if (!reason.trim()) newErrors.advance_reason = '请输入原因';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = () => {
    if (!validate()) return;
    onConfirm({
      shift,
      handover_from: Number(handoverFrom),
      handover_to: Number(handoverTo),
      advance_reason: reason.trim(),
    });
    reset();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleClose}
        />
        <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">{title}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  班次 <span className="text-red-500">*</span>
                </label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.shift ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">请选择班次</option>
                  {SHIFTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {errors.shift && <p className="mt-1 text-sm text-red-500">{errors.shift}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  交出人ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={handoverFrom}
                  onChange={(e) => setHandoverFrom(e.target.value)}
                  placeholder="请输入交出人用户ID"
                  className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.handover_from ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.handover_from && (
                  <p className="mt-1 text-sm text-red-500">{errors.handover_from}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  接收人ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={handoverTo}
                  onChange={(e) => setHandoverTo(e.target.value)}
                  placeholder="请输入接收人用户ID"
                  className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.handover_to ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.handover_to && (
                  <p className="mt-1 text-sm text-red-500">{errors.handover_to}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {reasonLabel} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={reasonPlaceholder}
                  rows={3}
                  className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.advance_reason ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.advance_reason && <p className="mt-1 text-sm text-red-500">{errors.advance_reason}</p>}
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '处理中...' : confirmText}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
