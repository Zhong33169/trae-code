import { createEffect, createSignal, For, onMount, Show } from 'solid-js';
import { statistics } from '../../api/plans';
import { Badge, useUser } from '../../app';
import { STATUS_COLOR } from '../../app';

const STATUS_ORDER = [
  'DRAFT', 'PENDING_AUDIT', 'NEED_CORRECT', 'AUDIT_PASSED',
  'MATERIAL_PENDING', 'MATERIAL_REJECTED', 'MATERIAL_APPROVED',
  'DELIVERY_PENDING', 'DELIVERY_CONFIRMED', 'ARCHIVED',
];

export default function Stat() {
  const [data, setData] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(true);
  const { notify, bus } = useUser();

  const load = async () => {
    setLoading(true);
    const r = await statistics();
    setLoading(false);
    if (r.code === 0) setData(r.data);
    else notify(r.message || '加载失败', 'error');
  };
  onMount(() => {
    load();
    bus.on('plan:changed', load);
    bus.on('plan:created', load);
  });
  createEffect(() => {});

  const maxByStatus = () => Math.max(1, ...STATUS_ORDER.map(k => (data()?.byStatus || {})[k] || 0));

  return (
    <div>
      <div class="page-title">📊 统计看板</div>
      <div class="page-desc">统计数据与列表、详情使用同一数据源，后端聚合计算，刷新后保证一致。</div>

      <div class="card" style={{ marginBottom: 16 }}>
        <div class="card-title">🔁 全链路汇总（待接收 / 处理中 / 已归档）</div>
        <div class="grid-3">
          {([
            { k: 'PENDING_ACCEPT', color: '#f59e0b', bg: '#fffbeb', title: '待接收', sub: '已交接，等待接收人确认接单' },
            { k: 'PROCESSING', color: '#2563eb', bg: '#eff6ff', title: '处理中', sub: '已确认接收，正在办理流转中' },
            { k: 'ARCHIVED', color: '#059669', bg: '#ecfdf5', title: '已归档', sub: '全流程闭环完成' },
          ] as const).map((b) => {
            const count = (data()?.byBucket || {})[b.k] || 0;
            const total = data()?.total || 1;
            const pct = (count / total * 100).toFixed(1);
            return (
              <div style={{
                background: b.bg, border: `1px solid ${b.color}33`, borderRadius: 12, padding: '16px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 14, color: '#111827', fontWeight: 600 }}>{b.title}</div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: b.color, color: '#fff' }}>{pct}%</span>
                </div>
                <div style={{ fontSize: 30, fontWeight: 700, color: b.color, lineHeight: 1.1 }}>{count}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{b.sub}</div>
                <div style={{ height: 6, background: '#fff', borderRadius: 999, marginTop: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: b.color, borderRadius: 999 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div class="grid-4">
        <div class="stat-card">
          <div class="stat-num">{data()?.total ?? 0}</div>
          <div class="stat-label">传播计划单总数</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style={{ color: '#059669' }}>{data()?.closedCount ?? 0}</div>
          <div class="stat-label">已闭环归档</div>
          <div class="stat-bar"><div style={{ width: `${data()?.closedRate ?? 0}%` }} /></div>
          <div style={{ fontSize: 12, color: '#059669', marginTop: 4, fontWeight: 600 }}>闭环率 {data()?.closedRate ?? 0}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style={{ color: '#d97706' }}>{data()?.pendingCount ?? 0}</div>
          <div class="stat-label">处理中（未归档）</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style={{ color: '#2563eb' }}>{data()?.todayCount ?? 0}</div>
          <div class="stat-label">今日新增</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">📈 按状态分布</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <For each={STATUS_ORDER}>{(k) => {
              const count = (data()?.byStatus || {})[k] || 0;
              const pct = (count / maxByStatus() * 100).toFixed(1);
              const label = data()?.statusLabels?.[k] || k;
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span><Badge status={k} label={label} /></span>
                    <span style={{ color: '#374151', fontWeight: 600 }}>{count} 条</span>
                  </div>
                  <div style={{ height: 10, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: STATUS_COLOR[k] || '#999', borderRadius: 6, transition: '.3s' }} />
                  </div>
                </div>
              );
            }}</For>
          </div>
        </div>

        <div class="card">
          <div class="card-title">🧑‍💼 按岗位当前在办</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(['REGISTER', 'AUDIT', 'REVIEW'] as const).map(k => {
              const count = (data()?.byRole || {})[k] || 0;
              const label = data()?.roleLabels?.[k] || k;
              const total = data()?.total || 1;
              const pct = (count / total * 100).toFixed(1);
              const color = k === 'REGISTER' ? '#6366f1' : k === 'AUDIT' ? '#059669' : '#0891b2';
              return (
                <div style={{ background: '#f9fafb', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{label}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>当前持有单据数量</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 26, fontWeight: 700, color }}>{count}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>占比 {pct}%</div>
                    </div>
                  </div>
                  <div class="stat-bar" style={{ marginTop: 10 }}><div style={{ width: `${pct}%`, background: color }} /></div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 22, fontSize: 13, color: '#374151', fontWeight: 600, marginBottom: 10 }}>📘 岗位与流程说明</div>
          <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.8 }}>
            <div>• <b>传播计划登记员</b>：发起/补正、提交审核、提交素材、发起岗位内跨班组交接</div>
            <div>• <b>传播计划审核主管</b>：审核、素材审核、确认投放、发起岗位内跨班组交接</div>
            <div>• <b>公关传播团队复核负责人</b>：复核归档（闭环终点）</div>
            <div style={{ marginTop: 6, color: '#1e40af' }}>
              ✔ 传播计划 / 素材审核 / 投放确认三块操作会互相影响传播计划单状态
            </div>
            <div style={{ color: '#1e40af' }}>
              ✔ 交接记录结构化存库：谁交出、谁接收、哪个班次、何时确认，详情立即展示
            </div>
            <div style={{ color: '#1e40af' }}>
              ✔ 后端状态为唯一真值，刷新后列表数量 / 详情状态 / 统计 / 操作记录一致
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
        <button class="btn btn-default" onClick={load}>🔄 刷新统计</button>
      </div>

      <Show when={loading() && !data()}>
        <div class="empty">加载中…</div>
      </Show>
    </div>
  );
}
