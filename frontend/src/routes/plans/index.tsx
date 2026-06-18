import { A, useNavigate } from '@solidjs/router';
import { createEffect, createSignal, For, onMount, Show } from 'solid-js';
import { listPlans, createPlan, batchAudit } from '../../api/plans';
import { Badge, useUser } from '../../app';
import type { PlanItem } from '../../api/client';

const STATUS_OPTIONS = [
  { v: '', l: '全部状态' },
  { v: 'DRAFT', l: '草稿' },
  { v: 'PENDING_AUDIT', l: '待审核' },
  { v: 'NEED_CORRECT', l: '需补正' },
  { v: 'AUDIT_PASSED', l: '审核通过' },
  { v: 'MATERIAL_PENDING', l: '待素材审核' },
  { v: 'MATERIAL_REJECTED', l: '素材审核不通过' },
  { v: 'MATERIAL_APPROVED', l: '素材审核通过' },
  { v: 'DELIVERY_PENDING', l: '待投放确认' },
  { v: 'DELIVERY_CONFIRMED', l: '投放已确认' },
  { v: 'ARCHIVED', l: '已归档' },
];

const fmt = (t: any) => t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '-';

function CreateModal(props: { show: boolean; close: () => void; done: () => void }) {
  const [title, setTitle] = createSignal('');
  const [content, setContent] = createSignal('');
  const [channel, setChannel] = createSignal('');
  const [aud, setAud] = createSignal('');
  const [time, setTime] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const { notify, bus } = useUser();
  const ok = async () => {
    if (!title().trim()) return notify('请填写标题', 'error');
    setLoading(true);
    const r = await createPlan({ title: title(), content: content(), channel: channel(), targetAudience: aud(), planPublishTime: time() });
    setLoading(false);
    if (r.code === 0) {
      notify('创建成功', 'success');
      bus.emit('plan:created', r.data.id);
      props.done(); props.close();
    } else notify(r.message || '创建失败', 'error');
  };
  const reset = () => { setTitle(''); setContent(''); setChannel(''); setAud(''); setTime(''); };
  createEffect(() => { if (props.show) reset(); });
  return (
    <Show when={props.show}>
      <div class="modal-mask" onClick={props.close}>
        <div class="modal" onClick={(e) => e.stopPropagation()}>
          <div class="modal-title">📝 新建传播计划单</div>
          <div class="form-item"><label>标题 *</label><input value={title()} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="例：Q3新品发布会官方公告" /></div>
          <div class="form-item"><label>渠道</label><input value={channel()} onInput={(e) => setChannel(e.currentTarget.value)} placeholder="例：官网+官微+视频号" /></div>
          <div class="form-item"><label>目标受众</label><input value={aud()} onInput={(e) => setAud(e.currentTarget.value)} placeholder="例：品牌粉丝+潜在消费者" /></div>
          <div class="form-item"><label>计划发布时间</label><input type="datetime-local" value={time()} onInput={(e) => setTime(e.currentTarget.value)} /></div>
          <div class="form-item"><label>传播内容摘要</label><textarea rows={4} value={content()} onInput={(e) => setContent(e.currentTarget.value)} placeholder="简要描述传播主题、节奏、关键信息点" /></div>
          <div class="modal-footer">
            <button class="btn btn-default" onClick={props.close}>取消</button>
            <button class="btn btn-primary" onClick={ok} disabled={loading()}>{loading() ? '提交中…' : '创建并保存为草稿'}</button>
          </div>
        </div>
      </div>
    </Show>
  );
}

function BatchModal(props: { show: boolean; ids: number[]; close: () => void; done: () => void }) {
  const [pass, setPass] = createSignal(true);
  const [remark, setRemark] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const { notify, bus } = useUser();
  const go = async () => {
    setLoading(true);
    const r = await batchAudit(props.ids, pass(), remark() || undefined);
    setLoading(false);
    if (r.code === 0) {
      notify(`批量处理成功：${r.data.successCount}条通过，${r.data.failCount}条失败`, r.data.failCount ? 'info' : 'success');
      bus.emit('plan:changed');
      props.done(); props.close();
    } else notify(r.message || '批量失败', 'error');
  };
  return (
    <Show when={props.show}>
      <div class="modal-mask" onClick={props.close}>
        <div class="modal" onClick={(e) => e.stopPropagation()}>
          <div class="modal-title">⚙️ 批量审核（{props.ids.length}条）</div>
          <div class="form-item">
            <label>操作类型</label>
            <select value={pass() ? '1' : '0'} onChange={(e) => setPass(e.currentTarget.value === '1')}>
              <option value="1">批量通过</option>
              <option value="0">批量退回补正</option>
            </select>
          </div>
          <div class="form-item"><label>审核备注</label><textarea rows={3} value={remark()} onInput={(e) => setRemark(e.currentTarget.value)} /></div>
          <div style={{ color: '#6b7280', fontSize: 12 }}>批量操作按单据状态逐一校验，状态不匹配或非本人待办的将跳过并返回原因，不影响其他单据处理。</div>
          <div class="modal-footer">
            <button class="btn btn-default" onClick={props.close}>取消</button>
            <button class="btn btn-primary" onClick={go} disabled={loading()}>{loading() ? '处理中…' : '确认批量处理'}</button>
          </div>
        </div>
      </div>
    </Show>
  );
}

export default function PlansIndex() {
  const [list, setList] = createSignal<PlanItem[]>([]);
  const [total, setTotal] = createSignal(0);
  const [page, setPage] = createSignal(1);
  const [pageSize] = createSignal(20);
  const [kw, setKw] = createSignal('');
  const [st, setSt] = createSignal('');
  const [only, setOnly] = createSignal(false);
  const [sel, setSel] = createSignal<number[]>([]);
  const [showCreate, setShowCreate] = createSignal(false);
  const [showBatch, setShowBatch] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const { user, notify, bus } = useUser();
  const nav = useNavigate();

  const load = async () => {
    setLoading(true);
    const r = await listPlans({ page: page(), pageSize: pageSize(), keyword: kw(), status: st(), onlyMine: only() });
    setLoading(false);
    if (r.code === 0) { setList(r.data.list); setTotal(r.data.total); }
    else notify(r.message || '加载失败', 'error');
  };

  onMount(() => {
    load();
    bus.on('plan:changed', () => { load(); });
    bus.on('plan:created', () => { setPage(1); load(); });
  });
  createEffect(() => { page(); st(); only(); kw(); });

  const toggleSel = (id: number, e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    setSel(s => checked ? [...s, id] : s.filter(x => x !== id));
  };
  const allChecked = () => list().length > 0 && sel().length === list().filter(p => p.status === 'PENDING_AUDIT').length;
  const toggleAll = (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    setSel(checked ? list().filter(p => p.status === 'PENDING_AUDIT').map(p => p.id) : []);
  };
  const canBatch = () => user()?.role === 'AUDIT' && sel().length > 0;

  return (
    <div>
      <div class="page-title">传播计划列表</div>
      <div class="page-desc">
        状态流转以后端为准，列表/详情/统计三者同源；您当前为
        <span class="tag"> {user()?.roleName} </span>
        ，可见字段与操作按钮按岗位动态控制。
      </div>

      <div class="card">
        <div class="toolbar">
          <input placeholder="🔍 搜索单号或标题" value={kw()} onInput={(e) => { setKw(e.currentTarget.value); setPage(1); setTimeout(load, 200); }} />
          <select value={st()} onChange={(e) => { setSt(e.currentTarget.value); setPage(1); setTimeout(load, 0); }}>
            <For each={STATUS_OPTIONS}>{o => <option value={o.v}>{o.l}</option>}</For>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151' }}>
            <input type="checkbox" checked={only()} onChange={(e) => { setOnly(e.currentTarget.checked); setPage(1); setTimeout(load, 0); }} />
            仅看我的
          </label>
          <div style={{ flex: 1 }} />
          <button class="btn btn-default" onClick={() => { setPage(1); load(); }}>刷新</button>
          <Show when={user()?.role === 'REGISTER'}>
            <button class="btn btn-primary" onClick={() => setShowCreate(true)}>＋ 新建计划</button>
          </Show>
        </div>

        <table class="data">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input type="checkbox" checked={allChecked()} onChange={toggleAll}
                  title="仅审核主管可批量勾选待审核单据" />
              </th>
              <th style={{ width: 170 }}>单据编号</th>
              <th>标题</th>
              <th style={{ width: 100 }}>状态</th>
              <th style={{ width: 130 }}>当前处理人</th>
              <th style={{ width: 130 }}>创建人</th>
              <th style={{ width: 160 }}>计划发布时间</th>
              <th style={{ width: 160 }}>更新时间</th>
              <th style={{ width: 80 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            <Show when={list().length}>
              <For each={list()}>{(p) => (
                <tr>
                  <td>
                    <input
                      type="checkbox" checked={sel().includes(p.id)}
                      disabled={p.status !== 'PENDING_AUDIT' || user()?.role !== 'AUDIT'}
                      onChange={(e) => toggleSel(p.id, e)}
                    />
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.planNo}</td>
                  <td>{p.title}</td>
                  <td><Badge status={p.status} label={p.statusName} /></td>
                  <td>
                    {p.currentHandler
                      ? <span class="user-chip">{p.currentHandler.realName} · {p.currentHandlerRoleName}</span>
                      : <span style={{ color: '#9ca3af' }}>（待接单）</span>}
                  </td>
                  <td>{p.createdBy?.realName || '-'}</td>
                  <td>{fmt(p.planPublishTime)}</td>
                  <td>{fmt(p.updatedAt)}</td>
                  <td>
                    <A href={`/plans/${p.id}`}>详情</A>
                  </td>
                </tr>
              )}</For>
            </Show>
          </tbody>
        </table>
        <Show when={!list().length && !loading()}>
          <div class="empty">暂无匹配的传播计划单</div>
        </Show>

        <div class="pagination">
          <span>共 {total()} 条</span>
          <button disabled={page() <= 1} onClick={() => { setPage(p => p - 1); load(); }}>上一页</button>
          <span>第 {page()} 页</span>
          <button disabled={page() * pageSize() >= total()} onClick={() => { setPage(p => p + 1); load(); }}>下一页</button>
        </div>

        <Show when={canBatch()}>
          <div class="batch-bar">
            <span>已选 {sel().length} 条待审核单据</span>
            <div style={{ flex: 1 }} />
            <button class="btn btn-default btn-sm" onClick={() => setSel([])}>清空选择</button>
            <button class="btn btn-success btn-sm" onClick={() => setShowBatch(true)}>批量审核</button>
          </div>
        </Show>
      </div>

      <CreateModal show={showCreate()} close={() => setShowCreate(false)} done={load} />
      <BatchModal show={showBatch()} ids={sel()} close={() => { setShowBatch(false); setSel([]); }} done={load} />
    </div>
  );
}
