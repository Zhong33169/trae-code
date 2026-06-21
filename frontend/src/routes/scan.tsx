import { createSignal, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { useAuth } from '../auth';
import { api } from '../api';
import type { Event, ScanCredential } from '../types';
import { STATUS_LABELS, ROLE_LABELS } from '../types';

export default function ScanPage() {
  const { user } = useAuth();
  const [scanCode, setScanCode] = createSignal('');
  const [scanResult, setScanResult] = createSignal<{
    success: boolean;
    message: string;
    event?: Event;
    scan_record_id?: number;
    scan_token?: string;
  } | null>(null);
  const [loading, setLoading] = createSignal(false);

  const handleScan = async () => {
    if (!scanCode().trim()) return;
    setLoading(true);
    setScanResult(null);
    try {
      const result = await api.scanCode(scanCode().trim());
      setScanResult(result);
      if (result.success && result.event && result.scan_record_id && result.scan_token) {
        const cred: ScanCredential = {
          scan_record_id: result.scan_record_id,
          scan_token: result.scan_token,
          event_id: result.event.id,
          scanner_id: user()!.id,
          scanner_role: user()!.role,
          scanned_at: new Date().toISOString(),
          event_code: result.event.code,
          event_version: result.event.version,
        };
        api.saveScanCredential(result.event.id, cred);
      }
    } catch (err: any) {
      setScanResult({ success: false, message: err?.error || err?.message || '扫码失败' });
    } finally {
      setLoading(false);
    }
  };

  const demoCodes = [
    { code: 'INC-20260602-D4E5F6:d4e5f6a1b2c3', label: '有效码-待审核事件（主管登录有效）' },
    { code: 'INC-20260602-D4E5F6:old_token', label: '重复码-已过期令牌' },
    { code: 'FAKE-CODE-99999', label: '无效码-不存在编码' },
    { code: 'INC-20260601-A1B2C3:a1b2c3d4e5f6', label: '非当前处理人（主管扫登记员草稿）' },
  ];

  return (
    <div>
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">扫码核验</h2>
      <p style="font-size: 14px; color: var(--gray-500); margin-bottom: 16px;">
        扫描或输入医疗事件单上的核验码，系统将验证编码有效性、是否重复使用以及操作人权限。核验通过后凭证自动保存，进入详情页可直接执行操作。
      </p>

      <div class="card">
        <div class="scan-panel">
          <h4>扫码输入</h4>
          <p style="font-size: 13px; color: var(--gray-500); margin-bottom: 8px;">
            核验码格式：事件编码:核验令牌（如 INC-20260601-A1B2C3:a1b2c3d4e5f6）
          </p>
          <div class="scan-input-row">
            <input
              type="text"
              placeholder="扫描或输入核验码"
              value={scanCode()}
              onInput={(e) => setScanCode(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleScan(); }}
            />
            <button class="btn btn-primary" onClick={handleScan} disabled={loading()}>
              {loading() ? '核验中...' : '核验'}
            </button>
          </div>
        </div>

        <div style="margin-top: 16px;">
          <p style="font-size: 13px; color: var(--gray-400); margin-bottom: 8px;">演示核验码：</p>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            {demoCodes.map((dc) => (
              <button
                class="btn btn-outline btn-sm"
                onClick={() => setScanCode(dc.code)}
              >
                {dc.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Show when={scanResult()}>
        <div class="card">
          <div class={`alert ${scanResult()!.success ? 'alert-success' : 'alert-error'}`}>
            <strong>{scanResult()!.success ? '核验通过' : '核验失败'}</strong>：{scanResult()!.message}
            <Show when={scanResult()!.success && scanResult()!.scan_record_id}>
              <span style="margin-left: 10px; font-size: 12px;">(已生成凭证 #{scanResult()!.scan_record_id})</span>
            </Show>
            <Show when={!scanResult()!.success && scanResult()!.scan_record_id}>
              <span style="margin-left: 10px; font-size: 12px;">(失败凭证 #{scanResult()!.scan_record_id})</span>
            </Show>
          </div>
          <Show when={scanResult()!.event}>
            {(ev) => (
              <div style="margin-top: 12px;">
                <div class="detail-grid">
                  <div class="detail-field">
                    <div class="field-label">事件编码</div>
                    <div class="field-value" style="font-family: monospace;">{ev().code}</div>
                  </div>
                  <div class="detail-field">
                    <div class="field-label">标题</div>
                    <div class="field-value">{ev().title}</div>
                  </div>
                  <div class="detail-field">
                    <div class="field-label">状态</div>
                    <div class="field-value">{STATUS_LABELS[ev().status] || ev().status}</div>
                  </div>
                  <div class="detail-field">
                    <div class="field-label">当前处理人</div>
                    <div class="field-value">{ROLE_LABELS[ev().current_handler_role || ''] || '—'}</div>
                  </div>
                </div>
                <Show when={scanResult()!.success}>
                  <A href={`/events/${ev().id}`} class="btn btn-primary" style="text-decoration: none; display: inline-block; margin-top: 8px;">
                    进入事件详情处理
                  </A>
                </Show>
              </div>
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
}
