import { createSignal, For, Show } from 'solid-js';
import { apiFetch } from '../utils/api';

const RESULT_LABELS: Record<string, string> = {
  pass: '核验通过',
  invalid_code: '无效编码',
  duplicate_scan: '重复扫码',
  role_mismatch: '角色不匹配',
};

interface ScanResult {
  result: string;
  credential_no: string;
  scan_time: string;
  message: string;
  applicant_name?: string;
  application_no?: string;
}

interface ScanHistory {
  id: number;
  code: string;
  result: ScanResult;
  scanned_at: string;
}

export default function ScanVerify() {
  const [code, setCode] = createSignal('');
  const [result, setResult] = createSignal<ScanResult | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [history, setHistory] = createSignal<ScanHistory[]>([]);

  const handleScan = async () => {
    if (!code().trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch('/api/scan/verify', {
        method: 'POST',
        body: JSON.stringify({ code: code().trim() }),
      });
      const res: ScanResult = {
        result: data.result,
        credential_no: data.credential_no || '',
        scan_time: data.scan_time || new Date().toLocaleString('zh-CN'),
        message: data.message || '',
        applicant_name: data.application?.applicant_name,
        application_no: data.application?.application_no,
      };
      setResult(res);
      setHistory([{
        id: Date.now(),
        code: code().trim(),
        result: res,
        scanned_at: new Date().toLocaleString('zh-CN'),
      }, ...history()]);
      setCode('');
    } catch (err: any) {
      setResult({ result: 'invalid_code', credential_no: '', scan_time: '', message: err.detail || err.message || '核验失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>扫码核验</h2>

      <div style={{
        background: 'var(--white)',
        borderRadius: 'var(--radius)',
        padding: '32px',
        boxShadow: 'var(--shadow)',
        textAlign: 'center',
        marginBottom: '24px',
      }}>
        <div style={{
          width: '120px',
          height: '120px',
          margin: '0 auto 20px',
          border: '2px dashed var(--border)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '48px',
          color: 'var(--text-light)',
        }}>
          📷
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '16px' }}>
          请扫描帮扶凭证上的二维码进行核验
        </p>
        <div style={{ display: 'flex', gap: '12px', maxWidth: '400px', margin: '0 auto' }}>
          <input
            value={code()}
            onInput={(e) => setCode(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            placeholder="输入二维码内容或凭证编号"
            style={{
              flex: 1,
              padding: '10px 14px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
            }}
          />
          <button
            onClick={handleScan}
            disabled={loading()}
            style={{
              background: 'var(--primary)',
              color: '#fff',
              padding: '10px 24px',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
              opacity: loading() ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            核验
          </button>
        </div>
      </div>

      <Show when={result()}>
        {() => {
          const r = result()!;
          const pass = r.result === 'pass';
          return (
            <div style={{
              background: pass ? '#f0fff4' : '#fff5f5',
              border: `1px solid ${pass ? 'var(--success)' : 'var(--danger)'}`,
              borderRadius: 'var(--radius)',
              padding: '20px',
              marginBottom: '24px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                fontSize: '16px',
                fontWeight: 600,
                color: pass ? 'var(--success)' : 'var(--danger)',
              }}>
                <span>{pass ? '✅' : '❌'}</span>
                <span>{RESULT_LABELS[r.result] || r.message || '未知结果'}</span>
              </div>
              <Show when={pass}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px' }}>
                  <div>凭证编号: <strong>{r.credential_no}</strong></div>
                  <Show when={r.applicant_name}>
                    <div>申请人: {r.applicant_name}</div>
                  </Show>
                  <Show when={r.application_no}>
                    <div>申请编号: {r.application_no}</div>
                  </Show>
                  <div>核验时间: {r.scan_time}</div>
                </div>
              </Show>
              <Show when={!pass}>
                <div style={{ fontSize: '14px', color: 'var(--danger)' }}>
                  原因: {r.message || RESULT_LABELS[r.result] || '未知错误'}
                </div>
              </Show>
            </div>
          );
        }}
      </Show>

      <Show when={history().length > 0}>
        <div style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
        }}>
          <div style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            fontSize: '14px',
            fontWeight: 600,
          }}>
            近期核验记录
          </div>
          <For each={history()}>
            {(item) => (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 20px',
                borderBottom: '1px solid var(--border)',
                fontSize: '13px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span>{item.result.result === 'pass' ? '✅' : '❌'}</span>
                  <span style={{ color: 'var(--text-light)' }}>{item.code}</span>
                </div>
                <span style={{ color: 'var(--text-light)', fontSize: '12px' }}>{item.scanned_at}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
