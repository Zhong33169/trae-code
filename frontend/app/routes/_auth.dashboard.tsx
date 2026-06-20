import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '~/api/client';

export const Route = createFileRoute('/_auth/dashboard')({
  component: Dashboard,
});

interface OrderAmountByStatus {
  status: string;
  status_name: string;
  count: number;
  amount: number;
}

interface DashboardStats {
  ar_total: number;
  ar_total_amount: number;
  ar_pending: number;
  ar_confirmed: number;
  order_total: number;
  order_draft: number;
  order_pending_audit: number;
  order_pending_review: number;
  order_archived: number;
  order_returned: number;
  verification_total: number;
  verification_total_amount: number;
  order_amount_by_status: OrderAmountByStatus[];
}

function Dashboard() {
  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get<DashboardStats>('/stats');
      return res.data!;
    },
  });

  const cards = data
    ? [
        {
          title: '应收账款总数',
          value: `${data.ar_total} 笔`,
          subValue: `合计 ${data.ar_total_amount.toLocaleString()} 元`,
          color: 'bg-blue-500',
          link: '/accounts-receivable',
        },
        {
          title: '确权单总数',
          value: `${data.order_total} 笔`,
          subValue: '确权单管理',
          color: 'bg-indigo-500',
          link: '/confirmation-orders',
        },
        {
          title: '待审核确权单',
          value: `${data.order_pending_audit} 笔`,
          subValue: '需尽快处理',
          color: 'bg-yellow-500',
          link: '/confirmation-orders?status=pending_audit',
        },
        {
          title: '待复核确权单',
          value: `${data.order_pending_review} 笔`,
          subValue: '需尽快处理',
          color: 'bg-orange-500',
          link: '/confirmation-orders?status=pending_review',
        },
        {
          title: '已归档确权单',
          value: `${data.order_archived} 笔`,
          subValue: '已完成',
          color: 'bg-green-500',
          link: '/confirmation-orders?status=archived',
        },
        {
          title: '回款核销',
          value: `${data.verification_total} 笔`,
          subValue: `总核销 ${data.verification_total_amount.toLocaleString()} 元`,
          color: 'bg-teal-500',
          link: '/payment-verifications',
        },
      ]
    : [];

  const statusCards = data && data.order_amount_by_status
    ? data.order_amount_by_status.map((item) => ({
        label: item.status_name,
        count: item.count,
        amount: item.amount,
        color: getStatusColor(item.status),
      }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">统计看板</h1>
        <p className="text-gray-500 mt-1">业务数据总览</p>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-500">加载中...</div>
      ) : error ? (
        <div className="text-center py-16 text-red-500">加载失败：{error instanceof Error ? error.message : '未知错误'}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card) => (
              <Link
                key={card.title}
                to={card.link}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="flex">
                  <div className={`w-2 ${card.color}`} />
                  <div className="flex-1 p-5">
                    <p className="text-sm text-gray-500">{card.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{card.value}</p>
                    <p className="text-xs text-gray-400 mt-1">{card.subValue}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">确权单状态分布</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {statusCards.map((item) => (
                <div key={item.label} className="text-center p-4 rounded-lg border border-gray-100">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mb-2 ${item.color}`}>
                    {item.label}
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{item.count}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.amount.toLocaleString()} 元</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-800';
    case 'pending_audit':
      return 'bg-yellow-100 text-yellow-800';
    case 'returned':
      return 'bg-red-100 text-red-800';
    case 'pending_review':
      return 'bg-blue-100 text-blue-800';
    case 'archived':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
