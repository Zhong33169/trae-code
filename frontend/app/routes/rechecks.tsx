import type { MetaFunction } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";
import { fetchRechecks } from "../api";

export const meta: MetaFunction = () => [{ title: "异常复查 - 畜牧免疫记录管理" }];

const RECHECK_STATUS_LABELS: Record<string, string> = {
  pending: "待复查", rechecked: "已复查", resolved: "已解决", escalated: "已升级",
};

const ABNORMAL_LABELS: Record<string, string> = {
  adverse_reaction: "不良反应", ineffective: "无效", incomplete: "未完成",
};

export default function Rechecks() {
  const navigate = useNavigate();
  const [rechecks, setRechecks] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [overdueFilter, setOverdueFilter] = useState("");

  useEffect(() => {
    const filters: any = {};
    if (statusFilter) filters.status = statusFilter;
    if (overdueFilter) filters.is_overdue = overdueFilter;
    fetchRechecks(filters).then(setRechecks).catch(() => {});
  }, [statusFilter, overdueFilter]);

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 20 }}>🔄 异常复查</h2>

      <div className="filter-bar">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">全部状态</option>
          {Object.entries(RECHECK_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={overdueFilter} onChange={e => setOverdueFilter(e.target.value)}>
          <option value="">是否超时</option>
          <option value="true">仅超时</option>
        </select>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>关联单号</th>
              <th>动物编号</th>
              <th>异常类型</th>
              <th>描述</th>
              <th>状态</th>
              <th>截止日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rechecks.map((r: any) => (
              <tr key={r.id}>
                <td>{r.record_code}</td>
                <td>{r.animal_id}</td>
                <td style={{ color: "#cf1322" }}>{ABNORMAL_LABELS[r.abnormal_type] || r.abnormal_type}</td>
                <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</td>
                <td>
                  <span className={`status-tag recheck-status-${r.status}`}>{RECHECK_STATUS_LABELS[r.status]}</span>
                  {r.is_overdue && <span className="overdue-badge">超时</span>}
                </td>
                <td>{r.deadline_at ? new Date(r.deadline_at).toLocaleDateString("zh-CN") : "-"}</td>
                <td>
                  <button className="btn btn-sm btn-default" onClick={() => navigate(`/rechecks/${r.id}`)}>查看</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rechecks.length === 0 && <div className="empty-state"><div className="empty-icon">✅</div><div>暂无异常复查记录</div></div>}
      </div>
    </div>
  );
}
