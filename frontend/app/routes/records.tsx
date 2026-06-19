import type { MetaFunction } from "@remix-run/node";
import { useNavigate, useOutletContext } from "@remix-run/react";
import { useEffect, useState } from "react";
import { fetchRecords, fetchPlans, fetchUsers, batchProcess } from "../api";

export const meta: MetaFunction = () => [{ title: "接种登记 - 畜牧免疫记录管理" }];

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿", submitted: "已提交", under_review: "审核中",
  approved: "已批准", returned: "已退回", timeout: "已超时",
};

const RESULT_LABELS: Record<string, string> = {
  normal: "正常", adverse_reaction: "不良反应", ineffective: "无效", incomplete: "未完成",
};

const ROLE_LABELS: Record<string, string> = {
  breeder: "饲养员", vet_supervisor: "兽医主管", farm_manager: "场长",
};

const BATCH_OPTIONS_BY_ROLE: Record<string, { value: string; label: string }[]> = {
  breeder: [{ value: "submit", label: "批量提交" }],
  vet_supervisor: [{ value: "review", label: "批量审核" }, { value: "return", label: "批量退回" }],
  farm_manager: [{ value: "approve", label: "批量批准" }, { value: "return", label: "批量退回" }],
};

export default function Records() {
  const navigate = useNavigate();
  const outletCtx = useOutletContext<{ currentUser?: any }>();
  const currentUser = outletCtx?.currentUser;
  const currentRole = currentUser?.role || "breeder";

  const [records, setRecords] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [abnormalFilter, setAbnormalFilter] = useState("");
  const [overdueFilter, setOverdueFilter] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batchResult, setBatchResult] = useState<any>(null);
  const [showBatch, setShowBatch] = useState(false);
  const batchOptions = BATCH_OPTIONS_BY_ROLE[currentRole] || [];
  const [batchAction, setBatchAction] = useState(batchOptions[0]?.value || "submit");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ record_code: "", plan_id: "", animal_id: "", animal_tag: "", species: "", deadline_at: "" });

  useEffect(() => { fetchPlans().then(setPlans).catch(() => {}); }, []);

  useEffect(() => {
    const filters: any = {};
    if (statusFilter) filters.status = statusFilter;
    if (planFilter) filters.plan_id = planFilter;
    if (abnormalFilter) filters.is_abnormal = abnormalFilter;
    if (overdueFilter) filters.is_overdue = overdueFilter;
    fetchRecords(filters).then(setRecords).catch(() => {});
  }, [statusFilter, planFilter, abnormalFilter, overdueFilter]);

  const toggleSelect = (id: number) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };

  const toggleAll = () => {
    if (selected.size === records.length) { setSelected(new Set()); } else { setSelected(new Set(records.map((r: any) => r.id))); }
  };

  const handleBatch = async () => {
    try {
      const result = await batchProcess({ action: batchAction, record_ids: Array.from(selected) });
      setBatchResult(result);
      setShowBatch(true);
      setSelected(new Set());
      fetchRecords({ status: statusFilter || undefined, plan_id: planFilter || undefined, is_abnormal: abnormalFilter || undefined, is_overdue: overdueFilter || undefined }).then(setRecords);
    } catch (e: any) {
      alert("批量操作失败: " + (e.error || JSON.stringify(e)));
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch("http://localhost:8002/api/vaccination-records", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": localStorage.getItem("currentUserId") || "1" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw await res.json();
      setShowCreate(false);
      fetchRecords({ status: statusFilter || undefined, plan_id: planFilter || undefined }).then(setRecords);
    } catch (e: any) {
      alert("创建失败: " + (e.error || JSON.stringify(e)));
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 20 }}>💉 接种登记</h2>
        {currentRole === "breeder" && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ 新建记录</button>}
      </div>

      <div className="filter-bar">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">全部状态</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}>
          <option value="">全部计划</option>
          {plans.map((p: any) => <option key={p.id} value={p.id}>{p.plan_name}</option>)}
        </select>
        <select value={abnormalFilter} onChange={e => setAbnormalFilter(e.target.value)}>
          <option value="">是否异常</option>
          <option value="true">仅异常</option>
        </select>
        <select value={overdueFilter} onChange={e => setOverdueFilter(e.target.value)}>
          <option value="">是否超时</option>
          <option value="true">仅超时</option>
        </select>
      </div>

      {selected.size > 0 && batchOptions.length > 0 && (
        <div className="card" style={{ marginBottom: 16, background: "#f6ffed", borderColor: "#b7eb8f" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span>已选择 {selected.size} 条记录（{ROLE_LABELS[currentRole]}）</span>
            <select value={batchAction} onChange={e => setBatchAction(e.target.value)}>
              {batchOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <button className="btn btn-primary" onClick={handleBatch}>执行</button>
            <button className="btn btn-default" onClick={() => setSelected(new Set())}>取消选择</button>
          </div>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" checked={selected.size === records.length && records.length > 0} onChange={toggleAll} /></th>
              <th>单号</th>
              <th>动物编号</th>
              <th>计划</th>
              <th>状态</th>
              <th>结果</th>
              <th>附件</th>
              <th>创建人</th>
              <th>截止日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r: any) => (
              <tr key={r.id}>
                <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                <td>
                  <button className="link-btn" onClick={() => navigate(`/records/${r.id}`)}>{r.record_code}</button>
                  {r.is_overdue && <span className="overdue-badge">超时</span>}
                  {r.missing_required?.length > 0 && <span className="missing-badge">缺材料</span>}
                  {r.latest_failure && <span className="status-tag" style={{ background: "#fff1f0", color: "#cf1322", marginLeft: 4, fontSize: 11 }} title={`${r.latest_failure.reason}\n建议: ${r.latest_failure.suggestion}`}>⚠️ 失败</span>}
                </td>
                <td>{r.animal_id}</td>
                <td>{r.plan_name}</td>
                <td><span className={`status-tag status-${r.status}`}>{STATUS_LABELS[r.status]}</span></td>
                <td>{r.result ? <span style={{ color: r.result === "normal" ? "#389e0d" : "#cf1322" }}>{RESULT_LABELS[r.result] || r.result}</span> : "-"}</td>
                <td>
                  {r.required_attachment_count > 0 && <span className="status-tag att-type-required" style={{ marginRight: 4 }}>必传{r.required_attachment_count}</span>}
                  {r.supplementary_attachment_count > 0 && <span className="status-tag att-type-supplementary" style={{ marginRight: 4 }}>补传{r.supplementary_attachment_count}</span>}
                  {r.rejected_attachment_count > 0 && <span className="status-tag att-type-rejected">驳回{r.rejected_attachment_count}</span>}
                </td>
                <td>{r.creator_name}</td>
                <td>{r.deadline_at ? new Date(r.deadline_at).toLocaleDateString("zh-CN") : "-"}</td>
                <td>
                  <button className="btn btn-sm btn-default" onClick={() => navigate(`/records/${r.id}`)}>详情</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && <div className="empty-state"><div className="empty-icon">📭</div><div>暂无接种记录</div></div>}
      </div>

      {showBatch && batchResult && (
        <div className="modal-overlay" onClick={() => setShowBatch(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 600 }}>
            <div className="modal-title">📋 批量处理结果</div>
            <div style={{ marginBottom: 12 }}>
              <span>总计: {batchResult.total} </span>
              <span style={{ color: "#389e0d" }}>成功: {batchResult.success_count} </span>
              <span style={{ color: "#cf1322" }}>失败: {batchResult.fail_count}</span>
            </div>
            <div className="batch-result-list">
              {batchResult.results.map((r: any, i: number) => (
                <div key={i} className={`batch-result-item ${r.success ? "success" : "fail"}`}>
                  <div>
                    <span className="batch-code">{r.record_code || `ID:${r.record_id}`}</span>
                    <span style={{ marginLeft: 8 }}>{r.success ? "✅ 成功" : "❌ 失败"}</span>
                  </div>
                  {r.reason && <div className="batch-reason">原因: {r.reason}</div>}
                  {r.next_step && <div className="batch-next">建议: {r.next_step}</div>}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowBatch(false)}>确认</button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">新建接种记录</div>
            <div className="form-group">
              <label className="form-label">记录编号</label>
              <input className="form-input" value={form.record_code} onChange={e => setForm({...form, record_code: e.target.value})} placeholder="如 VAC-2026-007" />
            </div>
            <div className="form-group">
              <label className="form-label">免疫计划</label>
              <select className="form-select" value={form.plan_id} onChange={e => setForm({...form, plan_id: e.target.value})}>
                <option value="">选择计划</option>
                {plans.map((p: any) => <option key={p.id} value={p.id}>{p.plan_code} - {p.plan_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">动物编号</label>
              <input className="form-input" value={form.animal_id} onChange={e => setForm({...form, animal_id: e.target.value})} placeholder="如 CATTLE-007" />
            </div>
            <div className="form-group">
              <label className="form-label">耳标号</label>
              <input className="form-input" value={form.animal_tag} onChange={e => setForm({...form, animal_tag: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">畜种</label>
              <input className="form-input" value={form.species} onChange={e => setForm({...form, species: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">截止日期</label>
              <input className="form-input" type="datetime-local" value={form.deadline_at} onChange={e => setForm({...form, deadline_at: e.target.value})} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setShowCreate(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleCreate}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
