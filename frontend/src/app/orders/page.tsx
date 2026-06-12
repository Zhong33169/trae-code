'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RepairOrder } from '@/lib/types';
import { fetchOrders } from '@/lib/api';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'submitted', label: '已提交' },
  { value: 'under_review', label: '审核中' },
  { value: 'returned', label: '已退回' },
  { value: 'review_approved', label: '审核通过' },
  { value: 'under_recheck', label: '复核中' },
  { value: 'archived', label: '已归档' },
  { value: 'rejected', label: '已驳回' },
];

const ROLE_OPTIONS = [
  { value: '', label: '全部角色' },
  { value: 'clerk', label: '登记员' },
  { value: 'supervisor', label: '审核主管' },
  { value: 'rechecker', label: '复核负责人' },
];

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

export default function OrdersPage() {
  const [orders, setOrders] = useState<RepairOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const limit = 10;

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchOrders({
        status: statusFilter || undefined,
        handler_role: roleFilter || undefined,
        keyword: keyword || undefined,
        offset: page * limit,
        limit,
      });
      setOrders(result.items);
      setTotal(result.total);
    } catch {
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, roleFilter, keyword, page]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, roleFilter, keyword]);

  useEffect(() => {
    const handler = () => {
      loadOrders();
    };
    window.addEventListener('order-state-changed', handler);
    return () => window.removeEventListener('order-state-changed', handler);
  }, [loadOrders]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">工单列表</h1>
        <Link href="/orders/new" className="btn-primary">
          + 新建工单
        </Link>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-40">
            <label className="label-field">状态筛选</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="w-40">
            <label className="label-field">处理角色</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input-field"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="w-56">
            <label className="label-field">关键词搜索</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索工单编号/标题/企业"
              className="input-field"
            />
          </div>
          <button onClick={loadOrders} className="btn-secondary">刷新</button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="px-6 py-12 text-center text-slate-400">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400">暂无工单记录</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">工单编号</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">标题</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">企业名称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">报修类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">紧急程度</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">当前状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">当前处理人</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">更新时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm">
                        <Link href={`/orders/${order.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                          {order.order_no}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 max-w-[200px] truncate">{order.title}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{order.enterprise_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{order.repair_type}</td>
                      <td className="px-4 py-3 text-sm">
                        <UrgencyBadge urgency={order.urgency} />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {order.current_handler_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {new Date(order.updated_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Link
                          href={`/orders/${order.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          查看
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                共 {total} 条，第 {page + 1}/{totalPages || 1} 页
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
