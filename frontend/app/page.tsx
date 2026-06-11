'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getApplications, getStatistics } from '@/lib/api';
import type { AccountApplication, Statistics } from '@/lib/types';
import StatsPanel from '@/components/StatsPanel';
import ApplicationList from '@/components/ApplicationList';

export default function HomePage() {
  const [applications, setApplications] = useState<AccountApplication[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{
    stage?: string;
    status?: string;
    risk_level?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appsRes, statsRes] = await Promise.all([
        getApplications(filters),
        getStatistics(),
      ]);

      if (appsRes.code === 0 && appsRes.data) {
        setApplications(appsRes.data);
      }
      if (statsRes.code === 0 && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err: any) {
      setError(err.message || '加载数据失败，请检查后端服务是否启动');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadData]);

  const handleFilterChange = (newFilters: {
    status?: string;
    risk_level?: string;
    stage?: string;
  }) => {
    setFilters(newFilters);
  };

  const clearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.keys(filters).length > 0 && Object.values(filters).some(v => v);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                银行网点-风险分级处置开户申请系统
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                开户预约 → 资料审核 → 账户启用 | 风险分级 | 操作留痕
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
                前端端口: <span className="font-mono font-semibold">3002</span>
                {' | '}
                后端端口: <span className="font-mono font-semibold">8002</span>
              </div>
              <button
                onClick={loadData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                刷新数据
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            <div className="font-medium">⚠️ {error}</div>
            <div className="text-sm mt-1">
              请确认后端服务已启动：<code className="bg-red-100 px-2 py-0.5 rounded">cd backend && source .venv/bin/activate && python run.py</code>
            </div>
          </div>
        )}

        {stats && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">数据统计</h2>
            <StatsPanel stats={stats} onFilterChange={handleFilterChange} />
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">开户申请队列</h2>
            {hasActiveFilters && (
              <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                已筛选
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              共 <span className="font-semibold text-gray-900">{applications.length}</span> 条记录
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                清除筛选
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilters({})}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !filters.status && !filters.risk_level && !filters.stage
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => setFilters({ status: '待签收' })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filters.status === '待签收'
                ? 'bg-yellow-500 text-white'
                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
            }`}
          >
            待签收
          </button>
          <button
            onClick={() => setFilters({ status: '异常回传' })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filters.status === '异常回传'
                ? 'bg-red-500 text-white'
                : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
          >
            异常回传
          </button>
          <button
            onClick={() => setFilters({ status: '签收完成' })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filters.status === '签收完成'
                ? 'bg-green-500 text-white'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            签收完成
          </button>
          <div className="w-px bg-gray-300 mx-1"></div>
          <button
            onClick={() => setFilters({ risk_level: 'high' })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filters.risk_level === 'high'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
            }`}
          >
            🔴 高风险
          </button>
          <button
            onClick={() => setFilters({ risk_level: 'medium' })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filters.risk_level === 'medium'
                ? 'bg-amber-500 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            🟡 中风险
          </button>
          <button
            onClick={() => setFilters({ risk_level: 'low' })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filters.risk_level === 'low'
                ? 'bg-green-600 text-white'
                : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
            }`}
          >
            🟢 低风险
          </button>
        </div>

        <ApplicationList applications={applications} loading={loading} />

        <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <h3 className="font-medium text-gray-900 mb-2">岗位权限说明</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="bg-white p-3 rounded-lg border border-gray-100">
              <div className="font-semibold text-blue-600 mb-1">👤 客户经理</div>
              <div>负责「开户预约」阶段处理，可推进到资料审核，不能替运营主管推进</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-gray-100">
              <div className="font-semibold text-purple-600 mb-1">👔 运营主管</div>
              <div>负责「资料审核」阶段处理，可推进到账户启用，不能替支行行长归档</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-gray-100">
              <div className="font-semibold text-red-600 mb-1">🎩 支行行长</div>
              <div>负责「账户启用」阶段最终审批，完成归档（签收完成）</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
