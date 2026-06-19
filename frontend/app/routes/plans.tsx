import type { MetaFunction } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";
import { fetchPlans, fetchUsers } from "../api";

export const meta: MetaFunction = () => [{ title: "免疫计划 - 畜牧免疫记录管理" }];

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿", submitted: "已提交", under_review: "审核中",
  approved: "已批准", returned: "已退回", timeout: "已超时",
};

export default function Plans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ plan_code: "", plan_name: "", vaccine_type: "", target_species: "", target_count: 100, start_date: "", end_date: "", description: "" });

  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    fetchPlans(statusFilter || undefined).then(setPlans).catch(() => {});
  }, [statusFilter]);

  const handleCreate = async () => {
    try {
      const res = await fetch("http://localhost:8002/api/immunization-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": localStorage.getItem("currentUserId") || "1" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw await res.json();
      setShowCreate(false);
      fetchPlans(statusFilter || undefined).then(setPlans);
    } catch (e: any) {
      alert("创建失败: " + (e.error || JSON.stringify(e)));
    }
  };

  const handleSubmit = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:8002/api/immunization-plans/${id}/submit`, {
        method: "POST",
        headers: { "X-User-Id": localStorage.getItem("currentUserId") || "1" },
      });
      if (!res.ok) throw await res.json();
      fetchPlans(statusFilter || undefined).then(setPlans);
    } catch (e: any) {
      alert("提交失败: " + (e.error || JSON.stringify(e)));
    }
  };

  const getCreatorName = (id: number) => users.find((u: any) => u.id === id)?.display_name || "-";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 20 }}>💉 免疫计划</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ 新建计划</button>
      </div>

      <div className="filter-bar">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">全部状态</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>计划编号</th>
              <th>计划名称</th>
              <th>疫苗类型</th>
              <th>目标畜种</th>
              <th>目标数量</th>
              <th>状态</th>
              <th>创建人</th>
              <th>免疫记录数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p: any) => (
              <tr key={p.id}>
                <td><button className="link-btn" onClick={() => navigate(`/plans/${p.id}`)}>{p.plan_code}</button></td>
                <td>{p.plan_name}</td>
                <td>{p.vaccine_type}</td>
                <td>{p.target_species}</td>
                <td>{p.target_count}</td>
                <td><span className={`status-tag status-${p.status}`}>{STATUS_LABELS[p.status]}</span></td>
                <td>{p.creator_name}</td>
                <td>{p.record_count}</td>
                <td>
                  <div className="action-group">
                    <button className="btn btn-sm btn-default" onClick={() => navigate(`/plans/${p.id}`)}>查看</button>
                    {p.status === "draft" && (
                      <button className="btn btn-sm btn-primary" onClick={() => handleSubmit(p.id)}>提交</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {plans.length === 0 && <div className="empty-state"><div className="empty-icon">📭</div><div>暂无免疫计划</div></div>}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">新建免疫计划</div>
            <div className="form-group">
              <label className="form-label">计划编号</label>
              <input className="form-input" value={form.plan_code} onChange={e => setForm({...form, plan_code: e.target.value})} placeholder="如 IMM-2026-003" />
            </div>
            <div className="form-group">
              <label className="form-label">计划名称</label>
              <input className="form-input" value={form.plan_name} onChange={e => setForm({...form, plan_name: e.target.value})} placeholder="如 秋季猪瘟免疫计划" />
            </div>
            <div className="form-group">
              <label className="form-label">疫苗类型</label>
              <input className="form-input" value={form.vaccine_type} onChange={e => setForm({...form, vaccine_type: e.target.value})} placeholder="如 猪瘟活疫苗" />
            </div>
            <div className="form-group">
              <label className="form-label">目标畜种</label>
              <input className="form-input" value={form.target_species} onChange={e => setForm({...form, target_species: e.target.value})} placeholder="如 猪" />
            </div>
            <div className="form-group">
              <label className="form-label">目标数量</label>
              <input className="form-input" type="number" value={form.target_count} onChange={e => setForm({...form, target_count: Number(e.target.value)})} />
            </div>
            <div className="form-group">
              <label className="form-label">开始日期</label>
              <input className="form-input" type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">结束日期</label>
              <input className="form-input" type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">描述</label>
              <textarea className="form-textarea" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
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
