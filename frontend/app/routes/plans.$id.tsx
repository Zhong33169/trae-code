import { useLoaderData, useNavigate } from "@remix-run/react";
import { fetchPlan } from "../api";

export async function loader({ params }: any) {
  return fetchPlan(Number(params.id));
}

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿", submitted: "已提交", under_review: "审核中",
  approved: "已批准", returned: "已退回", timeout: "已超时",
};

export default function PlanDetail() {
  const plan = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-default" onClick={() => navigate("/plans")}>← 返回计划列表</button>
      </div>

      <div className="card">
        <div className="card-title">💉 计划详情: {plan.plan_code}</div>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">计划编号</span>
            <span className="detail-value">{plan.plan_code}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">计划名称</span>
            <span className="detail-value">{plan.plan_name}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">疫苗类型</span>
            <span className="detail-value">{plan.vaccine_type}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">目标畜种</span>
            <span className="detail-value">{plan.target_species}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">目标数量</span>
            <span className="detail-value">{plan.target_count}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">状态</span>
            <span className="detail-value"><span className={`status-tag status-${plan.status}`}>{STATUS_LABELS[plan.status]}</span></span>
          </div>
          <div className="detail-item">
            <span className="detail-label">开始日期</span>
            <span className="detail-value">{plan.start_date}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">结束日期</span>
            <span className="detail-value">{plan.end_date}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">创建人</span>
            <span className="detail-value">{plan.creator_name}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">描述</span>
            <span className="detail-value">{plan.description || "-"}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">📋 免疫记录（{plan.records?.length || 0} 条）</div>
        <table>
          <thead>
            <tr>
              <th>单号</th>
              <th>动物编号</th>
              <th>状态</th>
              <th>创建人</th>
              <th>结果</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {(plan.records || []).map((r: any) => (
              <tr key={r.id}>
                <td>{r.record_code}</td>
                <td>{r.animal_id}</td>
                <td><span className={`status-tag status-${r.status}`}>{STATUS_LABELS[r.status]}</span></td>
                <td>{r.creator_name}</td>
                <td>{r.result || "-"}</td>
                <td>
                  <button className="btn btn-sm btn-default" onClick={() => navigate(`/records/${r.id}`)}>查看详情</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
