import { createSignal, Show, For, onMount } from 'solid-js';
import { useNavigate, useParams, A } from '@solidjs/router';
import { useAuth } from '../../auth';
import { api } from '../../api';
import type { Event, ScanCredential } from '../../types';
import { STATUS_LABELS, EVENT_TYPE_LABELS, SEVERITY_LABELS, ROLE_LABELS } from '../../types';

export default function EventDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = createSignal<Event | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [actionError, setActionError] = createSignal('');
  const [actionSuccess, setActionSuccess] = createSignal('');

  const [scanCode, setScanCode] = createSignal('');
  const [scanResult, setScanResult] = createSignal<{ success: boolean; message: string; scan_record_id?: number } | null>(null);
  const [scanVerified, setScanVerified] = createSignal(false);
  const [credential, setCredential] = createSignal<ScanCredential | null>(null);

  const [opinion, setOpinion] = createSignal('');
  const [reviewResult, setReviewResult] = createSignal('');
  const [suppMaterials, setSuppMaterials] = createSignal<{ name: string; material_type: string; content: string }[]>([
    { name: '', material_type: 'document', content: '' },
  ]);

  const loadEvent = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getEvent(parseInt(params.id));
      setEvent(data.event);
      const cred = api.getScanCredential(parseInt(params.id));
      if (cred) {
        const fresh = await api.getEvent(parseInt(params.id));
        if (fresh.event.scan_token === cred.scan_token && fresh.event.version === cred.event_version) {
          setCredential(cred);
          setScanVerified(true);
          setScanResult({ success: true, message: '已核验（凭证有效）', scan_record_id: cred.scan_record_id });
        } else {
          api.clearScanCredential(parseInt(params.id));
        }
      }
    } catch (err: any) {
      setError(err?.error || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(loadEvent);

  const ev = () => event();

  const canSubmit = () => {
    const e = ev();
    const u = user();
    if (!e || !u) return false;
    return u.role === 'registrar' && (e.status === 'draft' || e.status === 'review_rejected') && e.current_handler_role === u.role;
  };

  const canSupplement = () => {
    const e = ev();
    const u = user();
    if (!e || !u) return false;
    return u.role === 'registrar' && e.status === 'review_rejected' && e.current_handler_role === u.role;
  };

  const canReview = () => {
    const e = ev();
    const u = user();
    if (!e || !u) return false;
    return u.role === 'supervisor' && (e.status === 'submitted' || e.status === 'archive_rejected') && e.current_handler_role === u.role;
  };

  const canArchiveReview = () => {
    const e = ev();
    const u = user();
    if (!e || !u) return false;
    return u.role === 'reviewer' && e.status === 'review_passed' && e.current_handler_role === u.role;
  };

  const handleScan = async () => {
    setScanResult(null);
    setActionError('');
    if (!scanCode().trim()) return;
    try {
      const result = await api.scanCode(scanCode().trim());
      setScanResult({ success: result.success, message: result.message, scan_record_id: result.scan_record_id });
      if (result.success && result.event && result.scan_record_id && result.scan_token) {
        const cred: ScanCredential = {
          scan_record_id: result.scan_record_id,
          scan_token: result.scan_token,
          event_id: result.event.id,
          scanner_id: result.scanner?.id || user()!.id,
          scanner_role: result.scanner?.role || user()!.role,
          scanned_at: new Date().toISOString(),
          event_code: result.event.code,
          event_version: result.event.version,
        };
        api.saveScanCredential(result.event.id, cred);
        setCredential(cred);
        setScanVerified(true);
      } else {
        setScanVerified(false);
        setCredential(null);
      }
    } catch (err: any) {
      setScanResult({ success: false, message: err?.error || err?.message || '扫码失败' });
      setScanVerified(false);
      setCredential(null);
    }
  };

  const clearCredentialAndUI = () => {
    const e = ev();
    if (e) api.clearScanCredential(e.id);
    setCredential(null);
    setScanVerified(false);
    setScanCode('');
    setScanResult(null);
  };

  const handleSubmit = async () => {
    const e = ev();
    if (!e) return;
    const cred = credential();
    if (!cred) {
      setActionError('请先完成扫码核验');
      return;
    }
    setActionError('');
    setActionSuccess('');
    try {
      const data = await api.submitEvent(e.id, e.version, cred.scan_record_id);
      setEvent(data.event);
      setActionSuccess('提交成功，已转审核主管');
      clearCredentialAndUI();
    } catch (err: any) {
      setActionError(err?.error || '操作失败');
      clearCredentialAndUI();
    }
  };

  const handleSupplement = async () => {
    const e = ev();
    if (!e) return;
    if (!opinion().trim()) {
      setActionError('补正意见不能为空');
      return;
    }
    const mats = suppMaterials().filter((m) => m.name.trim());
    if (mats.length < 1) {
      setActionError('补正时必须至少上传1份补充材料');
      return;
    }
    const cred = credential();
    if (!cred) {
      setActionError('请先完成扫码核验');
      return;
    }
    setActionError('');
    setActionSuccess('');
    try {
      const data = await api.supplementEvent(e.id, e.version, cred.scan_record_id, opinion(), mats);
      setEvent(data.event);
      setActionSuccess('补正提交成功，已转审核主管');
      clearCredentialAndUI();
      setOpinion('');
      setSuppMaterials([{ name: '', material_type: 'document', content: '' }]);
    } catch (err: any) {
      setActionError(err?.error || '操作失败');
      clearCredentialAndUI();
    }
  };

  const handleReview = async (result: 'pass' | 'reject') => {
    const e = ev();
    if (!e) return;
    if (!opinion().trim()) {
      setActionError('处理意见不能为空');
      return;
    }
    const cred = credential();
    if (!cred) {
      setActionError('请先完成扫码核验');
      return;
    }
    setActionError('');
    setActionSuccess('');
    try {
      const data = await api.reviewEvent(e.id, e.version, cred.scan_record_id, opinion(), result);
      setEvent(data.event);
      setActionSuccess(result === 'pass' ? '审核通过，已转复核负责人' : '已退回登记员补正');
      clearCredentialAndUI();
      setOpinion('');
    } catch (err: any) {
      setActionError(err?.error || '操作失败');
      clearCredentialAndUI();
    }
  };

  const handleArchiveReview = async (result: 'archive' | 'reject') => {
    const e = ev();
    if (!e) return;
    if (!opinion().trim()) {
      setActionError('处理意见不能为空');
      return;
    }
    const cred = credential();
    if (!cred) {
      setActionError('请先完成扫码核验');
      return;
    }
    setActionError('');
    setActionSuccess('');
    try {
      const data = await api.archiveReviewEvent(e.id, e.version, cred.scan_record_id, opinion(), result);
      setEvent(data.event);
      setActionSuccess(result === 'archive' ? '已归档' : '已退回审核主管');
      clearCredentialAndUI();
      setOpinion('');
    } catch (err: any) {
      setActionError(err?.error || '操作失败');
      clearCredentialAndUI();
    }
  };

  const addMaterial = () => {
    setSuppMaterials([...suppMaterials(), { name: '', material_type: 'document', content: '' }]);
  };

  const removeMaterial = (idx: number) => {
    const mats = [...suppMaterials()];
    mats.splice(idx, 1);
    setSuppMaterials(mats);
  };

  const updateMaterial = (idx: number, field: string, value: string) => {
    const mats = [...suppMaterials()];
    mats[idx] = { ...mats[idx], [field]: value };
    setSuppMaterials(mats);
  };

  const statusBadge = (status: string) => {
    const cls: Record<string, string> = {
      draft: 'badge-gray', submitted: 'badge-blue', review_rejected: 'badge-red',
      review_passed: 'badge-green', archive_rejected: 'badge-yellow', archived: 'badge-green',
    };
    return <span class={`badge ${cls[status] || 'badge-gray'}`}>{STATUS_LABELS[status] || status}</span>;
  };

  const hasAction = () => canSubmit() || canSupplement() || canReview() || canArchiveReview();

  return (
    <div>
      <Show when={loading()} fallback={
        <Show when={ev()} fallback={
          <div class="alert alert-error">{error() || '事件不存在'}</div>
        }>
          {(e) => (
            <>
              <div class="detail-header">
                <div>
                  <h2>{e().title}</h2>
                  <div style="display: flex; gap: 8px; margin-top: 6px; align-items: center;">
                    <span style="font-family: monospace; font-size: 13px; color: var(--gray-500);">{e().code}</span>
                    {statusBadge(e().status)}
                    <Show when={e().status !== 'archived'}>
                      <span class="badge badge-blue">当前：{ROLE_LABELS[e().current_handler_role || ''] || '—'}</span>
                    </Show>
                  </div>
                </div>
                <A href="/events" class="btn btn-outline" style="text-decoration: none;">返回列表</A>
              </div>

              <Show when={actionSuccess()}>
                <div class="alert alert-success">{actionSuccess()}</div>
              </Show>
              <Show when={actionError()}>
                <div class="alert alert-error">{actionError()}</div>
              </Show>

              <Show when={hasAction()}>
                <div class="scan-panel">
                  <h4>现场扫码核验（必须步骤）</h4>
                  <p style="font-size: 13px; color: var(--gray-500); margin-bottom: 8px;">
                    当前事件核验码：<span class="qr-display" style="display: inline;">{e().code}:{e().scan_token}</span>
                    <Show when={credential()}>
                      <span class="badge badge-green" style="margin-left: 10px;">
                        凭证 #{credential()!.scan_record_id} 已生效
                      </span>
                    </Show>
                  </p>
                  <div class="scan-input-row">
                    <input
                      type="text"
                      placeholder="扫描或输入核验码（格式：事件编码:核验令牌）"
                      value={scanCode()}
                      onInput={(ev) => setScanCode(ev.currentTarget.value)}
                      onKeyDown={(ev) => { if (ev.key === 'Enter') handleScan(); }}
                    />
                    <button class="btn btn-primary" onClick={handleScan}>核验</button>
                  </div>
                  <Show when={scanResult()}>
                    <div class={`alert ${scanResult()!.success ? 'alert-success' : 'alert-error'}`} style="margin-top: 8px;">
                      {scanResult()!.message}
                      <Show when={!scanResult()!.success && scanResult()!.scan_record_id}>
                        <span style="color: var(--gray-400); font-size: 12px; margin-left: 8px;">(失败凭证#{scanResult()!.scan_record_id})</span>
                      </Show>
                    </div>
                  </Show>
                  <Show when={scanVerified()}>
                    <div class="alert alert-success" style="margin-top: 8px;">
                      核验通过，凭证 #{credential()?.scan_record_id}，可以执行操作
                    </div>
                  </Show>
                </div>
              </Show>

              <div class="card">
                <div class="detail-grid">
                  <div class="detail-field">
                    <div class="field-label">事件类型</div>
                    <div class="field-value">{EVENT_TYPE_LABELS[e().event_type] || e().event_type}</div>
                  </div>
                  <div class="detail-field">
                    <div class="field-label">严重程度</div>
                    <div class="field-value">{SEVERITY_LABELS[e().severity] || e().severity}</div>
                  </div>
                  <div class="detail-field">
                    <div class="field-label">处理时限</div>
                    <div class="field-value">{e().deadline ? new Date(e().deadline).toLocaleString() : '—'}</div>
                  </div>
                  <div class="detail-field">
                    <div class="field-label">创建人</div>
                    <div class="field-value">{e().creator_name || '—'}</div>
                  </div>
                  <div class="detail-field">
                    <div class="field-label">创建时间</div>
                    <div class="field-value">{new Date(e().created_at).toLocaleString()}</div>
                  </div>
                  <div class="detail-field">
                    <div class="field-label">最后更新</div>
                    <div class="field-value">{new Date(e().updated_at).toLocaleString()}</div>
                  </div>
                  <div class="detail-field">
                    <div class="field-label">版本号</div>
                    <div class="field-value">v{e().version}</div>
                  </div>
                </div>
                <div class="detail-field" style="margin-top: 8px;">
                  <div class="field-label">描述</div>
                  <div class="field-value">{e().description || '无'}</div>
                </div>
              </div>

              <div class="card">
                <h3 style="font-size: 16px; margin-bottom: 12px;">材料清单</h3>
                <Show when={e().materials && e().materials!.length > 0} fallback={
                  <p style="color: var(--gray-400); font-size: 14px;">暂无材料</p>
                }>
                  <ul class="material-list">
                    <For each={e().materials || []}>
                      {(mat) => (
                        <li>
                          <span class="mat-type">{mat.material_type === 'image' ? '图片' : '文档'}</span>
                          <span>{mat.name}</span>
                          <span class="badge badge-gray" style="font-size: 11px;">{mat.step === 'supplement' ? '补正材料' : '初始材料'}</span>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </div>

              <div class="card">
                <h3 style="font-size: 16px; margin-bottom: 12px;">处理记录</h3>
                <Show when={e().actions && e().actions!.length > 0} fallback={
                  <p style="color: var(--gray-400); font-size: 14px;">暂无处理记录</p>
                }>
                  <div class="timeline">
                    <For each={e().actions || []}>
                      {(act) => (
                        <div class="timeline-item">
                          <div class="tl-time">{new Date(act.created_at).toLocaleString()}</div>
                          <div class="tl-content">
                            <strong>{ROLE_LABELS[act.actor_role] || act.actor_role}</strong>
                            {' - '}
                            {act.action_type === 'submit' ? '提交' :
                             act.action_type === 'supplement' ? '补正' :
                             act.action_type === 'review' ? '审核' :
                             act.action_type === 'archive_review' ? '复核归档' :
                             act.action_type === 'batch_review' ? '批量审核' :
                             act.action_type === 'batch_archive_review' ? '批量复核' : act.action_type}
                            {act.result ? `（${act.result === 'pass' ? '通过' : act.result === 'reject' ? '退回' : act.result === 'archive' ? '归档' : act.result}）` : ''}
                            {act.opinion ? `：${act.opinion}` : ''}
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              <Show when={hasAction()}>
                <div class="card">
                  <h3 style="font-size: 16px; margin-bottom: 12px;">
                    {canSubmit() ? '提交事件' :
                     canSupplement() ? '补正事件' :
                     canReview() ? '审核事件' :
                     canArchiveReview() ? '复核归档' : ''}
                  </h3>

                  <Show when={canSubmit() && !canSupplement()}>
                    <p style="font-size: 14px; color: var(--gray-500); margin-bottom: 12px;">
                      提交后事件将转交审核主管办理。
                    </p>
                    <button class="btn btn-primary" onClick={handleSubmit} disabled={!scanVerified()}>
                      提交
                    </button>
                  </Show>

                  <Show when={canSupplement()}>
                    <div class="form-group">
                      <label>补正意见 *</label>
                      <textarea
                        value={opinion()}
                        onInput={(ev) => setOpinion(ev.currentTarget.value)}
                        placeholder="说明补正内容..."
                      />
                    </div>
                    <div class="form-group">
                      <label>补充材料 *（至少1份）</label>
                      <For each={suppMaterials()}>
                        {(mat, idx) => (
                          <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                            <input
                              type="text"
                              placeholder="材料名称"
                              value={mat.name}
                              onInput={(ev) => updateMaterial(idx(), 'name', ev.currentTarget.value)}
                              style="flex: 1;"
                            />
                            <select
                              value={mat.material_type}
                              onChange={(ev) => updateMaterial(idx(), 'material_type', ev.currentTarget.value)}
                              style="width: 100px;"
                            >
                              <option value="document">文档</option>
                              <option value="image">图片</option>
                            </select>
                            <input
                              type="text"
                              placeholder="内容描述"
                              value={mat.content}
                              onInput={(ev) => updateMaterial(idx(), 'content', ev.currentTarget.value)}
                              style="flex: 1;"
                            />
                            <button class="btn btn-outline btn-sm" onClick={() => removeMaterial(idx())} disabled={suppMaterials().length <= 1}>×</button>
                          </div>
                        )}
                      </For>
                      <button class="btn btn-outline btn-sm" onClick={addMaterial}>+ 添加材料</button>
                    </div>
                    <button class="btn btn-primary" onClick={handleSupplement} disabled={!scanVerified()}>
                      补正并重新提交
                    </button>
                  </Show>

                  <Show when={canReview()}>
                    <div class="form-group">
                      <label>处理意见 *</label>
                      <textarea
                        value={opinion()}
                        onInput={(ev) => setOpinion(ev.currentTarget.value)}
                        placeholder="输入审核意见..."
                      />
                    </div>
                    <div style="display: flex; gap: 8px;">
                      <button class="btn btn-success" onClick={() => handleReview('pass')} disabled={!scanVerified()}>
                        审核通过
                      </button>
                      <button class="btn btn-danger" onClick={() => handleReview('reject')} disabled={!scanVerified()}>
                        退回补正
                      </button>
                    </div>
                  </Show>

                  <Show when={canArchiveReview()}>
                    <div class="form-group">
                      <label>复核意见 *</label>
                      <textarea
                        value={opinion()}
                        onInput={(ev) => setOpinion(ev.currentTarget.value)}
                        placeholder="输入复核意见..."
                      />
                    </div>
                    <div style="display: flex; gap: 8px;">
                      <button class="btn btn-success" onClick={() => handleArchiveReview('archive')} disabled={!scanVerified()}>
                        复核归档
                      </button>
                      <button class="btn btn-danger" onClick={() => handleArchiveReview('reject')} disabled={!scanVerified()}>
                        退回审核主管
                      </button>
                    </div>
                  </Show>
                </div>
              </Show>
            </>
          )}
        </Show>
      }>
        <div class="loading">加载中...</div>
      </Show>
    </div>
  );
}
