'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  getApplicationDetail,
  getApplicationOperations,
  getApplicationRiskLogs,
} from '@/lib/api';
import type {
  AccountApplication,
  OperationRecord,
  RiskLevelLog,
} from '@/lib/types';
import RiskBadge from '@/components/RiskBadge';
import StatusBadge from '@/components/StatusBadge';
import StageStepper from '@/components/StageStepper';
import OperationForm from '@/components/OperationForm';
import OperationTimeline from '@/components/OperationTimeline';

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const appId = Number(params.id);

  const [application, setApplication] = useState<AccountApplication | null>(null);
  const [operations, setOperations] = useState<OperationRecord[]>([]);
  const [riskLogs, setRiskLogs] = useState<RiskLevelLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'operations'>('info');
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    if (!appId) return;
    setLoading(true);
    setError(null);
    try {
      const [appRes, opsRes, riskRes] = await Promise.all([
        getApplicationDetail(appId),
        getApplicationOperations(appId),
        getApplicationRiskLogs(appId),
      ]);

      if (appRes.code === 0 && appRes.data) {
        setApplication(appRes.data);
      } else if (appRes.code !== 0) {
        setError(appRes.message || '加载申请详情失败');
      }

      if (opsRes.code === 0 && opsRes.data) {
        setOperations(opsRes.data);
      }

      if (riskRes.code === 0 && riskRes.data) {
        setRiskLogs(riskRes.data);
      }
    } catch (err: any) {
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [appId, refreshKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOperationSuccess = (updatedData?: AccountApplication) => {
    if (updatedData) {
      setApplication(updatedData);
    }
    setRefreshKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link
              href="/"
              className="inline-flex items-center text-blue-600 hover:text-blue-800"
            >
              <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回列表
            </Link>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <div className="text-red-600 text-lg">{error || '申请不存在'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center text-gray-600 hover:text-gray-900 p-2 -ml-2 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  开户申请详情
                  <span className="ml-2 font-mono text-sm text-gray-500 font-normal">
                    {application.application_no}
                  </span>
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <RiskBadge level={application.risk_level} reason={application.risk_reason} />
                  <StatusBadge
                    status={application.status}
                    isOverdue={application.is_overdue}
                    isReturned={application.is_returned}
                  />
                  <span className="text-xs text-gray-500 font-mono">
                    版本 v{application.version}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              刷新
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-4">处理流程</h3>
          <StageStepper currentStage={application.stage} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="border-b border-gray-200">
                <nav className="flex">
                  <button
                    onClick={() => setActiveTab('info')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'info'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    基本信息
                  </button>
                  <button
                    onClick={() => setActiveTab('operations')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'operations'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    操作记录 ({operations.length + riskLogs.length})
                  </button>
                </nav>
              </div>

              <div className="p-6">
                {activeTab === 'info' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">申请人信息</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500">姓名</div>
                          <div className="font-medium text-gray-900">{application.applicant_name}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">证件号码</div>
                          <div className="font-medium text-gray-900 font-mono">{application.applicant_id_card}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">联系电话</div>
                          <div className="font-medium text-gray-900">{application.applicant_phone || '-'}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">账户类型</div>
                          <div className="font-medium text-gray-900">{application.account_type}</div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">处理信息</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500">当前阶段</div>
                          <div className="font-medium text-blue-600">{application.stage}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">当前状态</div>
                          <div className="font-medium text-gray-900">{application.status}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">当前处理人</div>
                          <div className="font-medium text-gray-900">
                            {application.current_handler_name || '未分配'}
                            {application.current_handler_role && ` (${application.current_handler_role})`}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">截止日期</div>
                          <div className={`font-medium ${application.is_overdue ? 'text-red-600' : 'text-gray-900'}`}>
                            {application.deadline
                              ? new Date(application.deadline).toLocaleDateString('zh-CN')
                              : '-'}
                            {application.is_overdue && ' (已逾期)'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {application.risk_reason && (
                      <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-lg font-semibold text-red-600 mb-2">风险原因</h3>
                        <p className="text-gray-700 bg-red-50 p-4 rounded-lg border border-red-100">
                          {application.risk_reason}
                        </p>
                      </div>
                    )}

                    {application.returned_reason && (
                      <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-lg font-semibold text-orange-600 mb-2">退回原因</h3>
                        <p className="text-gray-700 bg-orange-50 p-4 rounded-lg border border-orange-100">
                          {application.returned_reason}
                        </p>
                      </div>
                    )}

                    {application.evidences && application.evidences.length > 0 && (
                      <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">证据材料</h3>
                        <div className="space-y-2">
                          {application.evidences.map((ev) => (
                            <div
                              key={ev.id}
                              className={`flex items-center justify-between p-3 rounded-lg border ${
                                ev.is_provided === 1
                                  ? 'bg-green-50 border-green-200'
                                  : ev.is_required === 1
                                  ? 'bg-red-50 border-red-200'
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                    ev.is_provided === 1
                                      ? 'bg-green-500 text-white'
                                      : 'bg-gray-300 text-white'
                                  }`}
                                >
                                  {ev.is_provided === 1 ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">{ev.evidence_name}</div>
                                  <div className="text-xs text-gray-500">{ev.evidence_type}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    ev.is_required === 1
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {ev.is_required === 1 ? '必填' : '选填'}
                                </span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    ev.is_provided === 1
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {ev.is_provided === 1 ? '已提供' : '未提供'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">时间信息</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">创建时间：</span>
                          <span className="font-medium text-gray-900">
                            {new Date(application.created_at).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">更新时间：</span>
                          <span className="font-medium text-gray-900">
                            {new Date(application.updated_at).toLocaleString('zh-CN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'operations' && (
                  <OperationTimeline operations={operations} riskLogs={riskLogs} />
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <OperationForm application={application} onSuccess={handleOperationSuccess} />

            <div className="mt-6 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">风险等级变更历史</h3>
              {riskLogs.length === 0 ? (
                <p className="text-sm text-gray-500">暂无风险等级变更记录</p>
              ) : (
                <div className="space-y-3">
                  {riskLogs.map((log) => (
                    <div key={log.id} className="text-sm bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">
                          {log.operator_name}（{log.operator_role}）
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(log.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            log.from_level === 'high'
                              ? 'bg-red-100 text-red-700'
                              : log.from_level === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {log.from_level === 'high' ? '高风险' : log.from_level === 'medium' ? '中风险' : '低风险'}
                        </span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            log.to_level === 'high'
                              ? 'bg-red-100 text-red-700'
                              : log.to_level === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {log.to_level === 'high' ? '高风险' : log.to_level === 'medium' ? '中风险' : '低风险'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{log.change_reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
