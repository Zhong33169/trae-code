import { useNavigate, useParams } from '@solidjs/router';
import { createEffect, createSignal, For, onMount, Show } from 'solid-js';
import {
  getPlan, updatePlan, submitAudit as _submitAudit, audit as _audit,
  submitMaterial as _submitMaterial, auditMaterial as _auditMaterial,
  confirmDelivery as _confirmDelivery, archivePlan as _archivePlan,
  handover as _handover, acceptHandover as _acceptHandover, listReceivers,
} from '../../api/plans';
import { Badge, useUser, STATUS_COLOR } from '../../app';
import type { PlanDetail, HandoverItem, LogItem } from '../../api/client';

const FLOW_STEPS = [
  { key: 'DRAFT', label: '起草登记' },
  { key: 'PENDING_AUDIT', label: '待审核' },
  { key: 'AUDIT_PASSED', label: '审核通过' },
  { key: 'MATERIAL_PENDING', label: '素材审核' },
  { key: 'MATERIAL_APPROVED', label: '素材通过' },
  { key: 'DELIVERY_PENDING', label: '投放确认' },
  { key: 'DELIVERY_CONFIRMED', label: '投放完成' },
  { key: 'ARCHIVED', label: '闭环归档' },
];
const STEP_ORDER: Record<string, number> = {
  DRAFT: 1, NEED_CORRECT: 1, PENDING_AUDIT: 2, AUDIT_PASSED: 3,
  MATERIAL_PENDING: 4, MATERIAL_REJECTED: 3, MATERIAL_APPROVED: 5,
  DELIVERY_PENDING: 6, DELIVERY_CONFIRMED: 7, ARCHIVED: 8,
};
const fmt = (t: any) => t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '-';

function EditModal(props: { show: boolean; close: () => void; plan: () => PlanDetail | null; done: () => void }) {
  const [title, setTitle] = createSignal('');
  const [content, setContent] = createSignal('');
  const [channel, setChannel] = createSignal('');
  const [aud, setAud] = createSignal('');
  const [time, setTime] = createSignal('');
  const [mat, setMat] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const { notify } = useUser();
  createEffect(() => {
    if (props.show && props.plan()) {
      const p = props.plan()!;
      setTitle(p.title || ''); setContent(p.content || ''); setChannel(p.channel || '');
      setAud(p.targetAudience || '');
      setTime(p.planPublishTime ? new Date(p.planPublishTime).toISOString().slice(0, 16) : '');
      setMat(p.materialInfo || '');
    }
  });
  const ok = async () => {
    if (!title().trim()) return notify('标题不能为空', 'error');
    setLoading(true);
    const r = await updatePlan(props.plan()!.id, {
      title: title(), content: content(), channel: channel(),
      targetAudience: aud(), planPublishTime: time() || undefined, materialInfo: mat() || undefined,
    });
    setLoading(false);
    if (r.code === 0) { notify('已更新', 'success'); props.done(); props.close(); }
    else notify(r.message || '更新失败', 'error');
  };
  return (
    <Show when={props.show}>
      <div class="modal-mask" onClick={props.close}>
        <div class="modal" onClick={(e) => e.stopPropagation()} style={{ width: 620 }}>
          <div class="modal-title">✏️ 编辑传播计划单</div>
          <div class="form-item"><label>标题</label><input value={title()} onInput={(e) => setTitle(e.currentTarget.value)} /></div>
          <div class="grid-2">
            <div class="form-item"><label>渠道</label><input value={channel()} onInput={(e) => setChannel(e.currentTarget.value)} /></div>
            <div class="form-item"><label>目标受众</label><input value={aud()} onInput={(e) => setAud(e.currentTarget.value)} /></div>
          </div>
          <div class="form-item"><label>计划发布时间</label><input type="datetime-local" value={time()} onInput={(e) => setTime(e.currentTarget.value)} /></div>
          <div class="form-item"><label>传播内容摘要</label><textarea rows={3} value={content()} onInput={(e) => setContent(e.currentTarget.value)} /></div>
          <Show when={props.plan()?.status === 'MATERIAL_REJECTED'}>
            <div class="form-item"><label>素材信息（补正后重提）</label><textarea rows={3} value={mat()} onInput={(e) => setMat(e.currentTarget.value)} /></div>
          </Show>
          <div class="modal-footer">
            <button class="btn btn-default" onClick={props.close}>取消</button>
            <button class="btn btn-primary" onClick={ok} disabled={loading()}>{loading() ? '保存中…' : '保存'}</button>
          </div>
        </div>
      </div>
    </Show>
  );
}

function RemarkModal(props: {
  show: boolean; title: string; passLabel: string; rejectLabel?: string; close: () => void;
  onConfirm: (pass: boolean, remark?: string) => Promise<void>; showPass?: boolean;
}) {
  const [pass, setPass] = createSignal(true);
  const [remark, setRemark] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  createEffect(() => { if (props.show) { setPass(true); setRemark(''); } });
  const ok = async () => {
    setLoading(true);
    await props.onConfirm(pass(), remark() || undefined);
    setLoading(false);
  };
  return (
    <Show when={props.show}>
      <div class="modal-mask" onClick={props.close}>
        <div class="modal" onClick={(e) => e.stopPropagation()}>
          <div class="modal-title">{props.title}</div>
          <Show when={props.rejectLabel !== undefined}>
            <div class="form-item">
              <label>操作类型</label>
              <select value={pass() ? '1' : '0'} onChange={(e) => setPass(e.currentTarget.value === '1')}>
                <option value="1">{props.passLabel}</option>
                <option value="0">{props.rejectLabel}</option>
              </select>
            </div>
          </Show>
          <div class="form-item"><label>备注（选填）</label><textarea rows={3} value={remark()} onInput={(e) => setRemark(e.currentTarget.value)} /></div>
          <div class="modal-footer">
            <button class="btn btn-default" onClick={props.close}>取消</button>
            <button class="btn btn-primary" onClick={ok} disabled={loading()}>
              {loading() ? '提交中…' : (props.rejectLabel !== undefined ? (pass() ? props.passLabel : props.rejectLabel!) : props.passLabel)}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

function HandoverModal(props: {
  show: boolean; role?: string; userId?: number; close: () => void;
  onConfirm: (data: any) => Promise<void>;
}) {
  const [to, setTo] = createSignal<number | null>(null);
  const [fromShift, setFromShift] = createSignal('MORNING');
  const [toShift, setToShift] = createSignal('AFTERNOON');
  const [remark, setRemark] = createSignal('');
  const [receivers, setReceivers] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(false);
  createEffect(async () => {
    if (props.show && props.role) {
      const r = await listReceivers(props.role);
      if (r.code === 0) {
        const list = r.data.filter((x: any) => x.id !== props.userId);
        setReceivers(list);
        if (list[0]) setTo(list[0].id); else setTo(null);
      }
      setFromShift('MORNING'); setToShift('AFTERNOON'); setRemark('');
    }
  });
  const ok = async () => {
    if (!to()) return;
    setLoading(true);
    const payload = {
      toUserId: to()!,
      fromShift: fromShift() as 'MORNING' | 'AFTERNOON' | 'NIGHT',
      toShift: toShift() as 'MORNING' | 'AFTERNOON' | 'NIGHT',
      remark: remark() || undefined,
    };
    await props.onConfirm(payload);
    setLoading(false);
  };
  return (
    <Show when={props.show}>
      <div class="modal-mask" onClick={props.close}>
        <div class="modal" onClick={(e) => e.stopPropagation()}>
          <div class="modal-title">🔁 跨班组交接确认</div>
          <div class="form-item">
            <label>交出人班次</label>
            <select value={fromShift()} onChange={(e) => setFromShift(e.currentTarget.value)}>
              <option value="MORNING">早班</option>
              <option value="AFTERNOON">中班</option>
              <option value="NIGHT">夜班</option>
            </select>
          </div>
          <div class="form-item">
            <label>接收人（岗位：{props.role === 'REGISTER' ? '登记员' : props.role === 'AUDIT' ? '审核主管' : '复核负责人'}）</label>
            <select value={to() ?? ''} onChange={(e) => setTo(+e.currentTarget.value)}>
              <option value="" disabled>请选择接收人</option>
              <For each={receivers}>{(r: any) => <option value={r.id}>{r.realName}（{r.username}）</option>}</For>
            </select>
          </div>
          <div class="form-item">
            <label>接收人班次</label>
            <select value={toShift()} onChange={(e) => setToShift(e.currentTarget.value)}>
              <option value="MORNING">早班</option>
              <option value="AFTERNOON">中班</option>
              <option value="NIGHT">夜班</option>
            </select>
          </div>
          <div class="form-item"><label>交接备注</label><textarea rows={3} value={remark()} onInput={(e) => setRemark(e.currentTarget.value)} placeholder="例如：临近下班，完成初步复核，剩余细节请中班继续。" /></div>
          <div style={{ color: '#6b7280', fontSize: 12 }}>
            交接确认后，详情页将立即显示 <b>接收人</b> 与 <b>确认时间</b>，操作记录同步更新，刷新后保持一致。
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" onClick={props.close}>取消</button>
            <button class="btn btn-primary" onClick={ok} disabled={loading() || !to()}>
              {loading() ? '确认中…' : '✅ 确认交接'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

export default function PlanDetail() {
  const params = useParams();
  const id = () => +params.id;
  const [plan, setPlan] = createSignal<PlanDetail | null>(null);
  const [loading, setLoading] = createSignal(true);
  const nav = useNavigate();
  const { notify, user, bus } = useUser();

  const [showEdit, setShowEdit] = createSignal(false);
  const [showAudit, setShowAudit] = createSignal(false);
  const [showMat, setShowMat] = createSignal(false);
  const [showMatAudit, setShowMatAudit] = createSignal(false);
  const [showDeliv, setShowDeliv] = createSignal(false);
  const [showArch, setShowArch] = createSignal(false);
  const [showHand, setShowHand] = createSignal(false);
  const [showAccept, setShowAccept] = createSignal(false);

  const load = async () => {
    setLoading(true);
    const r = await getPlan(id());
    setLoading(false);
    if (r.code === 0) { setPlan(r.data); bus.emit('plan:changed', id()); }
    else { notify(r.message || '加载失败', 'error'); nav('/plans'); }
  };
  onMount(load);

  const op = async (fn: () => Promise<any>, succ: string) => {
    const r = await fn();
    if (r.code === 0) {
      notify(r.message || succ, 'success');
      if (r.data?.latestHandover) {
        setPlan((p: any) => p ? { ...p, latestHandover: r.data.latestHandover,
          handovers: [r.data.latestHandover, ...(p.handovers || [])] } : p);
      }
      if (r.data?.awaitingAccept) {
        setPlan((p: any) => p ? { ...p, awaitingAccept: r.data.awaitingAccept,
          latestHandover: r.data.awaitingAccept,
          handovers: [r.data.awaitingAccept, ...(p.handovers || [])] } : p);
      }
      await load();
      return true;
    } else {
      notify(r.message || '操作失败', 'error');
      return false;
    }
  };

  const submitAudit = () => op(() => _submitAudit(id()), '已提交审核');
  const submitMaterial = (info?: string) => op(() => _submitMaterial(id(), info), '素材已提交');
  const audit = async (pass: boolean, remark?: string) => {
    const r = await _audit(id(), pass, remark);
    if (r.code === 0) { notify(r.message || (pass ? '审核通过' : '已退回'), 'success'); await load(); setShowAudit(false); }
    else notify(r.message || '操作失败', 'error');
  };
  const auditMat = async (pass: boolean, remark?: string) => {
    const r = await _auditMaterial(id(), pass, remark);
    if (r.code === 0) { notify(r.message || (pass ? '素材通过' : '素材不通过'), 'success'); await load(); setShowMatAudit(false); }
    else notify(r.message || '操作失败', 'error');
  };
  const confirmDeliv = async (_: boolean, remark?: string) => {
    const r = await _confirmDelivery(id(), remark);
    if (r.code === 0) { notify(r.message || '投放已确认', 'success'); await load(); setShowDeliv(false); }
    else notify(r.message || '操作失败', 'error');
  };
  const archive = async (_: boolean, remark?: string) => {
    const r = await _archivePlan(id(), remark);
    if (r.code === 0) { notify(r.message || '已归档', 'success'); await load(); setShowArch(false); }
    else notify(r.message || '操作失败', 'error');
  };
  const handover = async (data: any) => {
    const r = await _handover(id(), data);
    if (r.code === 0) {
      notify(r.message || '交接成功', 'success');
      setPlan((p: any) => p ? { ...p, awaitingAccept: r.data.awaitingAccept, latestHandover: r.data.awaitingAccept,
        handovers: [r.data.awaitingAccept, ...(p.handovers || [])] } : p);
      await load();
      setShowHand(false);
    } else notify(r.message || '交接失败', 'error');
  };
  const acceptH = async (_: boolean, acceptRemark?: string) => {
    const r = await _acceptHandover(id(), acceptRemark);
    if (r.code === 0) {
      notify(r.message || '已确认接收', 'success');
      await load();
      setShowAccept(false);
    } else notify(r.message || '接收失败', 'error');
  };

  const perm = () => plan()?.permissions || {};
  const stepIdx = () => STEP_ORDER[plan()?.status || 'DRAFT'] || 1;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <button class="btn btn-default btn-sm" onClick={() => nav('/plans')}>← 返回列表</button>
        <div style={{ flex: 1 }} />
        <button class="btn btn-default btn-sm" onClick={load}>🔄 刷新详情</button>
      </div>

      <Show when={plan()}>
        <div class="card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 8 }}>
            <div class="page-title" style={{ margin: 0 }}>{plan()!.title}</div>
            <Badge status={plan()!.status} label={plan()!.statusName} />
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{plan()!.planNo}</span>
          </div>

          <div class="flow-steps">
            <For each={FLOW_STEPS}>{(s, i) => {
              const cur = stepIdx();
              const me = i() + 1;
              return (
                <div class={`flow-step ${me < cur ? 'done' : me === cur ? 'current' : ''}`}>
                  <span class="step-dot">{me < cur ? '✓' : me}</span>{s.label}
                </div>
              );
            }}</For>
          </div>

          <Show when={plan()!.awaitingAccept}>
            <div style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '1px solid #f59e0b', borderRadius: 10, padding: 14, margin: '10px 0 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span class="badge" style={{ background: '#f59e0b', color: '#fff' }}>⏳ {plan()!.awaitingAccept.stateName}</span>
                <span style={{ fontWeight: 600, color: '#92400e' }}>
                  该单据已交接，请接收人点击"确认接收"解锁后续办理按钮
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', fontSize: 13, color: '#78350f' }}>
                <div><b>交出人：</b><span class="tag tag-warn">{plan()!.awaitingAccept.fromShiftName}</span> {plan()!.awaitingAccept.handFrom.realName}</div>
                <div><b>接收人：</b><span class="tag">{plan()!.awaitingAccept.toShiftName}</span> {plan()!.awaitingAccept.handTo.realName}</div>
                <div style={{ gridColumn: '1 / -1' }}><b>交接时间：</b>{fmt(plan()!.awaitingAccept.confirmTime)}</div>
                <Show when={plan()!.awaitingAccept.remark}>
                  <div style={{ gridColumn: '1 / -1' }}><b>交接备注：</b>{plan()!.awaitingAccept.remark}</div>
                </Show>
              </div>
            </div>
          </Show>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <Show when={perm().canAcceptHandover}>
              <button class="btn btn-warn" style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#fff' }}
                onClick={() => setShowAccept(true)}>✅ 确认接收并开始办理</button>
            </Show>
            <Show when={perm().canEdit}>
              <button class="btn btn-default" onClick={() => setShowEdit(true)}>✏️ 编辑</button>
            </Show>
            <Show when={perm().canSubmitAudit}>
              <button class="btn btn-primary" onClick={submitAudit}>🚀 提交审核</button>
            </Show>
            <Show when={perm().canAuditPass || perm().canAuditReject}>
              <button class="btn btn-warn" onClick={() => setShowAudit(true)}>⚖️ 审核（通过/退回）</button>
            </Show>
            <Show when={perm().canMaterialSubmit}>
              <button class="btn btn-primary" onClick={() => setShowMat(true)}>📎 提交素材审核</button>
            </Show>
            <Show when={perm().canMaterialApprove || perm().canMaterialReject}>
              <button class="btn btn-warn" onClick={() => setShowMatAudit(true)}>🖼️ 素材审核（通过/退回）</button>
            </Show>
            <Show when={perm().canDeliveryConfirm}>
              <button class="btn btn-success" onClick={() => setShowDeliv(true)}>📡 确认投放完成</button>
            </Show>
            <Show when={perm().canArchive}>
              <button class="btn btn-primary" onClick={() => setShowArch(true)}>🗂️ 复核归档（闭环）</button>
            </Show>
            <Show when={perm().canHandover}>
              <button class="btn btn-default" onClick={() => setShowHand(true)}>🔁 跨班组交接</button>
            </Show>
          </div>
          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>
            ⚠️ 按钮根据您的岗位与单据当前状态动态显示/隐藏，所有操作通过后端校验；刷新页面后状态、统计、操作记录保持一致。
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-title">📋 基本信息</div>
            <div class="info-row"><div class="info-label">创建人</div><div class="info-val">{plan()!.createdBy?.realName || '-'} <span class="tag">{plan()!.createdBy?.roleName || ''}</span></div></div>
            <div class="info-row"><div class="info-label">当前处理人</div><div class="info-val">
              {plan()!.currentHandler
                ? <><span class="user-chip">{plan()!.currentHandler.realName}</span> <span class="tag">{plan()!.currentHandlerRoleName}</span></>
                : <span style={{ color: '#9ca3af' }}>（待接单，岗位：{plan()!.currentHandlerRoleName || '-'}）</span>}
            </div></div>
            <div class="info-row"><div class="info-label">当前处理岗位</div><div class="info-val">{plan()!.currentHandlerRoleName || '-'}</div></div>
            <div class="info-row"><div class="info-label">传播渠道</div><div class="info-val">{plan()!.channel || '-'}</div></div>
            <div class="info-row"><div class="info-label">目标受众</div><div class="info-val">{plan()!.targetAudience || '-'}</div></div>
            <div class="info-row"><div class="info-label">计划发布时间</div><div class="info-val">{fmt(plan()!.planPublishTime)}</div></div>
            <div class="info-row"><div class="info-label">创建时间</div><div class="info-val">{fmt(plan()!.createdAt)}</div></div>
            <div class="info-row"><div class="info-label">更新时间</div><div class="info-val">{fmt(plan()!.updatedAt)}</div></div>
            <div class="info-row"><div class="info-label">传播内容</div><div class="info-val" style={{ whiteSpace: 'pre-wrap' }}>{plan()!.content || '（无）'}</div></div>
            <div class="info-row"><div class="info-label">素材信息</div><div class="info-val" style={{ whiteSpace: 'pre-wrap' }}>{plan()!.materialInfo || '（未提交）'}</div></div>
          </div>

          <div class="card">
            <div class="card-title">
              <span>🔁 跨班组交接记录</span>
              <Show when={plan()!.latestHandover?.state === 'PENDING_ACCEPT'}>
                <span class="tag tag-warn">⏳ 待接收</span>
              </Show>
              <Show when={plan()!.latestHandover?.state === 'ACCEPTED'}>
                <span class="tag tag-success">✅ 已接收</span>
              </Show>
            </div>
            <Show when={plan()!.latestHandover}>
              <div style={{
                background: plan()!.latestHandover.state === 'PENDING_ACCEPT'
                  ? '#fffbeb' : '#eff6ff',
                borderRadius: 10, padding: 14, marginBottom: 10,
                border: '1px solid ' + (plan()!.latestHandover.state === 'PENDING_ACCEPT' ? '#f59e0b' : '#bfdbfe'),
              }}>
                <div style={{ fontSize: 13, color: plan()!.latestHandover.state === 'PENDING_ACCEPT' ? '#92400e' : '#1e40af', fontWeight: 600, marginBottom: 8 }}>
                  📌 最近一次交接：<span class="badge" style={{ marginLeft: 6,
                    background: plan()!.latestHandover.state === 'PENDING_ACCEPT' ? '#f59e0b' : '#1e40af', color: '#fff',
                  }}>{plan()!.latestHandover.stateName}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                  <div><b style={{ color: '#6b7280' }}>交出人：</b>{plan()!.latestHandover.handFrom.realName} <span class="tag tag-warn">{plan()!.latestHandover.fromShiftName}</span></div>
                  <div><b style={{ color: '#6b7280' }}>接收人：</b>{plan()!.latestHandover.handTo.realName} <span class="tag">{plan()!.latestHandover.toShiftName}</span></div>
                  <div style={{ gridColumn: '1 / -1' }}><b style={{ color: '#6b7280' }}>交接时间：</b>{fmt(plan()!.latestHandover.confirmTime)}</div>
                  <Show when={plan()!.latestHandover.acceptedAt}>
                    <div style={{ gridColumn: '1 / -1' }}><b style={{ color: '#6b7280' }}>接收时间：</b>{fmt(plan()!.latestHandover.acceptedAt)}</div>
                  </Show>
                  <Show when={plan()!.latestHandover.remark}>
                    <div style={{ gridColumn: '1 / -1' }}><b style={{ color: '#6b7280' }}>交接备注：</b>{plan()!.latestHandover.remark}</div>
                  </Show>
                  <Show when={plan()!.latestHandover.acceptRemark}>
                    <div style={{ gridColumn: '1 / -1' }}><b style={{ color: '#6b7280' }}>接收备注：</b>{plan()!.latestHandover.acceptRemark}</div>
                  </Show>
                </div>
              </div>
            </Show>
            <Show when={!plan()!.latestHandover}>
              <div class="empty" style={{ padding: '30px 0' }}>暂无交接记录</div>
            </Show>
            <Show when={plan()!.handovers?.length}>
              <div style={{ fontSize: 13, color: '#374151', fontWeight: 600, margin: '12px 0 6px' }}>历史交接（{plan()!.handovers.length}）</div>
              <For each={plan()!.handovers}>{(h: HandoverItem, i) => (
                <div style={{ padding: '8px 0', borderBottom: i() < plan()!.handovers.length - 1 ? '1px dashed #f0f0f0' : 'none', fontSize: 12 }}>
                  <div>
                    <span class={`badge ${h.state === 'PENDING_ACCEPT' ? 'badge-warn' : 'badge-success'}`}
                      style={{ marginRight: 6, fontSize: 11 }}>{h.stateName}</span>
                    <span class="tag tag-warn">{h.fromShiftName}</span>{h.handFrom.realName}
                    <span style={{ margin: '0 6px', color: '#9ca3af' }}>→</span>
                    <span class="tag">{h.toShiftName}</span>{h.handTo.realName}
                  </div>
                  <div style={{ color: '#9ca3af', marginTop: 2 }}>
                    交接：{fmt(h.confirmTime)}
                    {h.acceptedAt ? ' · 接收：' + fmt(h.acceptedAt) : ''}
                    {h.remark ? ' · ' + h.remark : ''}
                    {h.acceptRemark ? ' · 接收备注：' + h.acceptRemark : ''}
                  </div>
                </div>
              )}</For>
            </Show>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-title">🧾 审核 / 素材 / 投放 / 归档 痕迹</div>
            <div class="info-row">
              <div class="info-label">审核意见</div>
              <div class="info-val">
                {plan()!.auditRemark || '（暂无）'}
                {plan()!.auditTime && <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>处理时间：{fmt(plan()!.auditTime)}</div>}
              </div>
            </div>
            <div class="info-row">
              <div class="info-label">素材审核</div>
              <div class="info-val">
                {plan()!.materialRemark || '（暂无）'}
                {plan()!.materialTime && <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>处理时间：{fmt(plan()!.materialTime)}</div>}
              </div>
            </div>
            <div class="info-row">
              <div class="info-label">投放确认</div>
              <div class="info-val">
                {plan()!.deliveryRemark || '（暂无）'}
                {plan()!.deliveryTime && <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>处理时间：{fmt(plan()!.deliveryTime)}</div>}
              </div>
            </div>
            <div class="info-row">
              <div class="info-label">复核归档</div>
              <div class="info-val">
                {plan()!.reviewRemark || (plan()!.status === 'ARCHIVED' ? '（已归档）' : '（未归档）')}
                {plan()!.archiveTime && <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>归档时间：{fmt(plan()!.archiveTime)}</div>}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">📝 操作记录（全流程时间线）</div>
            <Show when={plan()!.logs?.length}>
              <div class="timeline">
                <For each={plan()!.logs}>{(l: LogItem) => (
                  <div class="tl-item">
                    <div class="tl-act">{l.description}</div>
                    <div class="tl-desc" style={{ fontSize: 12 }}>动作：{l.action}</div>
                    <div class="tl-meta">{l.operator?.realName || '-'} · {l.operator?.roleName || ''} · {fmt(l.createdAt)}</div>
                  </div>
                )}</For>
              </div>
            </Show>
            <Show when={!plan()!.logs?.length}>
              <div class="empty" style={{ padding: '20px 0' }}>暂无操作记录</div>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={loading() && !plan()}>
        <div class="empty">加载中…</div>
      </Show>

      <EditModal show={showEdit()} close={() => setShowEdit(false)} plan={plan} done={load} />

      <RemarkModal show={showAudit()} title="⚖️ 传播计划审核" passLabel="审核通过" rejectLabel="退回补正"
        close={() => setShowAudit(false)} onConfirm={audit} />

      <RemarkModal show={showMatAudit()} title="🖼️ 素材审核" passLabel="素材审核通过" rejectLabel="素材退回补正"
        close={() => setShowMatAudit(false)} onConfirm={auditMat} />

      <RemarkModal show={showDeliv()} title="📡 投放完成确认" passLabel="确认投放完成"
        close={() => setShowDeliv(false)} onConfirm={confirmDeliv} />

      <RemarkModal show={showArch()} title="🗂️ 复核归档（流程闭环）" passLabel="确认归档，流程闭环"
        close={() => setShowArch(false)} onConfirm={archive} />

      <HandoverModal show={showHand()} role={plan()?.currentHandlerRole} userId={user()?.id}
        close={() => setShowHand(false)} onConfirm={handover} />

      <RemarkModal show={showAccept()} title="✅ 确认接收交接" passLabel="确认接收并解锁办理"
        close={() => setShowAccept(false)} onConfirm={acceptH} />

      {/* 提交素材 */}
      <Show when={showMat()}>
        <SubmitMatModal close={() => setShowMat(false)} init={plan()?.materialInfo || ''}
          onConfirm={async (info) => {
            const r = await submitMaterial(info);
            if (r) setShowMat(false);
          }} />
      </Show>
    </div>
  );
}

function SubmitMatModal(props: { close: () => void; init: string; onConfirm: (info?: string) => Promise<boolean | void> }) {
  const [info, setInfo] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const { notify } = useUser();
  createEffect(() => { if (props.init) setInfo(props.init); });
  const ok = async () => {
    if (!info().trim()) return notify('素材信息不能为空', 'error');
    setLoading(true);
    await props.onConfirm(info());
    setLoading(false);
  };
  return (
    <div class="modal-mask" onClick={props.close}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-title">📎 提交素材审核</div>
        <div class="form-item">
          <label>素材信息（稿件、图、视频、物料链接/描述）*</label>
          <textarea rows={6} value={info()} onInput={(e) => setInfo(e.currentTarget.value)} placeholder="例如：【稿件】4800字主稿 【图】封面+8张内页 【视频】60s 预告片…" />
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onClick={props.close}>取消</button>
          <button class="btn btn-primary" onClick={ok} disabled={loading()}>{loading() ? '提交中…' : '提交素材审核'}</button>
        </div>
      </div>
    </div>
  );
}
