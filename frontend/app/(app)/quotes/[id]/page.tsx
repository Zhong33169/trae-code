'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, formatDateTime, formatMoney, getCurrentUser } from '@/lib/api';
import { STATUS_COLORS } from '@/types';
import type { RepairQuote, OperationLog, ShiftHandover, User } from '@/types';

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;
  const user = getCurrentUser();
  const [quote, setQuote] = useState<RepairQuote | null>(null);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [handovers, setHandovers] = useState<ShiftHandover[]>([]);
  const [pendingHandovers, setPendingHandovers] = useState<ShiftHandover[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const [modal, setModal] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [q, u] = await Promise.all([
      apiFetch<any>(`/api/quotes/${id}`),
      apiFetch<any>(`/api/users`),
    ]);
    if (q.ok) {
      setQuote(q.data.quote);
      setLogs(q.data.operation_logs || []);
      setHandovers(q.data.shift_handovers || []);
      setPendingHandovers(q.data.pending_handovers || []);
    } else {
      setMessage({ type: 'error', text: q.error || '加载失败' });
    }
    if (u.ok) setUsers(u.data.users || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const showMsg = (type: string, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const callAction = async (path: string, body: any = {}, label: string) => {
    const r = await apiFetch(`/api/quotes/${id}/${path}`, { method: 'POST', body: JSON.stringify(body) });
    if (!r.ok) {
      showMsg('error', `${label}失败: ${r.error || '后端校验不通过'}`);
      return false;
    }
    showMsg('success', r.data.message || `${label}成功！刷新详情、列表、统计均已同步更新`);
    setModal(null);
    load();
    return true;
  };

  const role = user?.role;
  const isServiceManager = role === 'service_manager';
  const isDispatcher = role === 'dispatcher' || isServiceManager;
  const isCustomerService = role === 'customer_service' || isServiceManager;
  const isTechnician = role === 'technician' || isDispatcher;

  if (loading) return <div className="p-10 text-center text-gray-500">加载中...</div>;
  if (!quote) return <div className="p-10 text-center">报价单不存在或已被删除 <Link href="/quotes" className="text-blue-600 underline">返回列表</Link></div>;

  const st = quote.status;
  const can = {
    submitQuote: isCustomerService && st === 'draft',
    fillQuote: isDispatcher && st === 'pending_quote',
    confirm: isCustomerService && st === 'quoted',
    payment: isCustomerService && (st === 'confirmed' || st === 'returned'),
    assignTech: isDispatcher && ['confirmed', 'customer_paid', 'repairing', 'returned'].includes(st),
    startRepair: isTechnician && st === 'customer_paid',
    returnQ: isTechnician && ['confirmed', 'customer_paid', 'repairing'].includes(st),
    complete: isServiceManager && st === 'repairing',
    cancel: isServiceManager && st !== 'completed' && st !== 'cancelled',
    evidence: isDispatcher || isServiceManager || role === 'technician',
    handover: st !== 'completed' && st !== 'cancelled',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link href="/quotes" className="text-sm text-blue-600 hover:underline">← 返回列表</Link>
          <h1 className="text-xl font-bold mt-1">
            报价单 <span className="font-mono text-sm text-blue-700">{quote.quote_no}</span>
            <span className={`tag border ml-3 align-middle ${STATUS_COLORS[st] || ''}`} style={{ fontSize: 12 }}>{quote.status_display}</span>
          </h1>
        </div>
        <div className="text-xs text-gray-500">
          创建: {formatDateTime(quote.created_at)} · 最近更新: {formatDateTime(quote.updated_at)}
        </div>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {pendingHandovers.length > 0 && (
        <div className="alert alert-warning mb-4">
          <div className="font-semibold mb-1">⚠️ 有待你确认的交接</div>
          {pendingHandovers.map(h => (
            <div key={h.id} className="flex items-center gap-2 flex-wrap text-sm mt-1">
              <span>{h.from_user_name} → {h.to_user_name}：{h.handover_remark}</span>
              <button className="btn btn-success btn-xs" onClick={() => confirmHandover(h.id, true)}>确认接收</button>
              <button className="btn btn-danger btn-xs" onClick={() => confirmHandover(h.id, false)}>拒绝</button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <div className="card p-5">
            <SectionTitle>📝 客户与设备信息</SectionTitle>
            <div className="grid grid-cols-2 gap-4 text-sm mt-3">
              <InfoRow label="客户姓名" value={quote.customer_name} />
              <InfoRow label="联系电话" value={quote.customer_phone} />
              <InfoRow label="设备类型" value={quote.device_type} />
              <InfoRow label="设备型号" value={quote.device_model || '-'} />
              <InfoRow label="故障描述" value={quote.fault_description || '-'} full />
            </div>
          </div>

          <div className="card p-5">
            <SectionTitle>💰 报价与支付</SectionTitle>
            <div className="grid grid-cols-2 gap-4 text-sm mt-3">
              <InfoRow label="预估/报价金额" value={formatMoney(quote.estimate_amount)} />
              <InfoRow label="实付金额" value={formatMoney(quote.actual_amount)} />
              <InfoRow label="支付状态" value={
                <span className={quote.payment_status === 'paid' ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>
                  {quote.payment_status_display || quote.payment_status}
                </span>
              } />
              <InfoRow label="支付方式" value={quote.payment_method || '-'} />
              <InfoRow label="报价明细" value={quote.quote_detail || '-'} full />
              <InfoRow label="客户确认时间" value={formatDateTime(quote.confirmed_at as any)} />
              <InfoRow label="客户支付时间" value={formatDateTime(quote.paid_at as any)} />
              <InfoRow label="归档完成时间" value={formatDateTime(quote.completed_at as any)} />
            </div>
          </div>

          <div className="card p-5">
            <SectionTitle>📌 流转过程（操作记录，以后端为准）</SectionTitle>
            {logs.length === 0 ? <div className="text-gray-400 text-sm mt-3">暂无记录</div> :
              <div className="timeline mt-4">
                {logs.map(l => (
                  <div key={l.id} className="timeline-item">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{l.operation}</span>
                      {(l.old_status || l.new_status) && l.old_status !== l.new_status && (
                        <span className="text-xs text-gray-500">
                          {l.old_status && <span className="px-1.5 py-0.5 bg-gray-100 rounded">{l.old_status}</span>}
                          {l.old_status && l.new_status && <span className="mx-1">→</span>}
                          {l.new_status && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">{l.new_status}</span>}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      <span className="font-medium text-gray-700">{l.operator_name}</span>
                      <span className="tag bg-gray-100 text-gray-600 ml-1" style={{ fontSize: 10 }}>{l.operator_role}</span>
                      <span className="mx-1">·</span>
                      {formatDateTime(l.created_at)}
                    </div>
                    {l.remark && <div className="text-sm text-gray-700 mt-1 bg-gray-50 rounded px-2 py-1 border border-gray-100">{l.remark}</div>}
                  </div>
                ))}
              </div>
            }
          </div>

          {handovers.length > 0 && (
            <div className="card p-5">
              <SectionTitle>🔁 跨班组交接记录（可追溯谁交出、谁接收、哪个班次）</SectionTitle>
              <div className="mt-3 space-y-3">
                {handovers.map(h => (
                  <div key={h.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs ${h.status === 'confirmed' ? 'bg-green-100 text-green-700' : h.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {h.status_display}
                        </span>
                        <span>
                          <b>{h.from_user_name}</b>
                          <span className="text-xs text-gray-500">（{h.from_user_role} · {h.from_shift}）</span>
                          <span className="mx-1.5 text-gray-400">→</span>
                          <b>{h.to_user_name}</b>
                          <span className="text-xs text-gray-500">（{h.to_user_role} · {h.to_shift}）</span>
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        发起: {formatDateTime(h.created_at)} {h.confirmed_at && `· 确认: ${formatDateTime(h.confirmed_at)}`}
                      </div>
                    </div>
                    {h.handover_remark && <div className="mt-2 text-sm bg-white border border-gray-200 rounded px-2 py-1.5">交接备注: {h.handover_remark}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5 sticky top-4">
            <SectionTitle>⚡ 操作面板</SectionTitle>
            <div className="text-xs text-gray-500 mb-3 mt-2">
              当前登录: <b>{user.real_name}</b>（{({service_manager:'服务经理',dispatcher:'调度专员',customer_service:'客服专员',technician:'维修师傅'} as any)[role]}）<br/>
              权限以后端校验为准，若越权操作会返回明确错误
            </div>

            <div className="space-y-2 mt-3">
              <ActionBtn label="提交待报价" disabled={!can.submitQuote} onClick={() => simpleConfirm('submit-quote', '确认将此报价单提交待报价？', '提交待报价')} />
              <ActionBtn label="✏️ 填写报价金额" disabled={!can.fillQuote} onClick={() => setModal('fill')} color="warning" />
              <ActionBtn label="☑️ 客户确认报价" disabled={!can.confirm} onClick={() => setModal('confirm')} color="primary" />
              <ActionBtn label="💳 登记客户支付" disabled={!can.payment} onClick={() => setModal('payment')} color="success" />
              <ActionBtn label="👷 分配维修师傅" disabled={!can.assignTech} onClick={() => setModal('assign')} color="primary" />
              <ActionBtn label="🔧 开始维修" disabled={!can.startRepair} onClick={() => simpleConfirm('start-repair', '确认开始现场维修？', '开始维修')} color="success" />
              <ActionBtn label="↩️ 退回处理" disabled={!can.returnQ} onClick={() => setModal('return')} color="danger" />
              <ActionBtn label="📎 补充证据/备注" disabled={!can.evidence} onClick={() => setModal('evidence')} />
              <ActionBtn label="🔁 发起换班交接" disabled={!can.handover} onClick={() => setModal('handover')} color="warning" />
              <div className="border-t border-gray-100 my-2" />
              <ActionBtn label="✅ 服务经理归档完成" disabled={!can.complete} onClick={() => setModal('complete')} color="success" />
              <ActionBtn label="❌ 取消报价单" disabled={!can.cancel} onClick={() => setModal('cancel')} color="danger" />
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 text-xs">
              <div className="text-gray-500 font-semibold mb-1.5">当前处理进度</div>
              <StatusFlow current={st} />
            </div>
          </div>

          <div className="card p-5">
            <SectionTitle>👤 当前处理人</SectionTitle>
            <div className="text-sm mt-3 space-y-1">
              <InfoRow label="当前处理人" value={quote.current_handler || '未分配'} />
              <InfoRow label="所属班次" value={quote.shift_display || '-'} />
              <InfoRow label="维修师傅" value={quote.assigned_technician || '-' } />
              <InfoRow label="登记人" value={quote.creator_name} />
              <InfoRow label="历史交接次数" value={`${quote.handover_count} 次`} />
            </div>
          </div>
        </div>
      </div>

      {modal === 'fill' && <Modal title="填写报价金额" onClose={() => setModal(null)} onSubmit={async (form) => {
        const body = { estimate_amount: Number(form.amount), quote_detail: form.detail || '' };
        if (!body.estimate_amount || body.estimate_amount <= 0) { showMsg('error', '报价金额必须大于0'); return false; }
        return callAction('fill-quote', body, '填写报价');
      }} fields={[
        { k: 'amount', label: '报价金额(元)', type: 'number', required: true, placeholder: '请输入报价金额' },
        { k: 'detail', label: '报价明细/配件清单', type: 'textarea', placeholder: '如：配件费+人工费=合计XX元' },
      ]} />}

      {modal === 'confirm' && <Modal title="客户确认报价" onClose={() => setModal(null)} onSubmit={(form) => callAction('confirm', { remark: form.remark || '' }, '客户确认报价')} fields={[
        { k: 'remark', label: '确认方式/备注', type: 'textarea', placeholder: '如：电话确认/微信确认/当面确认' },
      ]} />}

      {modal === 'payment' && <Modal title="登记客户支付" onClose={() => setModal(null)} onSubmit={(form) => {
        const body = { amount: Number(form.amount), payment_method: form.method, remark: form.remark || '' };
        if (!body.amount || body.amount <= 0) { showMsg('error', '支付金额必须大于0'); return false; }
        if (!body.payment_method) { showMsg('error', '请选择支付方式'); return false; }
        return callAction('payment', body, '登记客户支付');
      }} fields={[
        { k: 'amount', label: '实收金额(元)', type: 'number', required: true, default: quote.actual_amount || quote.estimate_amount },
        { k: 'method', label: '支付方式', type: 'select', required: true, options: [['','请选择'],['cash','现金'],['wechat','微信'],['alipay','支付宝'],['card','刷卡'],['transfer','转账']] },
        { k: 'remark', label: '备注', type: 'textarea' },
      ]} />}

      {modal === 'assign' && <Modal title="分配维修师傅" onClose={() => setModal(null)} onSubmit={(form) => {
        const body = { technician_id: Number(form.tech), remark: form.remark || '' };
        if (!body.technician_id) { showMsg('error', '请选择维修师傅'); return false; }
        return callAction('assign-tech', body, '分配维修师傅');
      }} fields={[
        { k: 'tech', label: '维修师傅', type: 'select', required: true, options: [['', '请选择维修师傅'], ...users.filter(u => u.role === 'technician').map(u => [String(u.id), `${u.real_name} (${({morning:'白班',afternoon:'中班',night:'夜班'} as any)[u.shift]})`] as [string, string])] },
        { k: 'remark', label: '指派说明', type: 'textarea' },
      ]} />}

      {modal === 'return' && <Modal title="退回处理" onClose={() => setModal(null)} onSubmit={(form) => {
        if (!form.remark) { showMsg('error', '退回原因必填'); return false; }
        return callAction('return', { remark: form.remark }, '退回');
      }} fields={[{ k: 'remark', label: '退回原因 *', type: 'textarea', required: true, placeholder: '请详细说明退回原因，方便客服协调' }]} />}

      {modal === 'complete' && <Modal title="服务经理归档" onClose={() => setModal(null)} onSubmit={(form) => callAction('complete', { remark: form.remark || '' }, '完成归档')} fields={[
        { k: 'remark', label: '归档备注（客户验收情况）', type: 'textarea', placeholder: '如：客户验收满意、维修完成' },
      ]} warning="仅服务经理可操作归档，一旦归档不可逆转" />}

      {modal === 'cancel' && <Modal title="取消报价单" onClose={() => setModal(null)} onSubmit={(form) => {
        if (!form.remark) { showMsg('error', '取消原因必填'); return false; }
        return callAction('cancel', { remark: form.remark }, '取消报价单');
      }} fields={[{ k: 'remark', label: '取消原因 *', type: 'textarea', required: true }]} warning="取消后不可恢复，请谨慎操作" />}

      {modal === 'evidence' && <Modal title="补充证据/备注" onClose={() => setModal(null)} onSubmit={(form) => {
        if (!form.remark) { showMsg('error', '内容必填'); return false; }
        return callAction('add-evidence', { operation: form.op || '补充证据', remark: form.remark }, '补充证据');
      }} fields={[
        { k: 'op', label: '操作名称', type: 'text', default: '补充证据-补录', placeholder: '如：补充证据-退回 / 补充证据-补录' },
        { k: 'remark', label: '证据/备注内容 *', type: 'textarea', required: true, placeholder: '如：上传证据: XX审批单.pdf，备注: ...' },
      ]} />}

      {modal === 'handover' && <Modal title="发起换班交接" onClose={() => setModal(null)} onSubmit={(form) => {
        const body = { to_user_id: Number(form.to_user), handover_remark: form.remark };
        if (!body.to_user_id) { showMsg('error', '请选择接收人'); return false; }
        if (!body.handover_remark) { showMsg('error', '交接备注必填，请说明处理进度和待办'); return false; }
        return callAction('handovers', body, '发起交接');
      }} fields={[
        { k: 'to_user', label: '交接给 *', type: 'select', required: true, options: [['','请选择接收人员'], ...users.filter(u => u.id !== user.id).map(u => [String(u.id), `${u.real_name} - ${({service_manager:'服务经理',dispatcher:'调度专员',customer_service:'客服专员',technician:'维修师傅'} as any)[u.role]} (${({morning:'白班',afternoon:'中班',night:'夜班'} as any)[u.shift]})`] as [string, string])] },
        { k: 'remark', label: '交接备注 *', type: 'textarea', required: true, placeholder: '请描述当前处理进度、待办事项、注意事项等，便于接手人快速理解' },
      ]} />}
    </div>
  );

  async function simpleConfirm(path: string, msg: string, label: string) {
    if (!confirm(msg)) return;
    callAction(path, {}, label);
  }

  async function confirmHandover(hid: number, accept: boolean) {
    const remark = accept ? '' : (prompt('请填写拒绝原因') || '');
    if (!accept && !remark) { showMsg('error', '拒绝原因必填'); return; }
    const r = await apiFetch(`/api/handovers/${hid}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ action: accept ? 'confirm' : 'reject', remark }),
    });
    if (!r.ok) { showMsg('error', r.error || '操作失败'); return; }
    showMsg('success', accept ? '交接已接收，你成为新的处理人' : '已拒绝交接');
    load();
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="font-semibold text-gray-800 border-l-4 border-blue-500 pl-2">{children}</div>;
}

function InfoRow({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="text-gray-800">{value}</div>
    </div>
  );
}

function ActionBtn({ label, disabled, onClick, color = 'secondary' }: { label: string; disabled?: boolean; onClick?: () => void; color?: string }) {
  const cls: Record<string, string> = { primary: 'btn-primary', secondary: 'btn-secondary', success: 'btn-success', danger: 'btn-danger', warning: 'btn-warning' };
  return (
    <button className={`btn w-full justify-center ${cls[color] || 'btn-secondary'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      disabled={disabled} onClick={onClick}
      title={disabled ? '当前状态/权限不允许此操作' : ''}>
      {label}
    </button>
  );
}

function StatusFlow({ current }: { current: string }) {
  const steps = [
    ['draft', '草稿'],
    ['pending_quote', '待报价'],
    ['quoted', '已报价'],
    ['confirmed', '已确认'],
    ['customer_paid', '已支付'],
    ['repairing', '维修中'],
    ['completed', '归档'],
  ];
  const idx = steps.findIndex(s => s[0] === current);
  return (
    <div className="space-y-1.5">
      {steps.map(([code, name], i) => {
        const done = idx >= 0 && i <= idx;
        const now = code === current;
        return (
          <div key={code} className="flex items-center gap-2">
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${now ? 'bg-blue-600 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
              {done && !now ? '✓' : i + 1}
            </span>
            <span className={`${now ? 'font-semibold text-blue-700' : done ? 'text-gray-700' : 'text-gray-400'}`}>{name}</span>
          </div>
        );
      })}
    </div>
  );
}

interface Field { k: string; label: string; type: string; required?: boolean; placeholder?: string; default?: any; options?: [string, string][]; }

function Modal({ title, onClose, onSubmit, fields, warning }: { title: string; onClose: () => void; onSubmit: (form: any) => Promise<boolean> | void; fields: Field[]; warning?: string }) {
  const [form, setForm] = useState<any>(() => {
    const init: any = {};
    fields.forEach(f => { if (f.default != null) init[f.k] = f.default; });
    return init;
  });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      const r: any = await onSubmit(form);
      if (r === false) { /* handled */ }
    } finally { setLoading(false); }
  };
  return (
    <div className="modal-mask" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><span>{title}</span><button className="text-gray-400 hover:text-gray-700 text-lg leading-none" onClick={onClose}>×</button></div>
        <div className="modal-body space-y-3">
          {warning && <div className="alert alert-warning">{warning}</div>}
          {fields.map(f => (
            <div key={f.k}>
              <label className="label">{f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}</label>
              {f.type === 'textarea' ? (
                <textarea className="textarea" value={form[f.k] || ''} placeholder={f.placeholder} onChange={e => setForm({ ...form, [f.k]: e.target.value })} />
              ) : f.type === 'select' ? (
                <select className="select" value={form[f.k] || ''} onChange={e => setForm({ ...form, [f.k]: e.target.value })}>
                  {f.options?.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              ) : (
                <input type={f.type} className="input" value={form[f.k] ?? ''} placeholder={f.placeholder} onChange={e => setForm({ ...form, [f.k]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" disabled={loading} onClick={submit}>{loading ? '提交中...' : '确认提交'}</button>
        </div>
      </div>
    </div>
  );
}
