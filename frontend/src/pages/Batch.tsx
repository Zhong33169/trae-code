import { createSignal, Show, For, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAuth } from '../App';
import { api } from '../api';
import type { Event } from '../types';
import { STATUS_LABELS, ROLE_LABELS } from '../types';

export function BatchPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = createSignal<Event[]>([]);
  const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set());
  const [opinion, setOpinion] = createSignal('');
  const [result, setResult] = createSignal('');
  const [loading, setLoading] = createSignal(true);
  const [processing, setProcessing] = createSignal(false);
  const [batchResult, setBatchResult] = createSignal<{ id: number; success: boolean; message: string }[] | null>(null);
  const [error, setError] = createSignal('');

  const loadEvents = async () => {
    setLoading(true);
    try {
      const u = user();
      if (!u) return;
      const data = await api.listEvents({ role: u.role });
      const actionable = data.events.filter((e) => {
        if (e.status === 'archived') return false;
        if (u.role === 'supervisor' && (e.status === 'submitted' || e.status === 'archive_rejected')) return true;
        if (u.role === 'reviewer' && e.status === 'review_passed') return true;
        return false;
      });
      setEvents(actionable);
    } catch (err: any) {
      setError(err?.error || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(loadEvents);

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

  const getActionLabel = () => {
    const u = user();
    if (u?.role === 'supervisor') return '批量审核';
    if (u?.role === 'reviewer') return '批量复核归档';
    return '批量处理';
  };

  const getResultOptions = () => {
    const u = user();
    if (u?.role === 'supervisor') {
      return [
        { value: 'pass', label: '全部通过' },
        { value: 'reject', label: '全部退回' },
      ];
    }
    if (u?.role === 'reviewer') {
      return [
        { value: 'archive', label: '全部归档' },
        { value: 'reject', label: '全部退回' },
      ];
    }
    return [];
  };

  const handleBatch = async () => {
    if (selectedIds().size === 0) { setError('请至少选择1个事件'); return; }
    if (!opinion().trim()) { setError('处理意见不能为空'); return; }
    if (!result()) { setError('请选择处理结果'); return; }
    setError('');
    setProcessing(true);
    try {
      const u = user();
      const action = u?.role === 'supervisor' ? 'review' : 'archive_review';
      const data = await api.batchProcess({
        event_ids: Array.from(selectedIds()),
        action,
        result: result(),
        opinion: opinion(),
      });
      setBatchResult(data.results);
      setSelectedIds(new Set());
      setOpinion('');
      setResult('');
      loadEvents();
    } catch (err: any) {
      setError(err?.error || '批量处理失败');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h2 style="font-size: 20px; font-weight: 600;">批量处理</h2>
        <button class="btn btn-outline btn-sm" onClick={loadEvents}>刷新</button>
      </div>

      <Show when={error()}>
        <div class="alert alert-error">{error()}</div>
      </Show>

      <Show when={batchResult()}>
        <div class="card">
          <h3 style="font-size: 16px; margin-bottom: 12px;">批量处理结果</h3>
          <ul style="list-style: none;">
            <For each={batchResult()!}>
              {(r) => (
                <li style="padding: 6px 0; font-size: 14px; border-bottom: 1px solid var(--gray-100);">
                  <span class={`badge ${r.success ? 'badge-green' : 'badge-red'}`}>
                    {r.success ? '成功' : '失败'}
                  </span>
                  {' '}事件#{r.id}：{r.message}
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>

      <Show when={loading()} fallback={
        <Show when={events().length > 0} fallback={
          <div class="card">
            <div class="empty-state">
              <div class="empty-icon">📋</div>
              <p>当前岗位无待处理事件</p>
            </div>
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
                  <th>状态</th>
                  <th>时限</th>
                </tr>
              </thead>
              <tbody>
                <For each={events()}>
                  {(ev) => (
                    <tr>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds().has(ev.id)}
                          onChange={() => toggleSelect(ev.id)}
                        />
                      </td>
                      <td style="font-family: monospace; font-size: 13px;">{ev.code}</td>
                      <td>{ev.title}</td>
                      <td><span class="badge badge-blue">{STATUS_LABELS[ev.status] || ev.status}</span></td>
                      <td style="font-size: 13px;">{ev.deadline ? new Date(ev.deadline).toLocaleDateString() : '—'}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>

          <div class="card" style="margin-top: 16px;">
            <h3 style="font-size: 16px; margin-bottom: 12px;">{getActionLabel()}</h3>
            <div class="form-group">
              <label>已选事件：{selectedIds().size} 个</label>
            </div>
            <div class="form-group">
              <label>处理意见 *</label>
              <textarea
                value={opinion()}
                onInput={(e) => setOpinion(e.currentTarget.value)}
                placeholder="输入批量处理意见..."
              />
            </div>
            <div class="form-group">
              <label>处理结果 *</label>
              <div style="display: flex; gap: 8px;">
                <For each={getResultOptions()}>
                  {(opt) => (
                    <label class="checkbox-label">
                      <input
                        type="radio"
                        name="batchResult"
                        value={opt.value}
                        checked={result() === opt.value}
                        onChange={() => setResult(opt.value)}
                      />
                      {opt.label}
                    </label>
                  )}
                </For>
              </div>
            </div>
            <button class="btn btn-primary" onClick={handleBatch} disabled={processing() || selectedIds().size === 0}>
              {processing() ? '处理中...' : `${getActionLabel()}（${selectedIds().size}个）`}
            </button>
          </div>
        </Show>
      }>
        <div class="loading">加载中...</div>
      </Show>
    </div>
  );
}
