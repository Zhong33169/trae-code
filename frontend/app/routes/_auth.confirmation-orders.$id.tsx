import { useState } from 'react';
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, buildQueryString, type PaginatedData } from '~/api/client';
import { StatusBadge } from '~/components/StatusBadge';
import { HandoverModal, type HandoverFormData } from '~/components/HandoverModal';
import { type ConfirmationOrderStatus, type ActionType, ACTION_LABELS } from '~/lib/constants';

export const Route = createFileRoute('/_auth/confirmation-orders/$id')({
  component: ConfirmationOrdersDetail,
});

interface Verification {
  id: number;
  order_id: number;
  payment_amount: number;
  payment_date: string;
  payer_name: string;
  bank_slip_no?: string;
  remark?: string;
  created_at?: string;
}

interface ConfirmationOrderDetail {
  id: number;
  order_no: string;
  ar_id: number;
  ar_no: string;
  buyer_name: string;
  supplier_name: string;
  amount: number;
  confirm_amount?: number;
  status: ConfirmationOrderStatus;
  status_name: string;
  current_handler_role?: string;
  current_handler_name?: string;
  reject_reason?: string;
  advance_reason?: string;
  shift?: string;
  handover_from?: number;
  handover_from_name?: string;
  handover_to?: number;
  handover_to_name?: string;
  handover_time?: string;
  created_by?: number;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
  verification_count?: number;
  verified_amount?: number;
  allowed_actions: ActionType[];
  visible_fields: string[];
}

function ConfirmationOrdersDetail() {
  const { id } = useParams({ from: Route.fullPath });
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<ActionType | null>(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnErrors, setReturnErrors] = useState('');
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [verificationForm, setVerificationForm] = useState({
    payment_amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payer_name: '',
    bank_slip_no: '',
    remark: '',
  });
  const [verificationErrors, setVerificationErrors] = useState<Record<string, string>>({});

  const detailQuery = useQuery<ConfirmationOrderDetail>({
    queryKey: ['co-detail', id],
    queryFn: async () => {
      const res = await api.get<ConfirmationOrderDetail>(`/orders/${id}`);
      return res.data!;
    },
    enabled: !!id,
  });

  const verificationsQuery = useQuery<PaginatedData<Verification>>({
    queryKey: ['order-verifications', id],
    queryFn: async () => {
      const qs = buildQueryString({ order_id: Number(id), page: 1, page_size: 100 });
      const res = await api.get<PaginatedData<Verification>>(`/verifications${qs}`);
      return res.data!;
    },
    enabled: !!id,
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: { order_id: number } & HandoverFormData) => {
      const res = await api.post(`/orders/submit`, payload);
      return res;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (payload: { order_id: number; confirm_amount?: number } & HandoverFormData) => {
      const res = await api.post(`/orders/approve`, payload);
      return res;
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (payload: { order_id: number; reject_reason: string }) => {
      const res = await api.post(`/orders/reject`, payload);
      return res;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (payload: { order_id: number } & HandoverFormData) => {
      const res = await api.post(`/orders/review`, payload);
      return res;
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (payload: { order_id: number; advance_reason: string }) => {
      const res = await api.post(`/orders/archive`, payload);
      return res;
    },
  });

  const resubmitMutation = useMutation({
    mutationFn: async (payload: { order_id: number } & HandoverFormData) => {
      const res = await api.post(`/orders/submit`, payload);
      return res;
    },
  });

  const createVerificationMutation = useMutation({
    mutationFn: async (payload: {
      order_id: number;
      payment_amount: number;
      payment_date: string;
      payer_name?: string;
      bank_slip_no?: string;
      remark?: string;
    }) => {
      const res = await api.post(`/verifications`, payload);
      return res;
    },
  });

  const handleMutationSuccess = (message: string) => {
    setToast({ type: 'success', message });
    setHandoverOpen(false);
    setReturnModalOpen(false);
    setVerificationModalOpen(false);
    setCurrentAction(null);
    setReturnReason('');
    setReturnErrors('');
    setVerificationErrors({});
    queryClient.invalidateQueries({ queryKey: ['co-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['co-list'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['order-verifications', id] });
    setTimeout(() => setToast(null), 3000);
  };

  const handleMutationError = (err: unknown) => {
    setToast({ type: 'error', message: err instanceof Error ? err.message : '操作失败' });
    setTimeout(() => setToast(null), 3000);
  };

  const handleActionClick = (action: ActionType) => {
    if (action === 'reject') {
      setCurrentAction(action);
      setReturnModalOpen(true);
    } else if (action === 'archive') {
      setCurrentAction(action);
      setHandoverOpen(true);
    } else if (action === 'create_verification') {
      setVerificationForm({
        payment_amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payer_name: '',
        bank_slip_no: '',
        remark: '',
      });
      setVerificationErrors({});
      setVerificationModalOpen(true);
    } else {
      setCurrentAction(action);
      setHandoverOpen(true);
    }
  };

  const validateVerificationForm = () => {
    const errors: Record<string, string> = {};
    if (!verificationForm.payment_amount || Number(verificationForm.payment_amount) <= 0) {
      errors.payment_amount = '回款金额必须大于0';
    }
    if (!verificationForm.payment_date) {
      errors.payment_date = '回款日期不能为空';
    }
    setVerificationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleVerificationSubmit = () => {
    if (!validateVerificationForm() || !id) return;

    const confirmAmt = data?.confirm_amount ?? data?.amount ?? 0;
    const verifiedAmt = data?.verified_amount ?? 0;
    const newAmt = Number(verificationForm.payment_amount);

    if (verifiedAmt + newAmt > confirmAmt + 0.01) {
      setVerificationErrors({
        payment_amount: `累计核销金额（${(verifiedAmt + newAmt).toFixed(2)}）超过确权金额（${confirmAmt.toFixed(2)}）`,
      });
      return;
    }

    createVerificationMutation.mutate(
      {
        order_id: Number(id),
        payment_amount: newAmt,
        payment_date: verificationForm.payment_date,
        payer_name: verificationForm.payer_name || undefined,
        bank_slip_no: verificationForm.bank_slip_no || undefined,
        remark: verificationForm.remark || undefined,
      },
      {
        onSuccess: (res) => handleMutationSuccess(res.message),
        onError: handleMutationError,
      }
    );
  };

  const handleHandoverConfirm = (handover: HandoverFormData) => {
    if (!id || !currentAction) return;
    const orderId = Number(id);

    switch (currentAction) {
      case 'submit':
        submitMutation.mutate(
          { order_id: orderId, ...handover },
          {
            onSuccess: (res) => handleMutationSuccess(res.message),
            onError: handleMutationError,
          }
        );
        break;
      case 'approve':
        approveMutation.mutate(
          { order_id: orderId, ...handover },
          {
            onSuccess: (res) => handleMutationSuccess(res.message),
            onError: handleMutationError,
          }
        );
        break;
      case 'review':
        reviewMutation.mutate(
          { order_id: orderId, ...handover },
          {
            onSuccess: (res) => handleMutationSuccess(res.message),
            onError: handleMutationError,
          }
        );
        break;
      case 'resubmit':
        resubmitMutation.mutate(
          { order_id: orderId, ...handover },
          {
            onSuccess: (res) => handleMutationSuccess(res.message),
            onError: handleMutationError,
          }
        );
        break;
      case 'archive':
        archiveMutation.mutate(
          { order_id: orderId, advance_reason: handover.advance_reason },
          {
            onSuccess: (res) => handleMutationSuccess(res.message),
            onError: handleMutationError,
          }
        );
        break;
    }
  };

  const handleReturnConfirm = () => {
    if (!returnReason.trim()) {
      setReturnErrors('请填写退回原因');
      return;
    }
    if (!id || !currentAction) return;
    rejectMutation.mutate(
      { order_id: Number(id), reject_reason: returnReason.trim() },
      {
        onSuccess: (res) => handleMutationSuccess(res.message),
        onError: handleMutationError,
      }
    );
  };

  const isMutationPending =
    submitMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending ||
    reviewMutation.isPending ||
    archiveMutation.isPending ||
    resubmitMutation.isPending ||
    createVerificationMutation.isPending;

  const getActionButtonClass = (action: ActionType) => {
    const base = 'px-4 py-2 rounded-md text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
    switch (action) {
      case 'submit':
      case 'resubmit':
        return `${base} bg-blue-600 hover:bg-blue-700`;
      case 'approve':
        return `${base} bg-green-600 hover:bg-green-700`;
      case 'reject':
        return `${base} bg-yellow-600 hover:bg-yellow-700`;
      case 'review':
        return `${base} bg-teal-600 hover:bg-teal-700`;
      case 'archive':
        return `${base} bg-purple-600 hover:bg-purple-700`;
      case 'delete':
        return `${base} bg-red-600 hover:bg-red-700`;
      case 'edit':
        return `${base} bg-gray-600 hover:bg-gray-700`;
      case 'create_verification':
        return `${base} bg-emerald-600 hover:bg-emerald-700`;
      default:
        return `${base} bg-gray-600 hover:bg-gray-700`;
    }
  };

  const data = detailQuery.data;
  const verifications = verificationsQuery.data?.items || [];

  if (detailQuery.isLoading) return <div className="text-center py-16 text-gray-500">加载中...</div>;
  if (detailQuery.isError)
    return (
      <div className="text-center py-16 text-red-500">
        加载失败：{detailQuery.error instanceof Error ? detailQuery.error.message : '未知错误'}
      </div>
    );
  if (!data) return null;

  const visibleFields = data.visible_fields || [];
  const shouldShow = (field: string) => visibleFields.length === 0 || visibleFields.includes(field);

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-md shadow-lg text-white ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: '/confirmation-orders' })}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">应收确权单详情</h1>
            <p className="text-gray-500 mt-1">编号：{data.order_no}</p>
          </div>
          <StatusBadge status={data.status} type="confirmation" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {data.allowed_actions
            .filter((a) => a !== 'view')
            .map((action) => (
              <button
                key={action}
                onClick={() => handleActionClick(action)}
                disabled={isMutationPending}
                className={getActionButtonClass(action)}
              >
                {ACTION_LABELS[action]}
              </button>
            ))}
        </div>
      </div>

      {data.reject_reason && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex gap-2">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">退回原因</p>
              <p className="mt-1 text-sm text-yellow-700">{data.reject_reason}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">基本信息</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <span className="text-sm text-gray-500">确权单编号</span>
            <p className="mt-1 font-medium text-gray-900">{data.order_no}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">关联AR编号</span>
            <p className="mt-1 font-medium text-blue-600">
              <button onClick={() => navigate({ to: '/accounts-receivable/$id', params: { id: String(data.ar_id) } })} className="hover:underline">
                {data.ar_no}
              </button>
            </p>
          </div>
          {shouldShow('buyer_name') && (
            <div>
              <span className="text-sm text-gray-500">买方名称</span>
              <p className="mt-1 font-medium text-gray-900">{data.buyer_name}</p>
            </div>
          )}
          {shouldShow('supplier_name') && (
            <div>
              <span className="text-sm text-gray-500">供应商</span>
              <p className="mt-1 font-medium text-gray-900">{data.supplier_name}</p>
            </div>
          )}
          {shouldShow('amount') && (
            <div>
              <span className="text-sm text-gray-500">确权金额（元）</span>
              <p className="mt-1 font-semibold text-blue-600">{data.amount.toLocaleString()}</p>
            </div>
          )}
          {shouldShow('confirm_amount') && (
            <div>
              <span className="text-sm text-gray-500">确认金额（元）</span>
              <p className="mt-1 font-semibold text-green-600">
                {data.confirm_amount ? data.confirm_amount.toLocaleString() : '-'}
              </p>
            </div>
          )}
          {shouldShow('current_handler') && (
            <div>
              <span className="text-sm text-gray-500">当前处理人</span>
              <p className="mt-1 font-medium text-gray-900">{data.current_handler_name || '-'}</p>
            </div>
          )}
          <div>
            <span className="text-sm text-gray-500">创建人</span>
            <p className="mt-1 font-medium text-gray-900">{data.created_by_name || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">创建时间</span>
            <p className="mt-1 font-medium text-gray-900">{data.created_at || '-'}</p>
          </div>
          {shouldShow('handover_info') && (
            <>
              <div>
                <span className="text-sm text-gray-500">班次</span>
                <p className="mt-1 font-medium text-gray-900">{data.shift || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">交出人</span>
                <p className="mt-1 font-medium text-gray-900">{data.handover_from_name || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">接收人</span>
                <p className="mt-1 font-medium text-gray-900">{data.handover_to_name || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">交接时间</span>
                <p className="mt-1 font-medium text-gray-900">{data.handover_time || '-'}</p>
              </div>
            </>
          )}
          {shouldShow('advance_reason') && (
            <div className="col-span-2">
              <span className="text-sm text-gray-500">推进/退回原因</span>
              <p className="mt-1 font-medium text-gray-900 whitespace-pre-wrap">{data.advance_reason || '-'}</p>
            </div>
          )}
          <div>
            <span className="text-sm text-gray-500">核销次数</span>
            <p className="mt-1 font-medium text-gray-900">{data.verification_count ?? 0}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">已核销金额（元）</span>
            <p className="mt-1 font-medium text-green-600">{(data.verified_amount ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">回款核销记录（{verifications.length} 笔）</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">回款日期</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">付款人</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">回款金额（元）</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">银行回单号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">备注</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {verifications.length > 0 ? (
                verifications.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {v.payment_date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {v.payer_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                      {v.payment_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {v.bank_slip_no || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {v.remark || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    暂无核销记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <HandoverModal
        open={handoverOpen}
        title={currentAction ? ACTION_LABELS[currentAction] : '操作'}
        confirmText={`确认${currentAction ? ACTION_LABELS[currentAction] : '操作'}`}
        reasonLabel={currentAction === 'archive' ? '归档原因' : '推进/退回原因'}
        reasonPlaceholder={currentAction === 'archive' ? '请输入归档原因' : '请输入原因'}
        loading={isMutationPending}
        onClose={() => {
          setHandoverOpen(false);
          setCurrentAction(null);
        }}
        onConfirm={handleHandoverConfirm}
      />

      {returnModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => {
                setReturnModalOpen(false);
                setCurrentAction(null);
                setReturnReason('');
                setReturnErrors('');
              }}
            />
            <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  {currentAction ? ACTION_LABELS[currentAction] : '退回'}
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    退回原因 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={returnReason}
                    onChange={(e) => {
                      setReturnReason(e.target.value);
                      if (returnErrors) setReturnErrors('');
                    }}
                    placeholder="请填写退回原因"
                    rows={4}
                    className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      returnErrors ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {returnErrors && <p className="mt-1 text-sm text-red-500">{returnErrors}</p>}
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
                <button
                  type="button"
                  onClick={handleReturnConfirm}
                  disabled={isMutationPending}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-yellow-600 text-base font-medium text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isMutationPending ? '处理中...' : '确认退回'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReturnModalOpen(false);
                    setCurrentAction(null);
                    setReturnReason('');
                    setReturnErrors('');
                  }}
                  disabled={isMutationPending}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {verificationModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => {
                setVerificationModalOpen(false);
                setVerificationErrors({});
              }}
            />
            <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  新增回款核销
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      确权金额（元）
                    </label>
                    <p className="text-lg font-semibold text-blue-600">
                      {(data?.confirm_amount ?? data?.amount ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      已核销金额（元）
                    </label>
                    <p className="text-lg font-semibold text-green-600">
                      {(data?.verified_amount ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      剩余可核销（元）
                    </label>
                    <p className="text-lg font-semibold text-gray-600">
                      {((data?.confirm_amount ?? data?.amount ?? 0) - (data?.verified_amount ?? 0)).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      本次回款金额（元） <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={verificationForm.payment_amount}
                      onChange={(e) => {
                        setVerificationForm({ ...verificationForm, payment_amount: e.target.value });
                        if (verificationErrors.payment_amount) {
                          setVerificationErrors({ ...verificationErrors, payment_amount: '' });
                        }
                      }}
                      placeholder="请输入回款金额"
                      className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        verificationErrors.payment_amount ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {verificationErrors.payment_amount && (
                      <p className="mt-1 text-sm text-red-500">{verificationErrors.payment_amount}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      回款日期 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={verificationForm.payment_date}
                      onChange={(e) => {
                        setVerificationForm({ ...verificationForm, payment_date: e.target.value });
                        if (verificationErrors.payment_date) {
                          setVerificationErrors({ ...verificationErrors, payment_date: '' });
                        }
                      }}
                      className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        verificationErrors.payment_date ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {verificationErrors.payment_date && (
                      <p className="mt-1 text-sm text-red-500">{verificationErrors.payment_date}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      付款人名称
                    </label>
                    <input
                      type="text"
                      value={verificationForm.payer_name}
                      onChange={(e) => setVerificationForm({ ...verificationForm, payer_name: e.target.value })}
                      placeholder="请输入付款人名称"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      银行回单号
                    </label>
                    <input
                      type="text"
                      value={verificationForm.bank_slip_no}
                      onChange={(e) => setVerificationForm({ ...verificationForm, bank_slip_no: e.target.value })}
                      placeholder="请输入银行回单号"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      备注
                    </label>
                    <textarea
                      value={verificationForm.remark}
                      onChange={(e) => setVerificationForm({ ...verificationForm, remark: e.target.value })}
                      placeholder="请输入备注（可选）"
                      rows={3}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
                <button
                  type="button"
                  onClick={handleVerificationSubmit}
                  disabled={isMutationPending}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-emerald-600 text-base font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createVerificationMutation.isPending ? '处理中...' : '确认核销'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVerificationModalOpen(false);
                    setVerificationErrors({});
                  }}
                  disabled={isMutationPending}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
