import { useNavigate } from "@solidjs/router";
import { createResource, createSignal, For, Show, Suspense, createEffect } from "solid-js";
import { api } from "../lib/api";

const statusColor = (s) => ({
  draft:"gray", pending_audit:"blue", reject_correction:"orange", audit_pass:"cyan",
  pending_review:"purple", reject_revision:"red", review_pass:"green",
  appeal_reviewing:"yellow", archived:"gray", overdue:"red", conflict:"red", review_reject:"red", closed:"gray"
}[s] || "gray");

const statusLabel = (s) => ({
  draft:"草稿", pending_audit:"待审核", reject_correction:"退回补正", audit_pass:"审核通过",
  pending_review:"待复核", reject_revision:"复核驳回", review_pass:"复核通过",
  appeal_reviewing:"申诉复核中", archived:"已归档", overdue:"逾期", conflict:"状态冲突",
  review_reject:"复核驳回", closed:"已关闭"
}[s] || s);

export default function Dashboard() {
  const nav = useNavigate();
  const user = () => { try { const s = localStorage.getItem("credit_user"); return s ? JSON.parse(s) : null; } catch { return null; } };
  const [stats, setStats] = createSignal({});
  const [todos, setTodos] = createSignal([]);
  const [refresh, setRefresh] = createSignal(0);

  const load = async () => {
    try {
      const u = user();
      const rs = await Promise.all([api.stats(), api.applications({handler_id: u?.id || 0})]);
      if (rs[0]?.ok) setStats(rs[0].data);
      if (rs[1]?.ok) setTodos(rs[1].data.slice(0, 8));
    } catch {}
  };

  createEffect(() => { refresh(); load(); });

  const statItems = () => {
    const s = stats() || {};
    const st = Object.fromEntries((s.byStatus || []).map(x => [x.status, x.n]));
    return [
      { label: "待审核", val: st.pending_audit || 0, color: "blue", key: "pending_audit" },
      { label: "待复核", val: st.pending_review || 0, color: "purple", key: "pending_review" },
      { label: "退回补正", val: st.reject_correction || 0, color: "orange", key: "reject_correction" },
      { label: "申诉中", val: st.appeal_reviewing || 0, color: "yellow", key: "appeal_reviewing" },
      { label: "逾期", val: s.overdue || 0, color: "red" },
      { label: "冲突", val: s.conflict || 0, color: "red" },
      { label: "已归档", val: s.archived || 0, color: "green", key: "archived" },
      { label: "证据不齐", val: s.evidenceBad || 0, color: "orange" },
    ];
  };

  return (
    <div>
      <div class="page-header">
        <div>
          <div class="page-title">工作台</div>
          <div style="font-size:13px; color:#6b7280; margin-top:4px">
            {user()?.department || ""} · {user()?.name || ""} · {({registrar:"授信登记员",auditor:"授信审核主管",reviewer:"B2B复核负责人"}[user()?.role] || "")}
          </div>
        </div>
        <div style="display:flex; gap:10px">
          <button class="btn btn-default btn-sm" onClick={() => setRefresh(r => r+1)}>↻ 刷新</button>
          <Show when={user()?.role === "registrar"}>
            <button class="btn btn-primary btn-sm" onClick={() => nav("/applications/new")}>+ 新建授信申请</button>
          </Show>
        </div>
      </div>

      <div class="page-content">
        <div class="stats-grid">
          <For each={statItems()}>
            {it => (
              <div class="stat-card" onClick={() => it.key && nav("/applications?status=" + it.key)} style={{cursor: it.key ? "pointer" : "default"}}>
                <div class={"stat-icon stat-" + it.color}>{it.label[0]}</div>
                <div>
                  <div class="stat-val">{it.val}</div>
                  <div class="stat-label">{it.label}</div>
                </div>
              </div>
            )}
          </For>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">我的待办队列（Top 8）</div>
            <button class="link-btn" onClick={() => nav("/applications")}>查看全部 →</button>
          </div>
          <div class="card-body" style="padding:0">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>申请编号</th><th>企业名称</th><th>授信额度</th>
                    <th>状态</th><th>证据</th><th>版本</th><th>更新时间</th><th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <Suspense fallback={<tr><td colspan="8" class="loading">加载中...</td></tr>}>
                    <Show when={todos().length > 0} fallback={<tr><td colspan="8" class="loading">暂无待办</td></tr>}>
                      <For each={todos()}>
                        {app => (
                          <tr class={app.is_overdue || app.has_conflict ? "highlight-row" : ""}>
                            <td style="font-family:monospace; color:#2563eb">{app.app_no}</td>
                            <td style="font-weight:500">{app.company_name}</td>
                            <td class="money">¥{(app.credit_line/10000).toFixed(1)}万</td>
                            <td><span class={"tag tag-" + statusColor(app.status)}>{statusLabel(app.status)}</span></td>
                            <td>
                              <span class={"tag tag-" + (app.evidence_status==="complete"?"green":app.evidence_status==="partial"?"yellow":"red")}>
                                {app.evidence_status==="complete"?"完整":app.evidence_status==="partial"?"部分":"缺失"}
                              </span>
                            </td>
                            <td>V{app.version}</td>
                            <td style="color:#6b7280; font-size:12px">{app.updated_at?.slice(5,16) || ""}</td>
                            <td><button class="link-btn" onClick={() => nav("/applications/" + app.id)}>处理 →</button></td>
                          </tr>
                        )}
                      </For>
                    </Show>
                  </Suspense>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style="margin-top:24px; display:grid; grid-template-columns:repeat(auto-fit, minmax(300px,1fr)); gap:16px">
          <div class="card">
            <div class="card-header"><div class="card-title">流程说明</div></div>
            <div class="card-body">
              <div style="display:flex; flex-direction:column; gap:12px; font-size:13px; color:#374151">
                <div style="display:flex; align-items:center; gap:10px">
                  <div class="tag tag-blue">登记</div>
                  <span>登记员发起或补正</span>
                </div>
                <div style="text-align:center; color:#9ca3af">↓</div>
                <div style="display:flex; align-items:center; gap:10px">
                  <div class="tag tag-purple">核验</div>
                  <span>审核主管办理（通过/退回/驳回）</span>
                </div>
                <div style="text-align:center; color:#9ca3af">↓</div>
                <div style="display:flex; align-items:center; gap:10px">
                  <div class="tag tag-green">复核归档</div>
                  <span>B2B复核负责人复核并归档</span>
                </div>
                <div style="margin-top:8px; padding:10px; background:#fef2f2; border-radius:6px; color:#b91c1c; font-size:12px">
                  ⚠ 异常路径：复核驳回后，登记员可申诉提交，再次进入复核。
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><div class="card-title">演示样例场景</div></div>
            <div class="card-body">
              <ul style="list-style:none; display:flex; flex-direction:column; gap:8px; font-size:13px">
                <li style="display:flex; gap:8px"><span class="tag tag-green">正常</span> 北京华信电子：待审核</li>
                <li style="display:flex; gap:8px"><span class="tag tag-orange">缺证据</span> 上海盛达贸易：退回补正</li>
                <li style="display:flex; gap:8px"><span class="tag tag-purple">正常</span> 广州鸿源食品：待复核</li>
                <li style="display:flex; gap:8px"><span class="tag tag-red">逾期</span> 深圳创新科技：审核逾期</li>
                <li style="display:flex; gap:8px"><span class="tag tag-green">归档</span> 成都锦绣服装：已完成归档</li>
                <li style="display:flex; gap:8px"><span class="tag tag-red">冲突</span> 杭州远见网络：关联企业冲突</li>
                <li style="display:flex; gap:8px"><span class="tag tag-yellow">申诉</span> 南京中泰化工：申诉复核中</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
