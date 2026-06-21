import { createSignal, Show, onMount, For } from 'solid-js';
import { api } from '../api';
import type { Statistics } from '../types';
import { STATUS_LABELS, EVENT_TYPE_LABELS, SEVERITY_LABELS, ROLE_LABELS } from '../types';

export default function StatisticsPage() {
  const [stats, setStats] = createSignal<Statistics | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await api.getStatistics();
      setStats(data);
    } catch (err: any) {
      setError(err?.error || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(loadStats);

  return (
    <div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h2 style="font-size: 20px; font-weight: 600;">统计分析</h2>
        <button class="btn btn-outline btn-sm" onClick={loadStats}>刷新</button>
      </div>

      <Show when={error()}>
        <div class="alert alert-error">{error()}</div>
      </Show>

      <Show when={loading()} fallback={
        <Show when={stats()} fallback={<div class="alert alert-error">加载失败</div>}>
          {(s) => (
            <>
              <div class="stat-grid">
                <div class="stat-card">
                  <div class="stat-value">{s().total}</div>
                  <div class="stat-label">事件总数</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value" style="color: var(--warning);">{s().active}</div>
                  <div class="stat-label">处理中</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value" style="color: var(--success);">{s().archived}</div>
                  <div class="stat-label">已归档</div>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div class="card">
                  <h3 style="font-size: 16px; margin-bottom: 12px;">按状态分布</h3>
                  <For each={Object.entries(s().by_status)}>
                    {([key, value]) => (
                      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--gray-100); font-size: 14px;">
                        <span>{STATUS_LABELS[key] || key}</span>
                        <span style="font-weight: 600;">{value}</span>
                      </div>
                    )}
                  </For>
                </div>

                <div class="card">
                  <h3 style="font-size: 16px; margin-bottom: 12px;">按类型分布</h3>
                  <For each={Object.entries(s().by_type)}>
                    {([key, value]) => (
                      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--gray-100); font-size: 14px;">
                        <span>{EVENT_TYPE_LABELS[key] || key}</span>
                        <span style="font-weight: 600;">{value}</span>
                      </div>
                    )}
                  </For>
                </div>

                <div class="card">
                  <h3 style="font-size: 16px; margin-bottom: 12px;">按严重程度分布</h3>
                  <For each={Object.entries(s().by_severity)}>
                    {([key, value]) => (
                      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--gray-100); font-size: 14px;">
                        <span>{SEVERITY_LABELS[key] || key}</span>
                        <span style="font-weight: 600;">{value}</span>
                      </div>
                    )}
                  </For>
                </div>

                <div class="card">
                  <h3 style="font-size: 16px; margin-bottom: 12px;">各角色待处理队列</h3>
                  <For each={Object.entries(s().by_role_queue)}>
                    {([key, value]) => (
                      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--gray-100); font-size: 14px;">
                        <span>{ROLE_LABELS[key] || key}</span>
                        <span style="font-weight: 600;">{value}</span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </>
          )}
        </Show>
      }>
        <div class="loading">加载中...</div>
      </Show>
    </div>
  );
}
