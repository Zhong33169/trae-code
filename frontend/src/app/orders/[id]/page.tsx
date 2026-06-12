'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { RepairOrder, OperationRecord } from '@/lib/types';
import { fetchOrder, submitOrder, acceptReview, reviewOrder, acceptRecheck, recheckOrder, updateOrder } from '@/lib/api';
import { useCurrentUser } from '@/lib/user-context';

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

const ROLE_LABELS: Record<string, string> = {
  clerk: '登记员',
  supervisor: '审核主管',
  rechecker: '复核负责人',
};

const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  submit: '提交',
  update: '编辑',
  accept_review: '受理审核',
  review_approve: '审核通过',
  review_return: '退回补正',
  review_reject: '驳回',
  accept_recheck: '受理复核',
  recheck_archive: '归档',
  recheck_return: '复核退回',
  validation_failed: '校验失败',
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

function getDotClass(action: string): string {
  const map: Record<string, string> = {
    create: 'timeline-dot-create',
    submit: 'timeline-dot-submit',
    update: 'timeline-dot-submit',
    accept_review: 'timeline-dot-accept',
    review_approve: 'timeline-dot-approve',
    review_return: 'timeline-dot-return',
    review_reject: 'timeline-dot-reject',
    accept_recheck: 'timeline-dot-recheck',
    recheck_archive: 'timeline-dot-archive',
    recheck_return: 'timeline-dot-return',
    validation_failed: 'timeline-dot-failed',
  };
  return map[action] || 'bg-slate-400 ring-slate-200';
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900 sm:col-span-2 sm:mt-0">{children}</dd>
    </div>
  );
}

function Timeline({ records }: { records: OperationRecord[] }) {
  if (!records || records.length === 0) {
    return <div className="text-center text-slate-400 py-8">暂无操作记录</div>;
  }

  const sorted = [...records].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div className="relative">
      <div className="timeline-line" />
      <div className="space-y-6">
        {sorted.map((record, idx) => {
          const isFailed = record.action === 'validation_failed';
          return (
            <div key={record.id} className="relative pl-12">
              <div className={`timeline-dot ${getDotClass(record.action)}`} style={{ top: '4px' }} />
              <div className={`card p-4 ${isFailed ? 'border-red-200 bg-red-50/50' : ''}`}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-slate-800">{record.operator_name}</span>
                  <span className="badge bg-slate-100 text-slate-600">{ROLE_LABELS[record.operator_role] || record.operator_role}</span>
                  <span className={`text-sm font-medium ${isFailed ? 'text-red-700' : 'text-blue-700'}`}>
                    {ACTION_LABELS[record.action] || record.action}
                  </span>
                  <span className="text-xs text-slate-400">{new Date(record.created_at).toLocaleString('zh-CN')}</span>
                  {(record.from_version !== null || record.to_version !== null) && (
                    <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      v{record.from_version} → v{record.to_version}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {record.from_status && record.from_status !== record.to_status && (
                    <>
                      <StatusBadge status={record.from_status} />
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                  <StatusBadge status={record.to_status} />
                </div>
                {record.opinion && (
                  <div className="mb-1.5">
                    <span className="text-xs font-medium text-slate-500">意见：</span>
                    <span className={`text-sm px-2 py-1 rounded ${isFailed ? 'bg-red-100 text-red-800' : 'bg-blue-50 text-slate-700'}`}>{record.opinion}</span>
                  </div>
                )}
                {record.reason && (
                  <div className="mb-1.5">
                    <span className="text-xs font-medium text-slate-500">原因：</span>
                    <span className={`text-sm px-2 py-1 rounded ${isFailed ? 'bg-red-100 text-red-800' : 'bg-orange-50 text-slate-700'}`}>{record.reason}</span>
                  </div>
                )}
                {record.result && (
                  <div>
                    <span className="text-xs font-medium text-slate-500">结果：</span>
                    <span className={`text-sm px-2 py-1 rounded ${isFailed ? 'bg-red-100 text-red-800 font-medium' : 'bg-green-50 text-slate-700'}`}>{record.result}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionForm({
  order,
  user,
  onAction,
}: {
  order: RepairOrder;
  user: { id: number; role: string } | null;
  onAction: () => void;
}) {
  const [opinion, setOpinion] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    title: order.title,
    description: order.description,
    enterprise_name: order.enterprise_name,
    contact_person: order.contact_person,
    contact_phone: order.contact_phone,
    repair_type: order.repair_type,
    urgency: order.urgency,
    location: order.location,
    evidence_descriptions: [...order.evidence_descriptions],
  });

  if (!user) {
    return (
      <div className="card p-4 text-center text-amber-600">
        请先在顶部选择当前用户身份
      </div>
    );
  }

  const handleAction = async (actionFn: () => Promise<RepairOrder>) => {
    setSubmitting(true);
    setError('');
    try {
      await actionFn();
      setOpinion('');
      setReason('');
      onAction();
      try {
        window.dispatchEvent(new Event('order-state-changed'));
      } catch {
        // ignore
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '操作失败');
      onAction();
      try {
        window.dispatchEvent(new Event('order-state-changed'));
      } catch {
        // ignore
      }
    } finally {
      setSubmitting(false);
    }
  };

  const v = order.version;

  const handleEditAndSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const updated = await updateOrder(order.id, {
        ...editData,
        operator_id: user.id,
        version: v,
        opinion: opinion || '补正后重新提交',
      });
      await submitOrder(order.id, { operator_id: user.id, opinion, version: updated.version });
      setOpinion('');
      setEditMode(false);
      onAction();
      try {
        window.dispatchEvent(new Event('order-state-changed'));
      } catch {
        // ignore
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '操作失败');
      onAction();
      try {
        window.dispatchEvent(new Event('order-state-changed'));
      } catch {
        // ignore
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isClerk = user.role === 'clerk';
  const isSupervisor = user.role === 'supervisor';
  const isRechecker = user.role === 'rechecker';

  let actions: React.ReactNode = null;

  if (isClerk) {
    if (order.status === 'draft') {
      actions = (
        <button
          onClick={() => handleAction(() => submitOrder(order.id, { operator_id: user.id, opinion, version: v }))}
          disabled={submitting}
          className="btn-primary"
        >
          提交
        </button>
      );
    } else if (order.status === 'returned') {
      if (!editMode) {
        actions = (
          <div className="flex gap-3">
            <button onClick={() => setEditMode(true)} className="btn-warning">编辑补正</button>
          </div>
        );
      } else {
        actions = (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-field">标题</label>
                <input className="input-field" value={editData.title} onChange={(e) => setEditData({ ...editData, title: e.target.value })} />
              </div>
              <div>
                <label className="label-field">企业名称</label>
                <input className="input-field" value={editData.enterprise_name} onChange={(e) => setEditData({ ...editData, enterprise_name: e.target.value })} />
              </div>
              <div>
                <label className="label-field">联系人</label>
                <input className="input-field" value={editData.contact_person} onChange={(e) => setEditData({ ...editData, contact_person: e.target.value })} />
              </div>
              <div>
                <label className="label-field">联系电话</label>
                <input className="input-field" value={editData.contact_phone} onChange={(e) => setEditData({ ...editData, contact_phone: e.target.value })} />
              </div>
              <div>
                <label className="label-field">报修类型</label>
                <input className="input-field" value={editData.repair_type} onChange={(e) => setEditData({ ...editData, repair_type: e.target.value })} />
              </div>
              <div>
                <label className="label-field">紧急程度</label>
                <select className="input-field" value={editData.urgency} onChange={(e) => setEditData({ ...editData, urgency: e.target.value as RepairOrder['urgency'] })}>
                  <option value="low">一般</option>
                  <option value="medium">中等</option>
                  <option value="high">紧急</option>
                  <option value="urgent">特急</option>
                </select>
              </div>
              <div>
                <label className="label-field">位置</label>
                <input className="input-field" value={editData.location} onChange={(e) => setEditData({ ...editData, location: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label-field">描述</label>
              <textarea className="input-field" rows={3} value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} />
            </div>
            <div>
              <label className="label-field">证据描述</label>
              {editData.evidence_descriptions.map((ev, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input
                    className="input-field flex-1"
                    value={ev}
                    onChange={(e) => {
                      const newEv = [...editData.evidence_descriptions];
                      newEv[idx] = e.target.value;
                      setEditData({ ...editData, evidence_descriptions: newEv });
                    }}
                  />
                  <button
                    onClick={() => {
                      const newEv = editData.evidence_descriptions.filter((_, i) => i !== idx);
                      setEditData({ ...editData, evidence_descriptions: newEv });
                    }}
                    className="btn-danger text-xs px-2"
                  >
                    删除
                  </button>
                </div>
              ))}
              <button
                onClick={() => setEditData({ ...editData, evidence_descriptions: [...editData.evidence_descriptions, ''] })}
                className="btn-secondary text-xs"
              >
                + 添加证据
              </button>
            </div>
            <div>
              <label className="label-field">提交意见</label>
              <textarea className="input-field" rows={2} value={opinion} onChange={(e) => setOpinion(e.target.value)} placeholder="请输入补正说明" />
            </div>
            <div className="flex gap-3">
              <button onClick={handleEditAndSubmit} disabled={submitting} className="btn-primary">保存并提交</button>
              <button onClick={() => setEditMode(false)} className="btn-secondary">取消</button>
            </div>
          </div>
        );
      }
    }
  } else if (isSupervisor) {
    if (order.status === 'submitted') {
      actions = (
        <button
          onClick={() => handleAction(() => acceptReview(order.id, { operator_id: user.id, opinion, version: v }))}
          disabled={submitting}
          className="btn-primary"
        >
          受理审核
        </button>
      );
    } else if (order.status === 'under_review') {
      actions = (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleAction(() => reviewOrder(order.id, { operator_id: user.id, opinion, reason, result: 'approve', version: v }))}
            disabled={submitting}
            className="btn-success"
          >
            审核通过
          </button>
          <button
            onClick={() => handleAction(() => reviewOrder(order.id, { operator_id: user.id, opinion, reason, result: 'return', version: v }))}
            disabled={submitting}
            className="btn-warning"
          >
            退回补正
          </button>
          <button
            onClick={() => handleAction(() => reviewOrder(order.id, { operator_id: user.id, opinion, reason, result: 'reject', version: v }))}
            disabled={submitting}
            className="btn-danger"
          >
            驳回
          </button>
        </div>
      );
    }
  } else if (isRechecker) {
    if (order.status === 'review_approved') {
      actions = (
        <button
          onClick={() => handleAction(() => acceptRecheck(order.id, { operator_id: user.id, opinion, version: v }))}
          disabled={submitting}
          className="btn-purple"
        >
          受理复核
        </button>
      );
    } else if (order.status === 'under_recheck') {
      actions = (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleAction(() => recheckOrder(order.id, { operator_id: user.id, opinion, reason, result: 'archive', version: v }))}
            disabled={submitting}
            className="btn-success"
          >
            归档
          </button>
          <button
            onClick={() => handleAction(() => recheckOrder(order.id, { operator_id: user.id, opinion, reason, result: 'return', version: v }))}
            disabled={submitting}
            className="btn-warning"
          >
            退回
          </button>
        </div>
      );
    }
  }

  if (!actions && order.status !== 'returned') return null;
  if (order.status === 'returned' && !isClerk) return null;

  const showOpinion = order.status !== 'returned' || editMode;
  const showReason = (isSupervisor && order.status === 'under_review') || (isRechecker && order.status === 'under_recheck');

  return (
    <div className="card p-6 space-y-4">
      <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-3">操作</h3>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {showOpinion && !editMode && (
        <div>
          <label className="label-field">意见</label>
          <textarea
            className="input-field"
            rows={3}
            value={opinion}
            onChange={(e) => setOpinion(e.target.value)}
            placeholder="请输入您的意见"
          />
        </div>
      )}
      {showReason && (
        <div>
          <label className="label-field">原因/理由</label>
          <textarea
            className="input-field"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="请输入原因或理由"
          />
        </div>
      )}
      {actions}
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params.id);
  const [order, setOrder] = useState<RepairOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useCurrentUser();

  const loadOrder = useCallback(async () => {
    try {
      const data = await fetchOrder(orderId);
      setOrder(data);
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{error || '工单不存在'}</div>
      </div>
    );
  }

  const previousOpinions = (order.operation_records || [])
    .filter((r) => r.opinion || r.reason || r.result)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-secondary text-xs px-3 py-1.5">
            ← 返回
          </button>
          <h1 className="text-2xl font-bold text-slate-800">工单详情</h1>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">基本信息</h2>
        </div>
        <div className="px-6 py-4">
          <dl className="divide-y divide-slate-100">
            <InfoRow label="工单编号">{order.order_no}</InfoRow>
            <InfoRow label="标题">{order.title}</InfoRow>
            <InfoRow label="企业名称">{order.enterprise_name}</InfoRow>
            <InfoRow label="联系人">{order.contact_person}</InfoRow>
            <InfoRow label="联系电话">{order.contact_phone}</InfoRow>
            <InfoRow label="报修类型">{order.repair_type}</InfoRow>
            <InfoRow label="紧急程度"><UrgencyBadge urgency={order.urgency} /></InfoRow>
            <InfoRow label="位置">{order.location}</InfoRow>
            <InfoRow label="描述">
              <div className="whitespace-pre-wrap">{order.description}</div>
            </InfoRow>
            <InfoRow label="当前处理人">{order.current_handler_name || '-'}</InfoRow>
            <InfoRow label="版本">v{order.version}</InfoRow>
            <InfoRow label="创建时间">{new Date(order.created_at).toLocaleString('zh-CN')}</InfoRow>
            <InfoRow label="更新时间">{new Date(order.updated_at).toLocaleString('zh-CN')}</InfoRow>
            {order.evidence_descriptions.length > 0 && (
              <InfoRow label="证据描述">
                <ul className="list-disc list-inside space-y-1">
                  {order.evidence_descriptions.map((ev, idx) => (
                    <li key={idx} className="text-sm text-slate-700">{ev}</li>
                  ))}
                </ul>
              </InfoRow>
            )}
          </dl>
        </div>
      </div>

      {previousOpinions.length > 0 && (
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">历史处理意见</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            {previousOpinions.map((record) => {
              const isFailed = record.action === 'validation_failed';
              return (
                <div key={record.id} className={`border rounded-lg p-4 ${isFailed ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm text-slate-800">{record.operator_name}</span>
                    <span className="badge bg-slate-100 text-slate-600">{ROLE_LABELS[record.operator_role] || record.operator_role}</span>
                    <span className={`text-xs font-medium ${isFailed ? 'text-red-700' : 'text-blue-700'}`}>{ACTION_LABELS[record.action] || record.action}</span>
                    <span className="text-xs text-slate-400 ml-auto">{new Date(record.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                  {record.opinion && (
                    <div className="bg-blue-50 border border-blue-100 rounded p-3 mb-2">
                      <span className="text-xs font-medium text-blue-600">意见：</span>
                      <span className="text-sm text-blue-800">{record.opinion}</span>
                    </div>
                  )}
                  {record.reason && (
                    <div className={`border rounded p-3 mb-2 ${isFailed ? 'bg-red-100 border-red-200' : 'bg-orange-50 border-orange-100'}`}>
                      <span className={`text-xs font-medium ${isFailed ? 'text-red-700' : 'text-orange-600'}`}>原因：</span>
                      <span className={`text-sm ${isFailed ? 'text-red-800' : 'text-orange-800'}`}>{record.reason}</span>
                    </div>
                  )}
                  {record.result && (
                    <div className={`border rounded p-3 ${isFailed ? 'bg-red-100 border-red-200' : 'bg-green-50 border-green-100'}`}>
                      <span className={`text-xs font-medium ${isFailed ? 'text-red-700' : 'text-green-600'}`}>结果：</span>
                      <span className={`text-sm font-medium ${isFailed ? 'text-red-800' : 'text-green-800'}`}>{record.result}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">操作记录</h2>
        </div>
        <div className="px-6 py-6">
          <Timeline records={order.operation_records || []} />
        </div>
      </div>

      <ActionForm order={order} user={user} onAction={loadOrder} />
    </div>
  );
}
