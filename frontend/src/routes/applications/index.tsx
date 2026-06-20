import { useNavigate, useSearchParams } from "@solidjs/router";
import { createResource, createSignal, For, Show, Suspense, createEffect } from "solid-js";
import { api } from "../lib/api";

const statusColor = (s) => ({
  draft:"gray", pending_audit:"blue", reject_correction:"orange", audit_pass:"cyan",
  pending_review:"purple", reject_revision:"red", review_pass:"green",
  appeal_reviewing:"yellow", archived:"gray", overdue:"red", conflict:"red", review_reject:"red"
}[s] || "gray");
const statusLabel = (s) => ({
  draft:"草稿", pending_audit:"待审核", reject_correction:"退回补正", audit_pass:"审核通过",
  pending_review:"待复核", reject_revision:"复核驳回", review_pass:"复核通过",
  appeal_reviewing:"申诉复核中", archived:"已归档", overdue:"逾期", conflict:"状态冲突",
  review_reject:"复核驳回"
}[s] || s);

export default function Applications() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const user = () => { try { const s = localStorage.getItem("credit_user"); return s ? JSON.parse(s) : null; } catch { return null; } };

  const [statusList, setStatusList] = createSignal([]);
  const [keyword, setKeyword] = createSignal(params.keyword || "");
  const [filterStatus, setFilterStatus] = createSignal(params.status || "");
  const [filterRole, setFilterRole] = createSignal("");
  const [filterEv, setFilterEv] = createSignal("");
  const [chkOverdue, setChkOverdue] = createSignal(!!params.is_overdue);
  const [chkConflict, setChkConflict] = createSignal(!!params.has_conflict);
  const [mineOnly, setMineOnly] = createSignal(true);
  const [data, setData] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [ts, setTs] = createSignal(0);

  createEffect(async () => { ts();
    setLoading(true);
    const u = user();
    const query = {};
    if (keyword()) query.keyword = keyword();
    if (filterStatus()) query.status = filterStatus();
    if (filterRole()) query.role = filterRole();
    if (filterEv()) query.evidence_status = filterEv();
    if (chkOverdue()) query.is_overdue = 1;
    if (chkConflict()) query.has_conflict = 1;
    if (mineOnly() && u) query.handler_id = u.id;
    try {
      const r = await api.applications(query);
      if (r.ok) setData(r.data);
    } catch {}
    setLoading(false);
  });

  createEffect(async () => {
    try { const r = await api.statusDict(); if (r.ok) setStatusList(r.data); } catch {}
  }, []);

  const fmtMoney = (n) => "¥" + (n/10000).toFixed(1) + "万";

  return (
    <div>
      <div class="page-header">
        <div>
          <div class="page-title">授信申请队列</div>
          <div style="font-size:13px; color:#6b7280; margin-top:4px">
            共 {data().length} 条记录 {mineOnly() && "（仅当前处理人）"}
          </div>
        </div>
        <div style="display:flex; gap:10px">
          <label style="font-size:13px; display:flex; align-items:center; gap:6px; color:#374151">
            <input type="checkbox" checked={mineOnly()} onChange={e => setMineOnly(e.target.checked)} /> 仅看我的
          </label>
          <button class="btn btn-default btn-sm" onClick={() => setTs(t => t+1)}>↻ 刷新</button>
          <Show when={user()?.role === "registrar"}>
            <button class="btn btn-primary btn-sm" onClick={() => nav("/applications/new")}>+ 新建申请</button>
          </Show>
        </div>
      </div>

      <div class="page-content">
        <div class="search-bar">
          <div class="search-item">
            <label>关键词</label>
            <input placeholder="企业/编号/申请人" value={keyword()} onInput={e => { setKeyword(e.target.value); setParams({...params, keyword: e.target.value}); }} />
          </div>
          <div class="search-item">
            <label>状态</label>
            <select value={filterStatus()} onChange={e => { setFilterStatus(e.target.value); setParams({...params, status: e.target.value}); }}>
              <option value="">全部</option>
              <For each={statusList()}>{s => <option value={s.key}>{s.label}</option>}</For>
            </select>
          </div>
          <div class="search-item">
            <label>当前处理角色</label>
            <select value={filterRole()} onChange={e => setFilterRole(e.target.value)}>
              <option value="">全部</option>
              <option value="registrar">授信登记员</option>
              <option value="auditor">授信审核主管</option>
              <option value="reviewer">B2B复核负责人</option>
            </select>
          </div>
          <div class="search-item">
            <label>证据状态</label>
            <select value={filterEv()} onChange={e => setFilterEv(e.target.value)}>
              <option value="">全部</option>
              <option value="complete">完整</option>
              <option value="partial">部分</option>
              <option value="incomplete">缺失</option>
            </select>
          </div>
          <div class="search-item" style="flex-direction:row; align-items:center; gap:16px; padding-bottom:0">
            <label style="display:flex; align-items:center; gap:6px; margin-bottom:0; font-size:13px">
              <input type="checkbox" checked={chkOverdue()} onChange={e => { setChkOverdue(e.target.checked); if(e.target.checked) setParams({...params, is_overdue:1}); }} /> 仅看逾期
            </label>
            <label style="display:flex; align-items:center; gap:6px; margin-bottom:0; font-size:13px">
              <input type="checkbox" checked={chkConflict()} onChange={e => { setChkConflict(e.target.checked); if(e.target.checked) setParams({...params, has_conflict:1}); }} /> 仅看冲突
            </label>
          </div>
          <div style="margin-left:auto">
            <button class="btn btn-default btn-sm" onClick={() => { setKeyword(""); setFilterStatus(""); setFilterRole(""); setFilterEv(""); setChkOverdue(false); setChkConflict(false); setParams({}); }}>重置</button>
          </div>
        </div>

        <div class="card">
          <div class="card-body" style="padding:0">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>申请编号</th><th>企业名称</th><th>授信额度</th>
                    <th>申请人</th><th>当前处理人</th><th>状态</th>
                    <th>证据</th><th>版本</th>
                    <th>逾期/冲突</th><th>更新时间</th><th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <Suspense fallback={<tr><td colspan="11" class="loading">加载中...</td></tr>}>
                    <Show when={!loading()} fallback={<tr><td colspan="11" class="loading">加载中...</td></tr>}>
                      <Show when={data().length > 0} fallback={<tr><td colspan="11" class="loading">暂无数据</td></tr>}>
                        <For each={data()}>
                          {app => (
                            <tr class={(app.is_overdue || app.has_conflict) ? "highlight-row" : ""}>
                              <td style="font-family:monospace; color:#2563eb; font-weight:500">{app.app_no}</td>
                              <td style="font-weight:500">{app.company_name}
                                <div style="font-size:11px; color:#9ca3af; margin-top:2px">{app.business_type || ""}</div>
                              </td>
                              <td class="money" style="font-weight:500">{fmtMoney(app.credit_line)}</td>
                              <td>{app.applicant || "-"}<div style="font-size:11px; color:#9ca3af">{app.contact_phone || ""}</div></td>
                              <td>
                                <Show when={app.handler_name}>{app.handler_name}
                                  <div style="font-size:11px; color:#6b7280">
                                    {({registrar:"登记员",auditor:"审核主管",reviewer:"复核负责人"}[app.current_handler_role] || "")}
                                  </div>
                                </Show>
                                <Show when={!app.handler_name}>-</Show>
                              </td>
                              <td><span class={"tag tag-" + statusColor(app.status)}>{statusLabel(app.status)}</span></td>
                              <td>
                                <span class={"tag tag-" + (app.evidence_status==="complete"?"green":app.evidence_status==="partial"?"yellow":"red")}>
                                  {app.evidence_status==="complete"?"完整":app.evidence_status==="partial"?"部分":"缺失"}
                                </span>
                              </td>
                              <td>V{app.version}</td>
                              <td>
                                <div style="display:flex; gap:4px">
                                  <Show when={app.is_overdue}><span class="tag tag-red">逾期</span></Show>
                                  <Show when={app.has_conflict}><span class="tag tag-red">冲突</span></Show>
                                  <Show when={!app.is_overdue && !app.has_conflict}><span style="color:#d1d5db">-</span></Show>
                                </div>
                              </td>
                              <td style="font-size:12px; color:#6b7280">{app.updated_at?.slice(0,16) || ""}</td>
                              <td><button class="link-btn" onClick={() => nav("/applications/" + app.id)}>查看/处理</button></td>
                            </tr>
                          )}
                        </For>
                      </Show>
                    </Show>
                  </Suspense>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
