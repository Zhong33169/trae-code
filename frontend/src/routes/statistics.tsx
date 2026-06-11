import { createSignal, onMount, createEffect, on } from "solid-js";
import Layout from "~/components/Layout";
import { api } from "~/lib/api";
import { showToast } from "~/store/toast";
import { authStore, roleNames } from "~/store/auth";

export default function Statistics() {
  const [stats, setStats] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const result = await api.getStatistics();
      setStats(result.data);
    } catch (err: any) {
      showToast(err.message || "加载失败", "error");
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadStats();
  });

  createEffect(
    on(
      () => authStore.user()?.role,
      (role) => {
        if (role) {
          loadStats();
        }
      }
    )
  );

  const currentRole = () => authStore.user()?.role || "";
  const currentRoleName = () => roleNames[currentRole()] || "";

  return (
    <Layout>
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">
            数据统计
            <span style="margin-left: 8px; font-size: 13px; color: #888; font-weight: normal;">
              （当前岗位：{currentRoleName()}，统计范围与列表一致）
            </span>
          </h2>
        </div>

        {loading() ? (
          <div class="loading">加载中...</div>
        ) : stats() ? (
          <>
            <div class="stat-grid">
              <div class="stat-card">
                <div class="stat-value">{stats().todoTotal}</div>
                <div class="stat-label">我的待办</div>
                {stats().todoTimeoutCount > 0 && (
                  <div style="margin-top: 6px; font-size: 12px; color: #ff4d4f;">
                    其中超时 {stats().todoTimeoutCount} 条
                  </div>
                )}
              </div>

              <div class="stat-card">
                <div class="stat-value" style="color: #1890ff;">
                  {stats().viewableTotal}
                </div>
                <div class="stat-label">可浏览全部任务</div>
                {stats().viewableTimeoutCount > 0 && (
                  <div style="margin-top: 6px; font-size: 12px; color: #ff4d4f;">
                    其中超时 {stats().viewableTimeoutCount} 条
                  </div>
                )}
              </div>

              <div class="stat-card">
                <div class="stat-value">{stats().archived}</div>
                <div class="stat-label">已归档任务</div>
              </div>

              <div class="stat-card">
                <div class="stat-value danger">
                  {stats().auditRejected + stats().reviewRejected}
                </div>
                <div class="stat-label">已驳回任务</div>
              </div>
            </div>

            <div class="stat-grid">
              <div class="stat-card">
                <div class="stat-value" style="color: #8c8c8c;">
                  {stats().pendingRegistration}
                </div>
                <div class="stat-label">待登记</div>
              </div>

              <div class="stat-card">
                <div class="stat-value" style="color: #1890ff;">
                  {stats().registered}
                </div>
                <div class="stat-label">待审核</div>
              </div>

              <div class="stat-card">
                <div class="stat-value" style="color: #faad14;">
                  {stats().auditPassed}
                </div>
                <div class="stat-label">待复核</div>
              </div>

              <div class="stat-card">
                <div class="stat-value danger">
                  {stats().auditRejected + stats().reviewRejected}
                </div>
                <div class="stat-label">已驳回</div>
              </div>
            </div>

            {stats().auditRejected > 0 || stats().reviewRejected > 0 ? (
              <div class="stat-grid" style="margin-top: 16px;">
                {stats().auditRejected > 0 && (
                  <div class="stat-card">
                    <div class="stat-value danger">{stats().auditRejected}</div>
                    <div class="stat-label">审核驳回（需登记员补正）</div>
                  </div>
                )}
                {stats().reviewRejected > 0 && (
                  <div class="stat-card">
                    <div class="stat-value danger">{stats().reviewRejected}</div>
                    <div class="stat-label">复核驳回（需审核员重审）</div>
                  </div>
                )}
              </div>
            ) : null}

            <div class="detail-section" style="margin-top: 24px;">
              <h3>状态说明</h3>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="label">待登记：</span>
                  <span class="value">任务已创建，等待种植登记员提交登记信息</span>
                </div>
                <div class="detail-item">
                  <span class="label">待审核：</span>
                  <span class="value">登记已提交，等待种植审核主管审核</span>
                </div>
                <div class="detail-item">
                  <span class="label">审核驳回：</span>
                  <span class="value">审核未通过，需要种植登记员补正后重新提交</span>
                </div>
                <div class="detail-item">
                  <span class="label">待复核：</span>
                  <span class="value">审核已通过，等待农业合作社复核负责人复核</span>
                </div>
                <div class="detail-item">
                  <span class="label">复核驳回：</span>
                  <span class="value">复核未通过，需要重新审核</span>
                </div>
                <div class="detail-item">
                  <span class="label">已归档：</span>
                  <span class="value">复核通过，任务完成归档</span>
                </div>
              </div>
            </div>

            <div class="detail-section" style="margin-top: 24px;">
              <h3>节点超时规则</h3>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="label">登记节点：</span>
                  <span class="value">24 小时内完成</span>
                </div>
                <div class="detail-item">
                  <span class="label">审核节点：</span>
                  <span class="value">48 小时内完成</span>
                </div>
                <div class="detail-item">
                  <span class="label">复核节点：</span>
                  <span class="value">72 小时内完成</span>
                </div>
                <div class="detail-item">
                  <span class="label">超时计算：</span>
                  <span class="value">从节点开始处理时间起算</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div class="empty">暂无数据</div>
        )}
      </div>
    </Layout>
  );
}
