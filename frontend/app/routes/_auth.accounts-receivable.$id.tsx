import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api, buildQueryString, type PaginatedData } from '~/api/client';
import { StatusBadge } from '~/components/StatusBadge';
import type { ConfirmationOrderStatus } from '~/lib/constants';

export const Route = createFileRoute('/_auth/accounts-receivable/$id')({
  component: AccountsReceivableDetail,
});

interface LinkedOrder {
  id: number;
  order_no: string;
  ar_no: string;
  amount: number;
  confirm_amount?: number;
  status: ConfirmationOrderStatus;
  status_name: string;
  created_at?: string;
}

interface ARDetail {
  id: number;
  ar_no: string;
  buyer_name: string;
  supplier_name: string;
  amount: number;
  invoice_no?: string;
  invoice_date?: string;
  due_date?: string;
  status: string;
  status_name: string;
  remark?: string;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  confirmation_count?: number;
  verified_amount?: number;
}

function AccountsReceivableDetail() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();

  const { data, isLoading, error } = useQuery<ARDetail>({
    queryKey: ['ar-detail', id],
    queryFn: async () => {
      const res = await api.get<ARDetail>(`/ar/${id}`);
      return res.data!;
    },
    enabled: !!id,
  });

  const { data: ordersData } = useQuery<PaginatedData<LinkedOrder>>({
    queryKey: ['ar-orders', id],
    queryFn: async () => {
      const qs = buildQueryString({ ar_id: Number(id), page: 1, page_size: 100 });
      const res = await api.get<PaginatedData<LinkedOrder>>(`/orders${qs}`);
      return res.data!;
    },
    enabled: !!id,
  });

  const linkedOrders = ordersData?.items || [];

  if (isLoading) return <div className="text-center py-16 text-gray-500">加载中...</div>;
  if (error) return <div className="text-center py-16 text-red-500">加载失败：{error instanceof Error ? error.message : '未知错误'}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: '/accounts-receivable' })}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">应收账款详情</h1>
            <p className="text-gray-500 mt-1">编号：{data.ar_no}</p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            data.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {data.status_name || data.status}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">基本信息</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <span className="text-sm text-gray-500">买方名称</span>
            <p className="mt-1 font-medium text-gray-900">{data.buyer_name}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">供应商</span>
            <p className="mt-1 font-medium text-gray-900">{data.supplier_name}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">发票号码</span>
            <p className="mt-1 font-medium text-gray-900">{data.invoice_no || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">发票日期</span>
            <p className="mt-1 font-medium text-gray-900">{data.invoice_date || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">到期日期</span>
            <p className="mt-1 font-medium text-gray-900">{data.due_date || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">金额（元）</span>
            <p className="mt-1 font-semibold text-blue-600">{data.amount.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">确权次数</span>
            <p className="mt-1 font-medium text-gray-900">{data.confirmation_count ?? 0}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">已核销金额（元）</span>
            <p className="mt-1 font-medium text-green-600">{(data.verified_amount ?? 0).toLocaleString()}</p>
          </div>
          <div className="col-span-2">
            <span className="text-sm text-gray-500">备注</span>
            <p className="mt-1 font-medium text-gray-900 whitespace-pre-wrap">{data.remark || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">创建时间</span>
            <p className="mt-1 font-medium text-gray-900">{data.created_at || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">更新时间</span>
            <p className="mt-1 font-medium text-gray-900">{data.updated_at || '-'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">关联的确权单（{linkedOrders.length} 笔）</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">确权单编号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">确权金额（元）</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">确认金额（元）</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {linkedOrders.length > 0 ? (
                linkedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                      {order.order_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.confirm_amount ? order.confirm_amount.toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={order.status} type="confirmation" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => navigate({ to: '/confirmation-orders/$id', params: { id: String(order.id) } })}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        查看
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    暂无关联的确权单
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
