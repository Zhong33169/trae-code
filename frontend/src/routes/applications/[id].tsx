import { useNavigate, useParams } from "@solidjs/router";
import { createSignal, For, Show, onMount } from "solid-js";
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
const nodeLabel = (t) => ({register:"授信申请登记", audit:"过程核验(审核)", review:"复核归档", appeal:"申诉提交", correction:"补正"}[t] || t);

export default function ApplicationDetail() {
  const params = useParams();
  const nav = useNavigate();
  const id = parseInt(params.id);
  const user = () => { try { return JSON.parse(localStorage.getItem("credit_user") || "null"); } catch { return null; } };

  const [data, setData] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const [modal, setModal] = createSignal(null); // {action, title, needReject}
  const [opinion, setOpinion] = createSignal("");
  const [rejectReason, setRejectReason] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [toast, setToast] = createSignal(null);

  const showToast = (msg, type="success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    setLoading(true);
    try { const r = await api.application(id); if (r.ok) setData(r.data); } catch {}
    setLoading(false);
  };

  onMount(load);

  const app = () => data()?.app;
  const evidence = () => data()?.evidence || [];
  const nodes = () => data()?.nodes || [];
  const logs = () => data()?.logs || [];

  const isMyTurn = () => {
    const a = app(); const u = user();
    if (!a || !u) return false;
    return a.current_handler_id === u.id;
  };

  const canDo = (action) => {
    const a = app(); const u = user();
    if (!a || !u) return false;
    const actions = {
      registrar: { draft: ["register_submit"], reject_correction: ["correction_resubmit"], reject_revision: ["appeal_submit"] },
      auditor: { pending_audit: ["audit_pass","audit_correction","audit_reject"], overdue: ["audit_pass","audit_correction","audit_reject"], conflict: ["audit_pass"] },
      reviewer: { pending_review: ["review_pass","review_reject","review_archive"], appeal_reviewing: ["review_pass","review_reject","review_archive"], conflict: ["review_pass","review_reject","review_archive"], review_pass: ["review_archive"] },
    };
    const list = (actions[u.role] || {})[a.status] || [];
    return list.includes(action) && a.current_handler_id === u.id;
  };

  const toggleEvidence = async (eid, current) => {
    if (user()?.role !== "registrar") { showToast("仅登记员可编辑证据", "error"); return; }
    const next = !current;
    try {
      const r = await api.updateEvidence(id, eid, {
        is_submitted: next ? 1 : 0,
        file_name: next ? ("manual_" + eid + ".pdf") : null,
        remark: next ? "通过系统标记已提交" : null
      });
      if (r.ok) { showToast(next ? "证据已标记提交" : "已撤回提交"); load(); }
      else { showToast(r.msg || "操作失败", "error"); }
    } catch { showToast("操作失败", "error"); }
  };

  const openAction = (action) => {
    const titles = {
      register_submit: "提交审核",
      correction_resubmit: "补正后再次提交审核",
      audit_pass: "审核通过",
      audit_correction: "退回补正（登记员修改后重提）",
      audit_reject: "审核驳回",
      review_pass: "复核通过",
      review_reject: "复核驳回（可申诉）",
      review_archive: "复核通过并归档",
      appeal_submit: "提交申诉（再次进入复核）",
    };
    setOpinion("");
    setRejectReason("");
    const needReject = ["audit_correction","audit_reject","review_reject"].includes(action);
    setModal({ action, title: titles[action] || action, needReject });
  };

  const submitAction = async () => {
    const m = modal();
    if (!m) return;
    if (m.needReject && !rejectReason()) { showToast("请填写驳回/退回原因", "error"); return; }
    setSaving(true);
    try {
      const r = await api.action(id, {
        action: m.action,
        opinion: opinion() || (m.needReject ? rejectReason() : "（无意见）"),
        reject_reason: m.needReject ? rejectReason() : null,
        client_version: app()?.version,
      });
      if (r.ok) {
        showToast("操作成功");
        setModal(null);
        load();
      } else {
        showToast(r.msg || "操作失败，状态未改变", "error");
        load();
      }
    } catch (e) {
      showToast("网络错误，原状态已保留", "error");
    }
    setSaving(false);
  };

  const fmtMoney = (n) => n ? ("¥ " + Number(n).toLocaleString("zh-CN") + " 元") : "-";

  return (
    <div>
      <div class="page-header">
        <div>
          <div style="display:flex; align-items:center; gap:12px">
            <button class="btn btn-default btn-sm" onClick={() => nav(-1)}>← 返回</button>
            <div class="page-title">授信申请详情</div>
            <span style="font-family:monospace; background:#eff6ff; color:#1d4ed8; padding:4px 10px; border-radius:6px; font-size:13px">
              {app()?.app_no || "加载中..."}
            </span>
            <span class={"tag tag-" + statusColor(app()?.status)}>{statusLabel(app()?.status)}</span>
            <Show when={app()?.is_overdue}><span class="tag tag-red">逾期</span></Show>
            <Show when={app()?.has_conflict}><span class="tag tag-red">状态冲突</span></Show>
            <span class="tag tag-gray">V{app()?.version || 1}</span>
          </div>
          <div style="font-size:13px; color:#6b7280; margin-top:8px; margin-left:88px">
            {app()?.company_name} · 当前处理人：{app()?.handler_name || "-"} ({({registrar:"登记员",auditor:"审核主管",reviewer:"复核负责人"}[app()?.current_handler_role] || "")})
          </div>
        </div>
        <Show when={isMyTurn() && !loading()}>
          <div style="display:flex; gap:8px; flex-wrap: wrap; justify-content:flex-end">
            <Show when={canDo("register_submit")}><button class="btn btn-primary btn-sm" onClick={() => openAction("register_submit")}>提交审核</button></Show>
            <Show when={canDo("correction_resubmit")}><button class="btn btn-primary btn-sm" onClick={() => openAction("correction_resubmit")}>补正后重提</button></Show>
            <Show when={canDo("appeal_submit")}><button class="btn btn-warning btn-sm" onClick={() => openAction("appeal_submit")}>申诉提交</button></Show>

            <Show when={canDo("audit_pass")}><button class="btn btn-success btn-sm" onClick={() => openAction("audit_pass")}>审核通过</button></Show>
            <Show when={canDo("audit_correction")}><button class="btn btn-warning btn-sm" onClick={() => openAction("audit_correction")}>退回补正</button></Show>
            <Show when={canDo("audit_reject")}><button class="btn btn-danger btn-sm" onClick={() => openAction("audit_reject")}>审核驳回</button></Show>

            <Show when={canDo("review_pass")}><button class="btn btn-success btn-sm" onClick={() => openAction("review_pass")}>复核通过</button></Show>
            <Show when={canDo("review_reject")}><button class="btn btn-danger btn-sm" onClick={() => openAction("review_reject")}>复核驳回</button></Show>
            <Show when={canDo("review_archive")}><button class="btn btn-primary btn-sm" onClick={() => openAction("review_archive")}>归档完成</button></Show>
          </div>
        </Show>
        <Show when={!isMyTurn() && !loading()}>
          <div style="color:#9ca3af; font-size:13px">非当前处理人，仅可查看</div>
        </Show>
      </div>

      <div class="page-content">
        <Show when={loading()}><div class="loading">加载中...</div></Show>

        <Show when={!loading() && app()}>
          <Show when={app()?.prev_opinion && (["pending_audit","pending_review","appeal_reviewing","reject_correction","reject_revision","conflict","overdue","review_pass"].includes(app()?.status))}>
            <div class="prev-card">
              <div class="p-label">
                ↓ 上一处理人：{app()?.prev_handler_name || "-"}（{({registrar:"登记员",auditor:"审核主管",reviewer:"复核负责人"}[app()?.prev_handler_role] || "")}）
                · 结果：{({submit:"已提交",pass:"通过",correction:"退回补正",reject:"驳回",appeal:"申诉",archive:"归档"}[app()?.prev_result] || "")}
              </div>
              <div class="p-opinion">{app()?.prev_opinion}</div>
              <Show when={app()?.reject_reason}>
                <div class="p-meta">
                  <span>⚠ 驳回/退回原因：{app()?.reject_reason}</span>
                </div>
              </Show>
            </div>
          </Show>

          <div class="card" style="margin-bottom:20px">
            <div class="card-header"><div class="card-title">基本信息</div>
              <div style="font-size:12px;color:#6b7280">创建：{app()?.creator_name || "-"} · {app()?.created_at?.slice(0,16) || ""} · 更新：{app()?.updated_at?.slice(0,16) || ""}</div>
            </div>
            <div class="card-body">
              <div class="detail-grid">
                <div class="detail-item"><label>企业名称</label><div class="val">{app()?.company_name}</div></div>
                <div class="detail-item"><label>业务类型</label><div class="val">{app()?.business_type || "-"}</div></div>
                <div class="detail-item"><label>申请授信额度</label><div class="val" style="color:#2563eb; font-size:16px">{fmtMoney(app()?.credit_line)}</div></div>
                <div class="detail-item"><label>币种</label><div class="val">{app()?.currency || "CNY"}</div></div>
                <div class="detail-item"><label>申请人</label><div class="val">{app()?.applicant || "-"}</div></div>
                <div class="detail-item"><label>联系电话</label><div class="val">{app()?.contact_phone || "-"}</div></div>
                <div class="detail-item"><label>证据状态</label>
                  <div class="val"><span class={"tag tag-" + (app()?.evidence_status==="complete"?"green":app()?.evidence_status==="partial"?"yellow":"red")}>
                    {app()?.evidence_status==="complete"?"完整":app()?.evidence_status==="partial"?"部分":"缺失"}
                  </span></div>
                </div>
                <div class="detail-item"><label>处理截止（如有）</label><div class="val">{app()?.deadline?.slice(0,16) || "-"}</div></div>
                <div class="detail-item" style="grid-column: 1 / -1"><label>备注</label><div class="val" style="color:#6b7280; font-weight:400">{app()?.remark || app()?.reject_reason || "无"}</div></div>
              </div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px">
            <div class="card">
              <div class="card-header"><div class="card-title">证据清单</div>
                <span style="font-size:12px;color:#6b7280">登记员可点击切换提交状态</span>
              </div>
              <div class="card-body">
                <div class="evidence-list">
                  <For each={evidence()}>
                    {ev => (
                      <div class={"ev-item " + (ev.is_required ? "req" : "")}>
                        <div class={"ev-check " + (ev.is_submitted ? "ok" : "")}>{ev.is_submitted ? "✓" : ""}</div>
                        <div>
                          <div style="font-weight:500; font-size:13px">{ev.evidence_name}
                            {!ev.is_required && <span style="margin-left:6px; color:#9ca3af; font-size:11px">（选填）</span>}
                          </div>
                          <Show when={ev.is_submitted}>
                            <div style="font-size:11px; color:#6b7280; margin-top:2px">
                              {ev.file_name} · {ev.submit_time?.slice(0,16) || ""}
                              <Show when={ev.remark}> · {ev.remark}</Show>
                            </div>
                          </Show>
                        </div>
                        <span class={"tag tag-" + (ev.is_submitted ? "green" : "gray")}>{ev.is_submitted ? "已提交" : "未提交"}</span>
                        <Show when={user()?.role === "registrar" && app()?.status !== "archived"}>
                          <button class="link-btn" onClick={() => toggleEvidence(ev.id, !!ev.is_submitted)}>
                            {ev.is_submitted ? "撤回" : "标记提交"}
                          </button>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-header"><div class="card-title">流程节点</div></div>
              <div class="card-body">
                <div class="process-line">
                  <For each={nodes()}>
                    {n => (
                      <div class={"p-node " + (n.status==="completed" ? "done" : n.status==="processing" ? "processing" : "")}>
                        <div style="display:flex; align-items:center; gap:8px">
                          <div class="p-title">{nodeLabel(n.node_type)}
                            <Show when={n.version > 1}><span class="tag tag-gray" style="margin-left:6px">V{n.version}</span></Show>
                          </div>
                          <span class={"tag tag-" + (n.status==="completed"?"green":n.status==="processing"?"blue":"gray")}>
                            {n.status==="completed"?"已完成":n.status==="processing"?"处理中":"等待"}
                          </span>
                        </div>
                        <div class="p-sub">
                          {n.handler_name || "未分配"}（{({registrar:"登记员",auditor:"审核主管",reviewer:"复核负责人"}[n.handler_role] || "")}）
                          <Show when={n.start_time}> · 开始 {n.start_time?.slice(5,16)}</Show>
                          <Show when={n.end_time}> · 结束 {n.end_time?.slice(5,16)}</Show>
                          <Show when={n.duration_seconds}> · 用时 {n.duration_seconds < 3600 ? Math.round(n.duration_seconds/60)+"分钟" : (n.duration_seconds/3600).toFixed(1)+"小时"}</Show>
                        </div>
                        <Show when={n.opinion}>
                          <div class="p-opinion">
                            <Show when={n.result}>
                              <strong style="color:#1d4ed8">[{({submit:"提交",pass:"通过",correction:"退回补正",reject:"驳回",appeal:"申诉",archive:"归档",withdraw:"撤回"}[n.result] || "")}]</strong>{" "}
                            </Show>
                            {n.opinion}
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">操作记录 <span style="font-size:12px;color:#9ca3af; font-weight:400">（共 {logs().length} 条）</span></div>
            </div>
            <div class="card-body">
              <Show when={logs().length === 0}><div class="loading">暂无操作记录</div></Show>
              <For each={logs()}>
                {l => (
                  <div class="log-item">
                    <div class="log-time">{l.created_at?.slice(0,19) || ""}</div>
                    <div class="log-content">
                      <div>
                        <span class="log-who">{l.user_name || "系统"}</span>
                        <span style="color:#9ca3af; font-size:12px">（{({registrar:"登记员",auditor:"审核主管",reviewer:"复核负责人",system:"系统"}[l.user_role] || l.user_role || "")}）</span>
                        <span class="log-action">{({
                          create:"创建申请", register_submit:"提交审核", correction_resubmit:"补正后重提", appeal_submit:"申诉提交",
                          audit_pass:"审核通过", audit_correction:"退回补正", audit_reject:"审核驳回",
                          review_pass:"复核通过", review_reject:"复核驳回", review_archive:"归档完成",
                          evidence_update:"证据更新", system_overdue:"系统标记逾期", system_conflict:"系统标记冲突"
                        }[l.action] || l.action)}</span>
                        <Show when={l.version_from !== l.version_to}>
                          <span class="tag tag-purple" style="margin-left:6px">V{l.version_from} → V{l.version_to}</span>
                        </Show>
                        <Show when={l.old_status && l.old_status !== l.new_status}>
                          <span style="font-size:12px; color:#6b7280; margin-left:8px">
                            {statusLabel(l.old_status)} → {statusLabel(l.new_status)}
                          </span>
                        </Show>
                        <Show when={l.action?.endsWith("_fail")}>
                          <span class="tag tag-red" style="margin-left:6px">失败</span>
                        </Show>
                      </div>
                      <div class="log-detail">
                        <Show when={l.opinion}><div>💬 意见：{l.opinion}</div></Show>
                        <Show when={l.reject_reason}><div style="color:#b91c1c">⚠ 原因：{l.reject_reason}</div></Show>
                        <Show when={l.evidence_check && l.action === "evidence_update"}><div>📎 证据检查：{l.evidence_check==="complete"?"完整":l.evidence_check==="partial"?"部分":"缺失"}</div></Show>
                        <Show when={l.extra}><div style="color:#6b7280">ℹ 详情：{JSON.parse(l.extra)?.reason || l.extra}</div></Show>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>

      <Show when={modal()}>
        <div class="modal-mask" onClick={() => !saving() && setModal(null)}>
          <div class="modal" onClick={e => e.stopPropagation()}>
            <div class="modal-header">
              <div class="modal-title">{modal()?.title}</div>
              <button class="modal-close" disabled={saving()} onClick={() => setModal(null)}>×</button>
            </div>
            <div class="modal-body">
              <div style="background:#fef3c7; padding:10px 12px; border-radius:6px; font-size:12px; color:#92400e; margin-bottom:16px; line-height:1.6">
                ⚠ 操作后状态将变更，<strong>后端会同时校验：当前处理人、角色权限、当前状态、版本号{modal()?.action !== "audit_correction" && modal()?.action !== "audit_reject" && modal()?.action !== "review_reject" ? "、必填证据" : ""}</strong>。不通过则原状态保留并记录失败日志。
              </div>
              <div class="form-group">
                <label class="form-label">处理意见</label>
                <textarea class="form-input form-textarea" placeholder="请填写处理意见（建议详细说明理由）"
                  value={opinion()} onInput={e => setOpinion(e.target.value)} />
              </div>
              <Show when={modal()?.needReject}>
                <div class="form-group">
                  <label class="form-label" style="color:#b91c1c">驳回/退回原因 *</label>
                  <textarea class="form-input form-textarea" placeholder="请详细说明驳回或退回原因，便于登记员补正或申诉"
                    value={rejectReason()} onInput={e => setRejectReason(e.target.value)} />
                </div>
              </Show>
              <div style="font-size:12px; color:#6b7280; display:flex; gap:16px">
                <span>当前状态：<strong style="color:#111827">{statusLabel(app()?.status)}</strong></span>
                <span>当前版本：<strong style="color:#111827">V{app()?.version}</strong></span>
                <span>处理人：<strong style="color:#111827">{user()?.name}</strong></span>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-default" disabled={saving()} onClick={() => setModal(null)}>取消</button>
              <button class="btn btn-primary" disabled={saving()} onClick={submitAction}>
                {saving() ? "提交中..." : "确认提交"}
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={toast()}>
        <div class={"toast toast-" + toast()?.type}>{toast()?.msg}</div>
      </Show>
    </div>
  );
}
