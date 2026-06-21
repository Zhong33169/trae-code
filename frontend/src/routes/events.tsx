import { createSignal, Show, For, onMount, createEffect } from 'solid-js';
import { useNavigate, A } from '@solidjs/router';
import { useAuth } from '../auth';
import { api } from '../api';
import type { Event, EventFilters, QueueSummary } from '../types';
import { STATUS_LABELS, EVENT_TYPE_LABELS, SEVERITY_LABELS, ROLE_LABELS } from '../types';

export default function EventsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = createSignal<Event[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [filterRole, setFilterRole] = createSignal('');
  const [filterStatus, setFilterStatus] = createSignal('');
  const [filterType, setFilterType] = createSignal('');
  const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set());
  const [queueSummary, setQueueSummary] = createSignal<QueueSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = createSignal(true);

  onMount(() => {
    const u = user();
    const stored = api.getStoredFilters();
    if (stored.role) {
      setFilterRole(stored.role);
    } else if (u) {
      setFilterRole(u.role);
    }
    if (stored.status) setFilterStatus(stored.status);
    if (stored.event_type) setFilterType(stored.event_type);
    loadQueueSummary();
  });

  createEffect(() => {
    const u = user();
    if (!u) return;
    if (!filterRole()) {
      setFilterRole(u.role);
    }
    loadEvents();
  });

  const loadEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const params: { role?: string; status?: string; event_type?: string } = {};
      if (filterRole()) params.role = filterRole();
      if (filterStatus()) params.status = filterStatus();
      if (filterType()) params.event_type = filterType();
      const data = await api.listEvents(params);
      setEvents(data.events);
    } catch (err: any) {
      setError(err?.error || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadQueueSummary = async () => {
    try {
      setSummaryLoading(true);
      const data = await api.getQueueSummary();
      setQueueSummary(data);
    } catch (e) {} finally {
      setSummaryLoading(false);
    }
  };

  const persistAndLoad = async (filters: EventFilters) => {
    api.setStoredFilters(filters);
    try {
      await api.logFilterChange(filters);
    } catch (e) {}
    setSelectedIds(new Set<number>());
    loadEvents();
    loadQueueSummary();
  };

  const handleRoleChange = (v: string) => {
    setFilterRole(v);
    persistAndLoad({ role: v, status: filterStatus(), event_type: filterType() });
  };

  const handleStatusChange = (v: string) => {
    setFilterStatus(v);
    persistAndLoad({ role: filterRole(), status: v, event_type: filterType() });
  };

  const handleTypeChange = (v: string) => {
    setFilterType(v);
    persistAndLoad({ role: filterRole(), status: filterStatus(), event_type: v });
  };

  const toggleSelect = (id: number) => {
    const s = new Set(selectedIds());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelectedIds(s);
  };

  const toggleAll = () => {
    if (selectedIds().size === events().length) {
      setSelectedIds(new Set<number>());
    } else {
      setSelectedIds(new Set(events().map((e) => e.id)));
    }
  };

  const goToBatch = () => {
    if (selectedIds().size > 0) {
      const ids = Array.from(selectedIds());
      sessionStorage.setItem('batch_selected_ids', JSON.stringify(ids));
    }
    navigate('/batch');
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

  const totalMine = () => {
    const q = queueSummary();
    if (!q) return 0;
    return q.actionable_count + q.supplement_pending_count + q.review_pending_count;
  };

  const queueTabs = () => {
    const q = queueSummary();
    if (!q) return [];
    const tabs: { key: string; label: string; count: number }[] = [];
    const u = user();
    if (!u) return tabs;
    if (u.role === 'registrar') {
      tabs.push({ key: 'registrar:actionable', label: '待提交', count: q.actionable_count });
      tabs.push({ key: 'registrar:supplement', label: '待补正', count: q.supplement_pending_count });
    } else if (u.role === 'supervisor') {
      tabs.push({ key: 'supervisor:review', label: '审核待办', count: q.review_pending_count });
    } else if (u.role === 'reviewer') {
      tabs.push({ key: 'reviewer:actionable', label: '复核待办', count: q.actionable_count });
    }
    return tabs;
  };

  const applyQueueTab = (key: string) => {
    const [role, kind] = key.split(':');
    let status = '';
    if (kind === 'supplement') status = 'review_rejected';
    if (kind === 'review') status = '';
    if (kind === 'actionable' && role === 'registrar') status = 'draft';
    if (kind === 'actionable' && role === 'reviewer') status = 'review_passed';
    setFilterRole(role);
    setFilterStatus(status);
    persistAndLoad({ role, status, event_type: '' });
    setFilterType('');
  };

  return (
    <div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <h2 style="font-size: 20px; font-weight: 600; margin: 0;">医疗事件列表</h2>
          <Show when={queueSummary()}>
            <span class="badge badge-blue">
              {queueSummary()!.role_label}队列：待办 {totalMine()} 项
            </span>
          </Show>
        </div>
        <Show when={user()?.role === 'registrar'}>
          <A href="/events/new" class="btn btn-primary" style="text-decoration: none;">
            + 新建事件
          </A>
        </Show>
      </div>

      <Show when={queueSummary() && !summaryLoading()}>
          <div class="card" style="margin-bottom: 16px;">
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              <For each={queueTabs()}>
                {(tab) => (
                  <button
                    class={`btn ${filterRole() === tab.key.split(':')[0] ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    onClick={() => applyQueueTab(tab.key)}
                  >
                    {tab.label} {tab.count > 0 && <span style="margin-left: 6px; opacity: 0.8;">({tab.count})</span>}
                  </button>
                )}
              </For>
              <button
                class={`btn ${filterRole() === '' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                onClick={() => { setFilterRole(''); setFilterStatus(''); setFilterType(''); persistAndLoad({ role: '', status: '', event_type: '' }); }}
              >
                查看全部 ({queueSummary()!.total})
              </button>
            </div>
            <Show when={queueSummary()!.not_actionable_count > 0 && filterRole() === queueSummary()!.role && !filterStatus()}>
              <div style="margin-top: 12px;">
                <details>
                  <summary style="cursor: pointer; font-size: 13px; color: var(--gray-500);">
                    不可处理事件 {queueSummary()!.not_actionable_count} 项（点击展开原因）
                  </summary>
                  <div style="margin-top: 8px; padding: 8px 12px; background: var(--gray-50); border-radius: 6px; font-size: 13px;">
                    <For each={queueSummary()!.not_actionable.slice(0, 10)}>
                      {(item) => (
                        <div style="padding: 4px 0; border-bottom: 1px solid var(--gray-100); display: flex; justify-content: space-between;">
                          <span style="font-family: monospace;">{item.event_code}</span>
                          <span style="color: var(--gray-500);">{item.reason}</span>
                        </div>
                      )}
                    </For>
                    <Show when={queueSummary()!.not_actionable_count > 10}>
                      <div style="padding: 4px 0; color: var(--gray-400);">... 还有 {queueSummary()!.not_actionable_count - 10} 项</div>
                    </Show>
                  </div>
                </details>
              </div>
            </Show>
          </div>
      </Show>

      <div class="filter-bar">
        <select
          value={filterRole()}
          onChange={(e) => handleRoleChange(e.currentTarget.value)}
        >
          <option value="">全部角色队列</option>
          <option value="registrar">登记员队列</option>
          <option value="supervisor">审核主管队列</option>
          <option value="reviewer">复核负责人队列</option>
        </select>
        <select
          value={filterStatus()}
          onChange={(e) => handleStatusChange(e.currentTarget.value)}
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
          onChange={(e) => handleTypeChange(e.currentTarget.value)}
        >
          <option value="">全部类型</option>
          <option value="adverse_event">不良事件</option>
          <option value="incident_report">事件上报</option>
          <option value="rectification_tracking">整改追踪</option>
        </select>
        <button class="btn btn-outline btn-sm" onClick={() => { loadEvents(); loadQueueSummary(); }}>刷新</button>
      </div>

      <Show when={selectedIds().size > 0}>
        <div class="batch-bar">
          <span>已选 {selectedIds().size} 项</span>
          <button class="btn btn-primary btn-sm" onClick={goToBatch}>
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
                  <th>版本</th>
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
                      <td style="font-size: 12px; color: var(--gray-400);">v{ev.version}</td>
                      <td>
                        <A href={`/events/${ev.id}`} class="btn btn-outline btn-sm" style="text-decoration: none;">
                          详情
                        </A>
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
