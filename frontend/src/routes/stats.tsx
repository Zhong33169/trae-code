import { createSignal, Component, onMount } from "solid-js";
import { Layout } from "../components/Layout";
import { Alert } from "../components/Alert";
import { api } from "../lib/api";
import { useApp, statusLabels } from "../lib/store";

interface Stats {
  total_count: number;
  draft_count: number;
  pending_audit_count: number;
  rejected_count: number;
  audited_count: number;
  pending_review_count: number;
  review_rejected_count: number;
  archived_count: number;
  overdue_count: number;
  total_amount: number;
}

const StatsPage: Component = () => {
  const app = useApp();
  const [stats, setStats] = createSignal<Stats | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [alert, setAlert] = createSignal({ type: "", message: "", show: false });

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await api.getBillStats();
      setStats(data);
    } catch (err: any) {
      setAlert({ type: "error", message: err.message || "加载失败", show: true });
    } finally {
      setLoading(false);
    }
  };

  const refreshOverdue = async () => {
    try {
      const result = await api.refreshOverdue();
      setAlert({ type: "success", message: result.message, show: true });
      loadStats();
    } catch (err: any) {
      setAlert({ type: "error", message: err.message || "刷新失败", show: true });
    }
  };

  onMount(() => {
    loadStats();
  });

  const statusItems = [
    { key: "draft", label: "草稿", count: () => stats()?.draft_count || 0, color: "#9ca3af" },
    { key: "pending_audit", label: "待审核", count: () => stats()?.pending_audit_count || 0, color: "#f59e0b" },
    { key: "rejected", label: "已驳回", count: () => stats()?.rejected_count || 0, color: "#ef4444" },
    { key: "audited", label: "已审核待复核", count: () => stats()?.audited_count || 0, color: "#3b82f6" },
    { key: "archived", label: "已归档", count: () => stats()?.archived_count || 0, color: "#10b981" },
  ];

  return (
    <Layout>
      <div class="page-header">
        <h1>📊 统计概览</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <button class="btn btn-warning" onClick={refreshOverdue}>
            ⚠️ 刷新超时状态
          </button>
          <button class="btn btn-secondary" onClick={loadStats}>
            🔄 刷新
          </button>
        </div>
      </div>

      <Alert type={alert().type as any} message={alert().message} show={alert().show} />

      {loading() ? (
        <div class="loading"><div class="spinner"></div><p>加载中...</p></div>
      ) : (
        <>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="label">账单总数</div>
              <div class="value">{stats()!.total_count}</div>
            </div>
            <div class="stat-card">
              <div class="label">处理中</div>
              <div class="value" style={{ color: "#3b82f6" }}>
                {stats()!.draft_count + stats()!.pending_audit_count + stats()!.audited_count}
              </div>
            </div>
            <div class="stat-card">
              <div class="label">已完成</div>
              <div class="value" style={{ color: "#10b981" }}>{stats()!.archived_count}</div>
            </div>
            <div class="stat-card">
              <div class="label">超时账单</div>
              <div class="value overdue">{stats()!.overdue_count}</div>
            </div>
            <div class="stat-card">
              <div class="label">累计金额</div>
              <div class="value amount">¥{stats()!.total_amount.toFixed(2)}</div>
            </div>
          </div>

          <div class="detail-card">
            <h3>📈 状态分布</h3>
            <div class="stats-grid" style={{ "grid-template-columns": "repeat(auto-fit, minmax(180px, 1fr))" }}>
              {statusItems.map((item) => (
                <div class="stat-card" key={item.key}>
                  <div class="label">{item.label}</div>
                  <div class="value" style={{ color: item.color }}>{item.count()}</div>
                  <div style={{ height: "8px", background: "#e5e7eb", "border-radius": "4px", "margin-top": "12px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: stats()!.total_count > 0 ? `${(item.count() / stats()!.total_count) * 100}%` : "0%",
                        background: item.color,
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div class="detail-card">
            <h3>👥 岗位分工</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="label">能耗账登记员</span>
                <span class="value">张登记 (registrar)</span>
                <div style={{ "font-size": "12px", color: "#6b7280", "margin-top": "4px" }}>
                  负责发起、补正账单，录入抄表，登记缴费
                </div>
              </div>
              <div class="detail-item">
                <span class="label">能耗账审核主管</span>
                <span class="value">李审核 (auditor)</span>
                <div style={{ "font-size": "12px", color: "#6b7280", "margin-top": "4px" }}>
                  负责审核账单内容，通过或驳回
                </div>
              </div>
              <div class="detail-item">
                <span class="label">产业园物业复核负责人</span>
                <span class="value">王物业 (property)</span>
                <div style={{ "font-size": "12px", color: "#6b7280", "margin-top": "4px" }}>
                  负责最终复核、归档，核销缴费
                </div>
              </div>
            </div>
          </div>

          <div class="detail-card">
            <h3>⏱️ 节点超时配置</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="label">登记节点</span>
                <span class="value">24 小时</span>
                <div style={{ "font-size": "12px", color: "#6b7280", "margin-top": "4px" }}>
                  超过24小时未处理自动标记超时
                </div>
              </div>
              <div class="detail-item">
                <span class="label">审核节点</span>
                <span class="value">48 小时</span>
                <div style={{ "font-size": "12px", color: "#6b7280", "margin-top": "4px" }}>
                  超过48小时未处理自动标记超时
                </div>
              </div>
              <div class="detail-item">
                <span class="label">复核节点</span>
                <span class="value">24 小时</span>
                <div style={{ "font-size": "12px", color: "#6b7280", "margin-top": "4px" }}>
                  超过24小时未处理自动标记超时
                </div>
              </div>
            </div>
          </div>

          <div class="detail-card">
            <h3>🔄 状态流转说明</h3>
            <div style={{ "line-height": "2" }}>
              <p><strong>草稿 → 待审核:</strong> 登记员提交审核</p>
              <p><strong>待审核 → 已审核:</strong> 审核主管审核通过</p>
              <p><strong>待审核 → 已驳回:</strong> 审核主管审核驳回（需登记员补正）</p>
              <p><strong>已驳回 → 待审核:</strong> 登记员补正后重新提交</p>
              <p><strong>已审核 → 已归档:</strong> 物业复核通过并归档</p>
              <p><strong>已审核 → 复核驳回:</strong> 物业复核驳回（需登记员重新处理）</p>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
};

export default StatsPage;
