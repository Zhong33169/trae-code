import type { MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { fetchDashboardStats, fetchRecords } from "../api";

export const meta: MetaFunction = () => [{ title: "畜牧免疫记录管理 - 总览" }];

export async function loader() {
  return { stats: await fetchDashboardStats(), recentRecords: await fetchRecords() };
}

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const [stats, setStats] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardStats().then(setStats).catch(() => {});
    fetchRecords().then(setRecords).catch(() => {});
  }, []);

  const s = stats || data.stats;
  const recs = records.length ? records : data.recentRecords;

  const STATUS_LABELS: Record<string, string> = {
    draft: "草稿", submitted: "已提交", under_review: "审核中",
    approved: "已批准", returned: "已退回", timeout: "已超时",
  };

  return (
    <div>
      <h2 style={{ marginBottom: 20, fontSize: 20 }}>📊 免疫记录总览</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{s?.total_records || 0}</div>
          <div className="stat-label">免疫记录总数</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{s?.by_status?.approved || 0}</div>
          <div className="stat-label">已批准</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{s?.by_status?.draft || 0}</div>
          <div className="stat-label">草稿</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{s?.by_status?.submitted || 0}</div>
          <div className="stat-label">已提交</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{s?.by_status?.under_review || 0}</div>
          <div className="stat-label">审核中</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value">{s?.overdue_count || 0}</div>
          <div className="stat-label">超时</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value">{s?.by_status?.returned || 0}</div>
          <div className="stat-label">已退回</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value">{s?.abnormal_count || 0}</div>
          <div className="stat-label">异常记录</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{s?.pending_rechecks || 0}</div>
          <div className="stat-label">待复查</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value">{s?.missing_attachments || 0}</div>
          <div className="stat-label">缺失附件</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">📋 最近免疫记录</div>
        <table>
          <thead>
            <tr>
              <th>单号</th>
              <th>动物编号</th>
              <th>计划</th>
              <th>状态</th>
              <th>创建人</th>
              <th>截止日期</th>
            </tr>
          </thead>
          <tbody>
            {recs.map((r: any) => (
              <tr key={r.id}>
                <td>
                  <a href={`/records/${r.id}`} className="link-btn">{r.record_code}</a>
                  {r.is_overdue && <span className="overdue-badge">超时</span>}
                  {!r.has_all_required && r.missing_required?.length > 0 && <span className="missing-badge">缺材料</span>}
                </td>
                <td>{r.animal_id}</td>
                <td>{r.plan_name}</td>
                <td><span className={`status-tag status-${r.status}`}>{STATUS_LABELS[r.status]}</span></td>
                <td>{r.creator_name}</td>
                <td>{r.deadline_at ? new Date(r.deadline_at).toLocaleDateString("zh-CN") : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
