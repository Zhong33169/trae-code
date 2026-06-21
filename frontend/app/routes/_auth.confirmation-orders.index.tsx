import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, buildQueryString, type PaginatedData } from '~/api/client';
import { StatusBadge } from '~/components/StatusBadge';
import { HandoverModal, type HandoverFormData } from '~/components/HandoverModal';
import {
  CONFIRMATION_ORDER_STATUS_LABELS,
  type ConfirmationOrderStatus,
  type ActionType,
  ACTION_LABELS,
} from '~/lib/constants';

export const Route = createFileRoute('/_auth/confirmation-orders/')({
  component: ConfirmationOrdersList,
  validateSearch: (search: Record<string, unknown>) => ({
    status: (search.status as string) || '',
    keyword: (search.keyword as string) || '',
  }),
});

interface ConfirmationOrder {
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
  created_by?: number;
  created_by_name?: string;
  created_at?: string;
  verification_count?: number;
  verified_amount?: number;
  allowed_actions: ActionType[];
}

function ConfirmationOrdersList() {
  const search = Route.useSearch();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(search.status || '');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const statusFromUrl = search.status;
    if (statusFromUrl) {
      setStatusFilter(statusFromUrl);
    }
  }, [search]);

  const listQuery = useQuery<PaginatedData<ConfirmationOrder>>({
    queryKey: ['co-list', page, perPage, searchTerm, statusFilter],
    queryFn: async () => {
      const qs = buildQueryString({
        page,
        page_size: perPage,
        keyword: searchTerm,
        status: statusFilter,
      });
      const res = await api.get<PaginatedData<ConfirmationOrder>>(`/orders${qs}`);
      return res.data!;
    },
  });

  const batchSubmitMutation = useMutation({
    mutationFn: async (payload: { order_ids: number[] } & HandoverFormData) => {
      const res = await api.post(`/orders/batch-submit`, payload);
      return res;
    },
    onSuccess: (res) => {
      setToast({ type: 'success', message: res.message });
      setHandoverOpen(false);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['co-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (err) => {
      setToast({ type: 'error', message: err instanceof Error ? err.message : '操作失败' });
      setTimeout(() => setToast(null), 3000);
    },
  });

  const totalPages = listQuery.data ? Math.ceil(listQuery.data.total / perPage) : 0;
  const allItems = listQuery.data?.items || [];
  const allSelected = allItems.length > 0 && allItems.every((item) => selectedIds.has(item.id));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(keyword);
    setPage(1);
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allItems.map((item) => item.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBatchSubmit = () => {
    if (selectedIds.size === 0) {
      setToast({ type: 'error', message: '请先选择要操作的确权单' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setHandoverOpen(true);
  };

  const handleHandoverConfirm = (handover: HandoverFormData) => {
    batchSubmitMutation.mutate({
      order_ids: Array.from(selectedIds),
      ...handover,
    });
  };

  const statusOptions: { value: string; label: string }[] = [
    { value: '', label: '全部状态' },
    ...Object.entries(CONFIRMATION_ORDER_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
  ];

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">应收确权单</h1>
          <p className="text-gray-500 mt-1">确权单管理与审批</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-3 items-center flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
              if (e.target.value) {
                navigate({ search: { ...search, status: e.target.value } });
              } else {
                const { status, ...rest } = search;
                navigate({ search: rest as Record<string, unknown> });
              }
            }}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索编号、买方名称、供应商..."
            className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            搜索
          </button>
          <button
            type="button"
            onClick={() => {
              setKeyword('');
              setSearchTerm('');
              setStatusFilter('');
              setPage(1);
              const { status, ...rest } = search;
              navigate({ search: rest as Record<string, unknown> });
              listQuery.refetch();
            }}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            重置
          </button>
        </form>

        {selectedIds.size > 0 && (
          <div className="flex gap-2 items-center pt-3 border-t border-gray-100 flex-wrap">
            <span className="text-sm text-gray-600">已选 {selectedIds.size} 项：</span>
            <button
              onClick={handleBatchSubmit}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              批量提交审核
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
            >
              取消选择
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {listQuery.isLoading ? (
          <div className="text-center py-16 text-gray-500">加载中...</div>
        ) : listQuery.isError ? (
          <div className="text-center py-16 text-red-500">
            加载失败：{listQuery.error instanceof Error ? listQuery.error.message : '未知错误'}
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">编号</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">关联AR</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">买方名称</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">供应商</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金额（元）</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">确认金额</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">当前处理人</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建人</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {listQuery.data && listQuery.data.items.length > 0 ? (
                  listQuery.data.items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {item.order_no}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.ar_no}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.buyer_name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.supplier_name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {item.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                        {item.confirm_amount ? item.confirm_amount.toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.current_handler_name || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <StatusBadge status={item.status} type="confirmation" />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.created_by_name || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => navigate({ to: '/confirmation-orders/$id', params: { id: String(item.id) } })}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          详情
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={11} className="px-6 py-16 text-center text-gray-500">
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {listQuery.data && listQuery.data.total > 0 && (
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  共 <span className="font-medium">{listQuery.data.total}</span> 条，第 {page} / {totalPages} 页
                </div>
                <div className="flex gap-2 items-center">
                  <select
                    value={perPage}
                    onChange={(e) => {
                      setPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n} 条/页
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <HandoverModal
        open={handoverOpen}
        title="批量提交审核"
        confirmText="确认提交"
        loading={batchSubmitMutation.isPending}
        onClose={() => {
          setHandoverOpen(false);
        }}
        onConfirm={handleHandoverConfirm}
      />
    </div>
  );
}
