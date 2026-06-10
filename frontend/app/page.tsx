'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getStats, getRecords } from '@/lib/api';
import { StatsResponse, BorrowRecord, STATUS_MAP, EXCEPTION_MAP, STATUS_COLORS, EXCEPTION_COLORS } from '@/lib/types';

export default function Home() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [recentRecords, setRecentRecords] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsRes, recordsRes] = await Promise.all([
          getStats(),
          getRecords(),
        ]);
        if (statsRes.success && statsRes.data) {
          setStats(statsRes.data);
        }
        if (recordsRes.success && recordsRes.data) {
          setRecentRecords((recordsRes.data as BorrowRecord[]).slice(0, 5));
        }
      } catch (e) {
        console.error('加载数据失败', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return <div className="text-center py-12">加载中...</div>;
  }

  const statCards = stats ? [
    { label: '总记录数', value: stats.total, color: 'bg-gray-600' },
    { label: '草稿', value: stats.draft, color: 'bg-gray-400' },
    { label: '待审核', value: stats.pending_audit, color: 'bg-yellow-500' },
    { label: '待复核', value: stats.pending_review, color: 'bg-blue-500' },
    { label: '退回补正', value: stats.returned_correction, color: 'bg-red-500' },
    { label: '已归档', value: stats.archived, color: 'bg-green-500' },
  ] : [];

  const exceptionCards = stats ? [
    { label: '缺证据', value: stats.missing_evidence, color: 'bg-orange-500' },
    { label: '逾期', value: stats.overdue, color: 'bg-red-600' },
    { label: '状态冲突', value: stats.conflict, color: 'bg-purple-500' },
  ] : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">工作台</h1>
        <p className="mt-1 text-gray-600">图书馆异常申诉复核借阅记录系统</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">流程状态统计</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white rounded-lg shadow p-4 border">
              <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center text-white font-bold mb-3`}>
                {card.value}
              </div>
              <div className="text-sm text-gray-600">{card.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">异常类型统计</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {exceptionCards.map((card) => (
            <div key={card.label} className="bg-white rounded-lg shadow p-4 border">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center text-white font-bold text-lg`}>
                  {card.value}
                </div>
                <div>
                  <div className="text-base font-medium text-gray-900">{card.label}</div>
                  <div className="text-sm text-gray-500">条异常记录</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">最近借阅记录</h2>
          <Link href="/records" className="text-sm text-blue-600 hover:text-blue-800">
            查看全部 →
          </Link>
        </div>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  记录编号
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  借阅人
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  书名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  异常
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/records/${record.id}`} className="text-blue-600 hover:text-blue-900">
                      {record.record_no}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.borrower_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.book_title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[record.status] || 'bg-gray-100 text-gray-800'}`}>
                      {STATUS_MAP[record.status] || record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.exception_type ? (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${EXCEPTION_COLORS[record.exception_type] || 'bg-gray-100 text-gray-800'}`}>
                        {EXCEPTION_MAP[record.exception_type] || record.exception_type}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">正常</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
