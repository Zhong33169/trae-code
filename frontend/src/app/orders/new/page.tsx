'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOrder, submitOrder } from '@/lib/api';
import { useCurrentUser } from '@/lib/user-context';

const REPAIR_TYPES = [
  '水电维修',
  '空调维修',
  '门窗维修',
  '消防设施',
  '电梯维修',
  '管道维修',
  '网络故障',
  '装修维护',
  '绿化维护',
  '其他',
];

export default function NewOrderPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    enterprise_name: '',
    contact_person: '',
    contact_phone: '',
    repair_type: REPAIR_TYPES[0],
    urgency: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    location: '',
    evidence_descriptions: [''] as string[],
    submit_opinion: '',
  });

  const handleSubmit = async (e: React.FormEvent, andSubmit: boolean) => {
    e.preventDefault();
    if (!user) {
      setError('请先选择当前用户身份');
      return;
    }

    setSubmitting(true);
    setError('');

    const evidence = form.evidence_descriptions.filter((ev) => ev.trim() !== '');

    try {
      const result = await createOrder({
        title: form.title,
        description: form.description,
        enterprise_name: form.enterprise_name,
        contact_person: form.contact_person,
        contact_phone: form.contact_phone,
        repair_type: form.repair_type,
        urgency: form.urgency,
        location: form.location,
        evidence_descriptions: evidence,
        operator_id: user.id,
      });

      if (andSubmit) {
        try {
          await submitOrder(result.id, { operator_id: user.id, opinion: form.submit_opinion || '提交审核', version: 1 });
        } catch (submitErr: unknown) {
          const msg = submitErr instanceof Error ? submitErr.message : '提交失败';
          router.push(`/orders/${result.id}`);
          return;
        }
      }

      router.push(`/orders/${result.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateEvidence = (idx: number, value: string) => {
    const newEv = [...form.evidence_descriptions];
    newEv[idx] = value;
    setForm((prev) => ({ ...prev, evidence_descriptions: newEv }));
  };

  const addEvidence = () => {
    setForm((prev) => ({ ...prev, evidence_descriptions: [...prev.evidence_descriptions, ''] }));
  };

  const removeEvidence = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      evidence_descriptions: prev.evidence_descriptions.filter((_, i) => i !== idx),
    }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn-secondary text-xs px-3 py-1.5">
          ← 返回
        </button>
        <h1 className="text-2xl font-bold text-slate-800">新建工单</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {!user && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
          请先在顶部选择当前用户身份后再创建工单
        </div>
      )}

      <form className="card p-6 space-y-5">
        <div>
          <label className="label-field">标题 <span className="text-red-500">*</span></label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            className="input-field"
            placeholder="请输入工单标题"
          />
        </div>

        <div>
          <label className="label-field">描述 <span className="text-red-500">*</span></label>
          <textarea
            required
            rows={4}
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            className="input-field"
            placeholder="请详细描述报修问题"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label-field">企业名称 <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={form.enterprise_name}
              onChange={(e) => updateField('enterprise_name', e.target.value)}
              className="input-field"
              placeholder="请输入企业名称"
            />
          </div>
          <div>
            <label className="label-field">联系人 <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={form.contact_person}
              onChange={(e) => updateField('contact_person', e.target.value)}
              className="input-field"
              placeholder="请输入联系人姓名"
            />
          </div>
          <div>
            <label className="label-field">联系电话 <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={form.contact_phone}
              onChange={(e) => updateField('contact_phone', e.target.value)}
              className="input-field"
              placeholder="请输入联系电话"
            />
          </div>
          <div>
            <label className="label-field">报修类型 <span className="text-red-500">*</span></label>
            <select
              value={form.repair_type}
              onChange={(e) => updateField('repair_type', e.target.value)}
              className="input-field"
            >
              {REPAIR_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">紧急程度 <span className="text-red-500">*</span></label>
            <select
              value={form.urgency}
              onChange={(e) => updateField('urgency', e.target.value)}
              className="input-field"
            >
              <option value="low">一般</option>
              <option value="medium">中等</option>
              <option value="high">紧急</option>
              <option value="urgent">特急</option>
            </select>
          </div>
          <div>
            <label className="label-field">位置 <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={form.location}
              onChange={(e) => updateField('location', e.target.value)}
              className="input-field"
              placeholder="请输入报修位置"
            />
          </div>
        </div>

        <div>
          <label className="label-field">证据描述 <span className="text-red-500">*</span></label>
          {form.evidence_descriptions.filter((ev) => ev.trim()).length === 0 && (
            <div className="text-red-500 text-xs mt-1 mb-2">证据描述为必填项，提交前请补充</div>
          )}
          {form.evidence_descriptions.map((ev, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <input
                type="text"
                value={ev}
                onChange={(e) => updateEvidence(idx, e.target.value)}
                className="input-field flex-1"
                placeholder={`证据描述 ${idx + 1}`}
              />
              {form.evidence_descriptions.length > 1 && (
                <button type="button" onClick={() => removeEvidence(idx)} className="btn-danger text-xs px-2">
                  删除
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addEvidence} className="btn-secondary text-xs">
            + 添加证据描述
          </button>
        </div>

        <div>
          <label className="label-field">提交意见</label>
          <textarea
            rows={2}
            value={form.submit_opinion}
            onChange={(e) => updateField('submit_opinion', e.target.value)}
            className="input-field"
            placeholder="请输入提交意见（提交时必填）"
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-200">
          <button
            type="submit"
            onClick={(e) => handleSubmit(e, false)}
            disabled={submitting || !user}
            className="btn-secondary"
          >
            保存草稿
          </button>
          <button
            type="submit"
            onClick={(e) => handleSubmit(e, true)}
            disabled={submitting || !user}
            className="btn-primary"
          >
            保存并提交
          </button>
        </div>
      </form>
    </div>
  );
}
