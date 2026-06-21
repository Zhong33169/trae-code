import { createSignal, Show, For, onMount, createMemo } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAuth } from '../auth';
import { api } from '../api';
import type { Event, ScanCredential } from '../types';
import { STATUS_LABELS, ROLE_LABELS } from '../types';

export default function BatchPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = createSignal<Event[]>([]);
  const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set());
  const [credentials, setCredentials] = createSignal<Record<number, ScanCredential>>({});
  const [scanCode, setScanCode] = createSignal('');
  const [scanTargetId, setScanTargetId] = createSignal<number | null>(null);
  const [scanMsg, setScanMsg] = createSignal<{ id: number | 'global'; success: boolean; message: string; scan_record_id?: number } | null>(null);
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
      const restored: Record<number, ScanCredential> = {};
      actionable.forEach((e) => {
        const c = api.getScanCredential(e.id);
        if (c && c.scan_token === e.scan_token && c.event_version === e.version && c.scanner_role === u.role) {
          restored[e.id] = c;
        }
      });
      setCredentials(restored);
    } catch (err: any) {
      setError(err?.error || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(loadEvents);

  const allSelectedScanned = createMemo(() => {
    const ids = Array.from(selectedIds());
    if (ids.length === 0) return false;
    const creds = credentials();
    return ids.every((id) => creds[id]);
  });

  const missingScans = createMemo(() => {
    const ids = Array.from(selectedIds());
    const creds = credentials();
    return ids.filter((id) => !creds[id]).length;
  });

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

  const openScanFor = (id: number) => {
    setScanTargetId(id);
    const e = events().find((x) => x.id === id);
    setScanCode(e ? `${e.code}:${e.scan_token}` : '');
    setScanMsg(null);
  };

  const closeScan = () => {
    setScanTargetId(null);
    setScanCode('');
    setScanMsg(null);
  };

  const doScan = async () => {
    const tid = scanTargetId();
    if (!tid) return;
    if (!scanCode().trim()) return;
    try {
      const r = await api.scanCode(scanCode().trim());
      setScanMsg({ id: tid, success: r.success, message: r.message, scan_record_id: r.scan_record_id });
      if (r.success && r.event && r.scan_record_id && r.scan_token && r.event.id === tid) {
        const cred: ScanCredential = {
          scan_record_id: r.scan_record_id,
          scan_token: r.scan_token,
          event_id: r.event.id,
          scanner_id: r.scanner?.id || user()!.id,
          scanner_role: r.scanner?.role || user()!.role,
          scanned_at: new Date().toISOString(),
          event_code: r.event.code,
          event_version: r.event.version,
        };
        api.saveScanCredential(r.event.id, cred);
        const next = { ...credentials(), [r.event.id]: cred };
        setCredentials(next);
      }
    } catch (err: any) {
      setScanMsg({ id: tid, success: false, message: err?.error || err?.message || '扫码失败' });
    }
  };

  const revokeCredential = (id: number) => {
    api.clearScanCredential(id);
    const next = { ...credentials() };
    delete next[id];
    setCredentials(next);
  };

  const scanAllSelected = async () => {
    const ids = Array.from(selectedIds());
    const creds = credentials();
    const pending = ids.filter((id) => !creds[id]);
    if (pending.length === 0) {
      setScanMsg({ id: 'global', success: true, message: '所有选中事件均已完成核验' });
      return;
    }
    for (const id of pending) {
      const e = events().find((x) => x.id === id);
      if (!e) continue;
      try {
        const r = await api.scanCode(`${e.code}:${e.scan_token}`);
        if (r.success && r.event && r.scan_record_id && r.scan_token) {
          const cred: ScanCredential = {
            scan_record_id: r.scan_record_id,
            scan_token: r.scan_token,
            event_id: r.event.id,
            scanner_id: r.scanner?.id || user()!.id,
            scanner_role: r.scanner?.role || user()!.role,
            scanned_at: new Date().toISOString(),
            event_code: r.event.code,
            event_version: r.event.version,
          };
          api.saveScanCredential(r.event.id, cred);
          setCredentials((prev) => ({ ...prev, [r.event!.id]: cred }));
        } else {
          setScanMsg({ id, success: false, message: r.message });
          break;
        }
      } catch (err: any) {
        setScanMsg({ id, success: false, message: err?.error || err?.message || '扫码失败' });
        break;
      }
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
    if (!allSelectedScanned()) {
      setError(`还有 ${missingScans()} 个选中事件未完成扫码核验，请先完成核验`);
      return;
    }
    setError('');
    setProcessing(true);
    try {
      const u = user();
      const action = u?.role === 'supervisor' ? 'review' : 'archive_review';
      const ids = Array.from(selectedIds());
      const creds = credentials();
      const scan_record_ids = ids.map((id) => creds[id].scan_record_id);
      const data = await api.batchProcess({
        event_ids: ids,
        scan_record_ids,
        action,
        result: result(),
        opinion: opinion(),
      });
      setBatchResult(data.results);
      ids.forEach((id) => api.clearScanCredential(id));
      const next = { ...creds };
      ids.forEach((id) => delete next[id]);
      setCredentials(next);
      setSelectedIds(new Set());
      setOpinion('');
      setResult('');
      loadEvents();
    } catch (err: any) {
      setError(err?.error || '批量处理失败');
      Array.from(selectedIds()).forEach((id) => api.clearScanCredential(id));
      const next = { ...credentials() };
      Array.from(selectedIds()).forEach((id) => delete next[id]);
      setCredentials(next);
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

      <Show when={scanMsg()}>
        <div class={`alert ${scanMsg()!.success ? 'alert-success' : 'alert-error'}`}>
          事件#{scanMsg()!.id}：{scanMsg()!.message}
          <Show when={!scanMsg()!.success && scanMsg()!.scan_record_id}>
            <span style="color: var(--gray-400); font-size: 12px; margin-left: 8px;">(失败凭证#{scanMsg()!.scan_record_id})</span>
          </Show>
        </div>
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
                  <th>核验状态</th>
                  <th style="width: 140px;">操作</th>
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
                      <td>
                        <Show when={credentials()[ev.id]} fallback={
                          <span class="badge badge-red">未核验</span>
                        }>
                          <span class="badge badge-green">凭证 #{credentials()[ev.id].scan_record_id}</span>
                        </Show>
                      </td>
                      <td>
                        <Show when={credentials()[ev.id]} fallback={
                          <button class="btn btn-primary btn-sm" onClick={() => openScanFor(ev.id)}>扫码核验</button>
                        }>
                          <button class="btn btn-outline btn-sm" onClick={() => revokeCredential(ev.id)}>撤销核验</button>
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>

          <Show when={scanTargetId()}>
            <div class="modal-mask" onClick={closeScan}>
              <div class="modal" onClick={(e) => e.stopPropagation()}>
                <div class="modal-header">
                  <h4>扫码核验事件 #{scanTargetId()}</h4>
                  <button class="btn btn-outline btn-sm" onClick={closeScan}>×</button>
                </div>
                <div class="modal-body">
                  <p style="font-size: 13px; color: var(--gray-500); margin-bottom: 8px;">
                    当前核验码已预填：<span style="font-family: monospace;">{scanCode()}</span>
                  </p>
                  <div class="scan-input-row">
                    <input
                      type="text"
                      placeholder="扫描或输入核验码"
                      value={scanCode()}
                      onInput={(e) => setScanCode(e.currentTarget.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') doScan(); }}
                    />
                    <button class="btn btn-primary" onClick={doScan}>核验</button>
                  </div>
                </div>
              </div>
            </div>
          </Show>

          <div class="card" style="margin-top: 16px;">
            <h3 style="font-size: 16px; margin-bottom: 12px;">{getActionLabel()}</h3>
            <div class="form-group">
              <label>已选事件：{selectedIds().size} 个 / 已核验 {selectedIds().size - missingScans()} 个</label>
              <Show when={selectedIds().size > 0 && !allSelectedScanned()}>
                <div style="margin-top: 6px;">
                  <button class="btn btn-outline btn-sm" onClick={scanAllSelected} disabled={processing()}>
                    一键扫码核验所有未核验的选中事件
                  </button>
                </div>
              </Show>
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
            <button
              class="btn btn-primary"
              onClick={handleBatch}
              disabled={processing() || selectedIds().size === 0 || !allSelectedScanned()}
            >
              {processing() ? '处理中...' : `${getActionLabel()}（${selectedIds().size}个）`}
            </button>
            <Show when={selectedIds().size > 0 && !allSelectedScanned()}>
              <p style="font-size: 13px; color: var(--red-500); margin-top: 8px;">
                还有 {missingScans()} 个事件未完成扫码核验
              </p>
            </Show>
          </div>
        </Show>
      }>
        <div class="loading">加载中...</div>
      </Show>
    </div>
  );
}
