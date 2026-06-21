import { createSignal, Show, For, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAuth } from '../App';
import { api } from '../api';
import type { Event } from '../types';
import { STATUS_LABELS, EVENT_TYPE_LABELS, SEVERITY_LABELS, ROLE_LABELS } from '../types';

export function EventsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = createSignal<Event[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [filterRole, setFilterRole] = createSignal(user()?.role || '');
  const [filterStatus, setFilterStatus] = createSignal('');
  const [filterType, setFilterType] = createSignal('');
  const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set());

  const loadEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listEvents({
        role: filterRole() || undefined,
        status: filterStatus() || undefined,
        event_type: filterType() || undefined,
      });
      setEvents(data.events);
    } catch (err: any) {
      setError(err?.error || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(loadEvents);

  const handleFilterChange = () => {
    setSelectedIds(new Set());
    loadEvents();
  };

  const toggleSelect = (id: number) => {
    const s = new Set(selectedIds());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelectedIds(s);
  };

  const toggleAll = () => {
    if (selectedIds().size === events().length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(events().map((e) => e.id)));
    }
  };

  const statusBadge = (status: string) => {
    const cls: Record<string, string> = {
      draft: 'badge-gray',
      submitted: 'badge-blue',
      review_rejected: 'badge-red',
      review_passed: 'badge-green',
      archive_rejected: 'badge-yellow',
      archived: 'badge-green',
    };
    return <span class={`badge ${cls[status] || 'badge-gray'}`}>{STATUS_LABELS[status] || status}</span>;
  };

  const severityBadge = (sev: string) => {
    const cls: Record<string, string> = {
      minor: 'badge-gray',
      moderate: 'badge-blue',
      major: 'badge-yellow',
      critical: 'badge-red',
    };
    return <span class={`badge ${cls[sev] || 'badge-gray'}`}>{SEVERITY_LABELS[sev] || sev}</span>;
  };

  const canSelectForBatch = (ev: Event) => {
    const u = user();
    if (!u) return false;
    if (ev.status === 'archived') return false;
    if (ev.current_handler_role !== u.role) return false;
    if (u.role === 'supervisor' && (ev.status === 'submitted' || ev.status === 'archive_rejected')) return true;
    if (u.role === 'reviewer' && ev.status === 'review_passed') return true;
    return false;
  };

  return (
    <div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h2 style="font-size: 20px; font-weight: 600;">医疗事件列表</h2>
        <Show when={user()?.role === 'registrar'}>
          <button class="btn btn-primary" onClick={() => navigate('/events/new')}>
            + 新建事件
          </button>
        </Show>
      </div>

      <div class="filter-bar">
        <select
          value={filterRole()}
          onChange={(e) => { setFilterRole(e.currentTarget.value); handleFilterChange(); }}
        >
          <option value="">全部角色队列</option>
          <option value="registrar">登记员队列</option>
          <option value="supervisor">审核主管队列</option>
          <option value="reviewer">复核负责人队列</option>
        </select>
        <select
          value={filterStatus()}
          onChange={(e) => { setFilterStatus(e.currentTarget.value); handleFilterChange(); }}
        >
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="submitted">已提交</option>
          <option value="review_rejected">审核退回</option>
          <option value="review_passed">审核通过</option>
          <option value="archive_rejected">复核退回</option>
          <option value="archived">已归档</option>
        </select>
        <select
          value={filterType()}
          onChange={(e) => { setFilterType(e.currentTarget.value); handleFilterChange(); }}
        >
          <option value="">全部类型</option>
          <option value="adverse_event">不良事件</option>
          <option value="incident_report">事件上报</option>
          <option value="rectification_tracking">整改追踪</option>
        </select>
        <button class="btn btn-outline btn-sm" onClick={loadEvents}>刷新</button>
      </div>

      <Show when={selectedIds().size > 0}>
        <div class="batch-bar">
          <span>已选 {selectedIds().size} 项</span>
          <button class="btn btn-primary btn-sm" onClick={() => navigate('/batch')}>
            去批量处理
          </button>
          <button class="btn btn-outline btn-sm" onClick={() => setSelectedIds(new Set())}>
            取消选择
          </button>
        </div>
      </Show>

      <Show when={error()}>
        <div class="alert alert-error">{error()}</div>
      </Show>

      <Show when={loading()} fallback={
        <Show when={events().length > 0} fallback={
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <p>暂无医疗事件</p>
          </div>
        }>
          <div class="card" style="padding: 0; overflow-x: auto;">
            <table>
              <thead>
                <tr>
                  <th style="width: 36px;">
                    <input
                      type="checkbox"
                      checked={selectedIds().size === events().length && events().length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  <th>编码</th>
                  <th>标题</th>
                  <th>类型</th>
                  <th>严重程度</th>
                  <th>状态</th>
                  <th>当前处理人</th>
                  <th>时限</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <For each={events()}>
                  {(ev) => (
                    <tr>
                      <td>
                        <Show when={canSelectForBatch(ev)}>
                          <input
                            type="checkbox"
                            checked={selectedIds().has(ev.id)}
                            onChange={() => toggleSelect(ev.id)}
                          />
                        </Show>
                      </td>
                      <td style="font-family: monospace; font-size: 13px;">{ev.code}</td>
                      <td>{ev.title}</td>
                      <td><span class="badge badge-blue">{EVENT_TYPE_LABELS[ev.event_type] || ev.event_type}</span></td>
                      <td>{severityBadge(ev.severity)}</td>
                      <td>{statusBadge(ev.status)}</td>
                      <td>{ROLE_LABELS[ev.current_handler_role || ''] || '—'}</td>
                      <td style="font-size: 13px;">{ev.deadline ? new Date(ev.deadline).toLocaleDateString() : '—'}</td>
                      <td>
                        <button class="btn btn-outline btn-sm" onClick={() => navigate(`/events/${ev.id}`)}>
                          详情
                        </button>
                      </td>
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
