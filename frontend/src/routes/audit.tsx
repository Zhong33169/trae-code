import { createSignal, Show, For, onMount } from 'solid-js';
import { A } from '@solidjs/router';
import { api } from '../api';
import type { AuditLog } from '../types';
import { ROLE_LABELS, STATUS_LABELS } from '../types';

export default function AuditPage() {
  const [logs, setLogs] = createSignal<AuditLog[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [filterEventId, setFilterEventId] = createSignal('');

  const loadLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAuditLog(filterEventId() ? parseInt(filterEventId()) : undefined);
      setLogs(data.logs);
    } catch (err: any) {
      setError(err?.error || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(loadLogs);

  const actionLabels: Record<string, string> = {
    create: '创建',
    submit: '提交',
    supplement: '补正',
    review_pass: '审核通过',
    review_reject: '审核退回',
    archive: '归档',
    archive_reject: '复核退回',
    scan: '扫码核验',
    scan_reject: '扫码拒绝',
    filter_change: '筛选变更',
    batch_review_pass: '批量审核通过',
    batch_review_reject: '批量审核退回',
    batch_archive_archive: '批量复核归档',
    batch_archive_reject: '批量复核退回',
  };

  const actionBadges: Record<string, string> = {
    create: 'badge-gray',
    submit: 'badge-blue',
    supplement: 'badge-blue',
    review_pass: 'badge-green',
    review_reject: 'badge-red',
    archive: 'badge-green',
    archive_reject: 'badge-yellow',
    scan: 'badge-blue',
    scan_reject: 'badge-red',
    filter_change: 'badge-gray',
    batch_review_pass: 'badge-green',
    batch_review_reject: 'badge-red',
    batch_archive_archive: 'badge-green',
    batch_archive_reject: 'badge-yellow',
  };

  return (
    <div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h2 style="font-size: 20px; font-weight: 600;">审计日志</h2>
        <button class="btn btn-outline btn-sm" onClick={loadLogs}>刷新</button>
      </div>

      <div class="filter-bar">
        <input
          type="number"
          placeholder="按事件ID筛选"
          value={filterEventId()}
          onInput={(e) => setFilterEventId(e.currentTarget.value)}
          style="width: 180px;"
        />
        <button class="btn btn-outline btn-sm" onClick={loadLogs}>查询</button>
      </div>

      <Show when={error()}>
        <div class="alert alert-error">{error()}</div>
      </Show>

      <Show when={loading()} fallback={
        <Show when={logs().length > 0} fallback={
          <div class="card">
            <div class="empty-state">
              <div class="empty-icon">📜</div>
              <p>暂无审计日志</p>
            </div>
          </div>
        }>
          <div class="card" style="padding: 0; overflow-x: auto;">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>事件</th>
                  <th>操作</th>
                  <th>操作人</th>
                  <th>状态变化</th>
                  <th>版本</th>
                  <th>凭证/批次</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody>
                <For each={logs()}>
                  {(log) => (
                    <tr>
                      <td style="font-size: 13px; white-space: nowrap;">{new Date(log.created_at).toLocaleString()}</td>
                      <td>
                        <Show when={log.event_id} fallback={<span style="color: var(--gray-400);">—</span>}>
                          <A href={`/events/${log.event_id}`} style="text-decoration: none; font-family: monospace; font-size: 13px;">
                            {log.event_code || `#${log.event_id}`}
                          </A>
                          <div style="font-size: 12px; color: var(--gray-400); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            {log.event_title}
                          </div>
                        </Show>
                      </td>
                      <td>
                        <span class={`badge ${actionBadges[log.action] || 'badge-gray'}`}>
                          {actionLabels[log.action] || log.action}
                        </span>
                      </td>
                      <td>
                        <div>{log.actor_name || '—'}</div>
                        <div style="font-size: 12px; color: var(--gray-400);">{ROLE_LABELS[log.actor_role] || log.actor_role}</div>
                      </td>
                      <td style="font-size: 12px;">
                        <Show when={log.before_status || log.after_status} fallback={<span style="color: var(--gray-300);">—</span>}>
                          <Show when={log.before_status}>
                            <span>{STATUS_LABELS[log.before_status!] || log.before_status}</span>
                          </Show>
                          <Show when={log.before_status && log.after_status}>
                            <span style="margin: 0 4px; color: var(--gray-400);">→</span>
                          </Show>
                          <Show when={log.after_status}>
                            <span class="badge badge-green">{STATUS_LABELS[log.after_status!] || log.after_status}</span>
                          </Show>
                        </Show>
                      </td>
                      <td style="font-size: 12px;">
                        {log.version_before != null && log.version_after != null
                          ? `v${log.version_before} → v${log.version_after}`
                          : (log.version_after != null ? `v${log.version_after}` : '—')}
                      </td>
                      <td style="font-size: 12px;">
                        <div>
                          <Show when={log.scan_record_id}>
                            <div>凭证 #{log.scan_record_id}</div>
                          </Show>
                          <Show when={log.batch_id}>
                            <div style="font-family: monospace; color: var(--blue-600);">{log.batch_id}</div>
                          </Show>
                          <Show when={!log.scan_record_id && !log.batch_id && (log.filter_role || log.filter_status || log.filter_event_type)}>
                            <div style="color: var(--gray-500);">
                              <Show when={log.filter_role}><span>角色筛选</span></Show>
                              <Show when={log.filter_status}><span>;状态筛选</span></Show>
                              <Show when={log.filter_event_type}><span>;类型筛选</span></Show>
                            </div>
                          </Show>
                          <Show when={!log.scan_record_id && !log.batch_id && !log.filter_role && !log.filter_status && !log.filter_event_type}>
                            <span style="color: var(--gray-300);">—</span>
                          </Show>
                        </div>
                      </td>
                      <td style="font-size: 13px; max-width: 320px; word-break: break-all;">{log.detail}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      }>
        <div class="loading">加载中...</div>
      </Show>
    </div>
  );
}
