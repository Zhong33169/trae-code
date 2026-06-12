'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Stats, RepairOrder } from '@/lib/types';
import { fetchStats, fetchOrders } from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  submitted: '已提交',
  under_review: '审核中',
  returned: '已退回',
  review_approved: '审核通过',
  under_recheck: '复核中',
  archived: '已归档',
  rejected: '已驳回',
};

const URGENCY_LABELS: Record<string, string> = {
  low: '一般',
  medium: '中等',
  high: '紧急',
  urgent: '特急',
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status] || status}</span>;
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const cls: Record<string, string> = {
    low: 'urgency-low',
    medium: 'urgency-medium',
    high: 'urgency-high',
    urgent: 'urgency-urgent',
  };
  return <span className={`badge ${cls[urgency] || ''}`}>{URGENCY_LABELS[urgency] || urgency}</span>;
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RepairOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    const [s, o] = await Promise.all([
      fetchStats().catch(() => null),
      fetchOrders({ limit: 5 }).catch(() => null),
    ]);
    setStats(s);
    setRecentOrders(o?.items || []);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const handler = () => {
      loadAll();
    };
    window.addEventListener('order-state-changed', handler);
    return () => window.removeEventListener('order-state-changed', handler);
  }, []);

  const statCards = stats
    ? [
        { key: 'total', label: '总工单', count: stats.total, color: 'bg-slate-600' },
        { key: 'draft', label: '待提交', count: stats.draft, color: 'bg-slate-400' },
        { key: 'submitted', label: '已提交', count: stats.submitted, color: 'bg-blue-500' },
        { key: 'under_review', label: '审核中', count: stats.under_review, color: 'bg-amber-500' },
        { key: 'returned', label: '已退回', count: stats.returned, color: 'bg-orange-500' },
        { key: 'review_approved', label: '审核通过', count: stats.review_approved, color: 'bg-green-500' },
        { key: 'under_recheck', label: '复核中', count: stats.under_recheck, color: 'bg-purple-500' },
        { key: 'archived', label: '已归档', count: stats.archived, color: 'bg-emerald-600' },
        { key: 'rejected', label: '已驳回', count: stats.rejected, color: 'bg-red-500' },
      ]
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">系统概览</h1>
        <Link href="/orders/new" className="btn-primary">
          + 新建工单
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <div key={card.key} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{card.label}</span>
              <span className={`${card.color} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>
                {card.count}
              </span>
            </div>
            <div className="mt-2 text-3xl font-bold text-slate-800">{card.count}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">最近工单</h2>
        </div>
        {recentOrders.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-400">暂无工单记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">工单编号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">标题</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">企业名称</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">紧急程度</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">更新时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm">
                      <Link href={`/orders/${order.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                        {order.order_no}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{order.title}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{order.enterprise_name}</td>
                    <td className="px-6 py-4 text-sm">
                      <UrgencyBadge urgency={order.urgency} />
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(order.updated_at).toLocaleString('zh-CN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
