import { createEffect, createSignal, For, Show } from "solid-js";
import { api } from "../lib/api";

const statusLabel = (s) => ({
  draft:"草稿", pending_audit:"待审核", reject_correction:"退回补正", audit_pass:"审核通过",
  pending_review:"待复核", reject_revision:"复核驳回", review_pass:"复核通过",
  appeal_reviewing:"申诉复核中", archived:"已归档", overdue:"逾期", conflict:"状态冲突", review_reject:"复核驳回", closed:"已关闭"
}[s] || s);
const statusColor = (s) => ({
  draft:"gray", pending_audit:"blue", reject_correction:"orange", audit_pass:"cyan",
  pending_review:"purple", reject_revision:"red", review_pass:"green",
  appeal_reviewing:"yellow", archived:"gray", overdue:"red", conflict:"red"
}[s] || "gray");

export default function Stats() {
  const [data, setData] = createSignal(null);
  const [apps, setApps] = createSignal([]);
  const [loading, setLoading] = createSignal(true);

  createEffect(async () => {
    try {
      const [r1, r2] = await Promise.all([api.stats(), api.applications({})]);
      if (r1 && r1.ok) setData(r1.data);
      if (r2 && r2.ok) setApps(r2.data);
    } finally { setLoading(false); }
  });

  const d = () => data() || {};
  const byStatus = () => Object.fromEntries((d().byStatus || []).map(x => [x.status, x.n]));
  const byRole = () => Object.fromEntries((d().byRole || []).map(x => [x.current_handler_role, x.n]));

  const bars = () => {
    const vals = Object.values(byStatus() || {});
    const max = Math.max(1, ...vals);
    return Object.entries(byStatus() || {}).map(([k,v]) => ({k, v, pct: Math.round((v/max)*100)}));
  };

  const maxRole = () => Math.max(1, ...Object.values(byRole() || {}));

  return (
    <div>
      <div class="page-header">
        <div class="page-title">统计分析</div>
        <button class="btn btn-default btn-sm" onClick={() => window.location.reload()}>↻ 刷新</button>
      </div>
      <div class="page-content">
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-icon stat-blue">总</div>
            <div><div class="stat-val">{d().total || 0}</div><div class="stat-label">授信申请总数</div></div></div>
          <div class="stat-card"><div class="stat-icon stat-green">√</div>
            <div><div class="stat-val">{d().archived || 0}</div><div class="stat-label">已归档完成</div></div></div>
          <div class="stat-card"><div class="stat-icon stat-red">!</div>
            <div><div class="stat-val">{d().overdue || 0}</div><div class="stat-label">逾期处理</div></div></div>
          <div class="stat-card"><div class="stat-icon stat-red">×</div>
            <div><div class="stat-val">{d().conflict || 0}</div><div class="stat-label">状态冲突</div></div></div>
          <div class="stat-card"><div class="stat-icon stat-orange">◌</div>
            <div><div class="stat-val">{d().evidenceBad || 0}</div><div class="stat-label">证据缺失</div></div></div>
          <div class="stat-card"><div class="stat-icon stat-cyan">％</div>
            <div><div class="stat-val">
              {d().total ? Math.round(((d().archived || 0) / d().total) * 100) : 0}%
            </div><div class="stat-label">归档率</div></div></div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px">
          <div class="card">
            <div class="card-header"><div class="card-title">按状态分布</div></div>
            <div class="card-body">
              <Show when={!loading()}>
                <div style="display:flex; flex-direction:column; gap:14px">
                  <For each={bars()}>
                    {b => (
                      <div>
                        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px">
                          <span><span class={"tag tag-" + statusColor(b.k)} style="margin-right:8px">{statusLabel(b.k)}</span></span>
                          <span style="font-weight:600; color:#111827">{b.v}</span>
                        </div>
                        <div style="height:8px; background:#f3f4f6; border-radius:4px; overflow:hidden">
                          <div style={"height:100%; width:" + b.pct + "%; background: linear-gradient(90deg, #2563eb, #7c3aed); border-radius:4px"}></div>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><div class="card-title">按当前处理角色分布</div></div>
            <div class="card-body">
              <Show when={!loading()}>
                <div style="display:flex; flex-direction:column; gap:16px">
                  <Show when={Object.keys(byRole()||{}).length === 0}><div class="loading">暂无数据</div></Show>
                  <For each={Object.entries(byRole() || {})}>
                    {([k,v]) => (
                      <div style="display:flex; align-items:center; gap:12px">
                        <div style="flex:0 0 140px; font-size:13px; color:#374151">
                          {({registrar:"授信登记员",auditor:"授信审核主管",reviewer:"B2B复核负责人"}[k] || k)}
                        </div>
                        <div style="flex:1">
                          <div style="height:24px; background:#f3f4f6; border-radius:12px; overflow:hidden; position:relative">
                            <div style={"height:100%; width:" + Math.round((v/maxRole())*100) + "%; background:" + (k==="registrar"?"#2563eb":k==="auditor"?"#7c3aed":"#16a34a") + "; border-radius:12px"}></div>
                            <span style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:12px; color:white; font-weight:600; text-shadow:0 1px 2px rgba(0,0,0,.2)">
                              {v} 单
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">全量申请清单</div></div>
          <div class="card-body" style="padding:0">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>编号</th><th>企业</th><th>额度</th><th>状态</th><th>证据</th>
                    <th>版本</th><th>当前处理人</th><th>异常标记</th><th>更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={apps()}>
                    {a => (
                      <tr class={(a.is_overdue||a.has_conflict) ? "highlight-row" : ""}>
                        <td style="font-family:monospace; color:#2563eb">{a.app_no}</td>
                        <td style="font-weight:500">{a.company_name}</td>
                        <td class="money">¥{(a.credit_line/10000).toFixed(1)}万</td>
                        <td><span class={"tag tag-" + statusColor(a.status)}>{statusLabel(a.status)}</span></td>
                        <td>
                          <span class={"tag tag-" + (a.evidence_status==="complete"?"green":a.evidence_status==="partial"?"yellow":"red")}>
                            {a.evidence_status==="complete"?"完整":a.evidence_status==="partial"?"部分":"缺失"}
                          </span>
                        </td>
                        <td>V{a.version}</td>
                        <td>{a.handler_name || "-"}<div style="font-size:11px;color:#9ca3af">{({registrar:"登记员",auditor:"审核主管",reviewer:"复核负责人"}[a.current_handler_role] || "")}</div></td>
                        <td>
                          <div style="display:flex;gap:4px">
                            <Show when={a.is_overdue}><span class="tag tag-red">逾期</span></Show>
                            <Show when={a.has_conflict}><span class="tag tag-red">冲突</span></Show>
                            <Show when={!a.is_overdue && !a.has_conflict}><span style="color:#d1d5db">-</span></Show>
                          </div>
                        </td>
                        <td style="font-size:12px;color:#6b7280">{a.updated_at ? a.updated_at.slice(0,16) : ""}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
