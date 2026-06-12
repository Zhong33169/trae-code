import { createSignal, onMount, Show, For } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { user } from '../stores/auth';
import { apiFetch } from '../utils/api';
import StatusBadge from '../components/StatusBadge';
import Timeline from '../components/Timeline';

interface Material {
  id: number;
  application_id: number;
  stage: string;
  file_name: string;
  file_path: string;
  material_type: string;
  uploaded_at: string;
}

interface AuditLog {
  id: number;
  application_id: number;
  operator_id: number;
  operator_name: string;
  action: string;
  from_status: string;
  to_status: string;
  opinion: string;
  extra_data: any;
  created_at: string;
}

interface Application {
  id: number;
  application_no: string;
  creator_id: number;
  creator_name: string;
  applicant_name: string;
  applicant_id_card: string;
  difficulty_type: string;
  difficulty_description: string;
  assistance_amount: string;
  status: string;
  version: number;
  created_at: string;
  deadline: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  approved_at: string | null;
  opinion_text: string;
  materials: Material[];
  scan_records: any[];
  audit_logs: AuditLog[];
}

const STAGE_MAP: Record<string, number> = {
  draft: 0,
  pending_verify: 1,
  pending_approve: 2,
  approved: 3,
  rejected: 3,
};

const STAGE_MATERIAL: Record<string, string> = {
  submit: 'application',
  verify: 'verification',
  approve: 'approval',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  medical: '医疗困难',
  disaster: '灾害',
  disability: '残疾',
  low_income: '低收入',
  other: '其他',
};

function makeMockMaterial(action: string) {
  const stage = STAGE_MATERIAL[action] || 'application';
  return {
    stage,
    file_name: `${stage}_material_${Date.now()}.pdf`,
    file_path: `/uploads/${stage}/${Date.now()}.pdf`,
    material_type: 'document',
  };
}

export default function ApplicationDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const [app, setApp] = createSignal<Application | null>(null);
  const [opinion, setOpinion] = createSignal('');
  const [amount, setAmount] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  onMount(async () => {
    try {
      const data = await apiFetch(`/api/applications/${params.id}`);
      setApp(data);
      setAmount(String(data.assistance_amount || ''));
    } catch {}
  });

  const currentStage = () => STAGE_MAP[app()?.status || 'draft'] || 0;

  const stages = () => [
    { label: '困难帮扶', completed: currentStage() > 0, active: currentStage() === 0 },
    { label: '入户核实', completed: currentStage() > 1, active: currentStage() === 1 },
    { label: '救助确认', completed: currentStage() > 2, active: currentStage() === 2 },
  ];

  const handleAction = async (action: string) => {
    if (!app()) return;
    setLoading(true);
    setError('');
    try {
      const materials = [makeMockMaterial(action)];
      const body: any = { action, opinion: opinion(), materials };
      await apiFetch(`/api/applications/${params.id}/advance`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await apiFetch(`/api/applications/${params.id}`);
      setApp(data);
      setOpinion('');
    } catch (err: any) {
      setError(err.detail || err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const fmtTime = (t: string) => t ? new Date(t).toLocaleString('zh-CN') : '';

  return (
    <Show when={app()} fallback={
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>加载中...</div>
    }>
      {() => {
        const a = app()!;
        return (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}>
              <div>
                <button
                  onClick={() => navigate('/queue')}
                  style={{ background: 'none', color: 'var(--primary)', fontSize: '13px', marginBottom: '4px' }}
                >
                  ← 返回队列
                </button>
                <h2 style={{ fontSize: '20px', fontWeight: 600 }}>
                  {a.application_no}
                </h2>
              </div>
              <StatusBadge status={a.status} />
            </div>

            <div style={{
              background: 'var(--white)',
              borderRadius: 'var(--radius)',
              padding: '16px 20px',
              boxShadow: 'var(--shadow)',
              marginBottom: '20px',
              display: 'flex',
              gap: '32px',
              fontSize: '14px',
              flexWrap: 'wrap',
            }}>
              <span>申请人: <strong>{a.applicant_name}</strong></span>
              <span>困难类型: {DIFFICULTY_LABELS[a.difficulty_type] || a.difficulty_type}</span>
              <span>救助金额: ¥{a.assistance_amount}</span>
              <span>截止日期: {a.deadline?.slice(0, 10) || '-'}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
              <div style={{
                background: 'var(--white)',
                borderRadius: 'var(--radius)',
                padding: '24px',
                boxShadow: 'var(--shadow)',
              }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px' }}>流程进度</h3>
                <Timeline stages={stages()} />

                <Show when={a.materials?.length > 0}>
                  <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-light)' }}>
                      上传材料
                    </h4>
                    <For each={a.materials}>
                      {(m) => (
                        <div style={{
                          fontSize: '13px',
                          padding: '6px 0',
                          borderBottom: '1px solid #f0f0f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}>
                          <span>{m.file_name}</span>
                          <span style={{ color: 'var(--text-light)', fontSize: '11px' }}>{m.stage}</span>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              <div style={{
                background: 'var(--white)',
                borderRadius: 'var(--radius)',
                padding: '24px',
                boxShadow: 'var(--shadow)',
              }}>
                <Show when={a.status === 'draft' && user()?.role === 'community_worker'}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>编辑申请信息</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-light)' }}>身份证号:</span> {a.applicant_id_card}
                    </div>
                    <div style={{ fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-light)' }}>困难说明:</span> {a.difficulty_description}
                    </div>
                    <button
                      onClick={() => handleAction('submit')}
                      disabled={loading()}
                      style={{
                        background: 'var(--primary)',
                        color: '#fff',
                        padding: '10px',
                        borderRadius: 'var(--radius)',
                        fontSize: '14px',
                        marginTop: '8px',
                        alignSelf: 'flex-start',
                        opacity: loading() ? 0.6 : 1,
                      }}
                    >
                      提交建单
                    </button>
                  </div>
                </Show>

                <Show when={a.status === 'pending_verify' && user()?.role === 'clerk'}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>入户核实</h3>
                  <div style={{ fontSize: '14px', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--text-light)' }}>困难说明:</span> {a.difficulty_description}
                  </div>
                  <label style={{ fontSize: '13px', color: 'var(--text-light)', display: 'block', marginBottom: '12px' }}>
                    核实意见
                    <textarea
                      value={opinion()}
                      onInput={(e) => setOpinion(e.currentTarget.value)}
                      rows={3}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        marginTop: '4px',
                        fontSize: '14px',
                        resize: 'vertical',
                      }}
                    />
                  </label>
                  <Show when={error()}>
                    <div style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '8px' }}>{error()}</div>
                  </Show>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button
                      onClick={() => handleAction('verify')}
                      disabled={loading()}
                      style={{
                        background: 'var(--success)',
                        color: '#fff',
                        padding: '8px 24px',
                        borderRadius: 'var(--radius)',
                        fontSize: '14px',
                        opacity: loading() ? 0.6 : 1,
                      }}
                    >
                      核实通过
                    </button>
                    <button
                      onClick={() => handleAction('reject')}
                      disabled={loading()}
                      style={{
                        background: 'var(--danger)',
                        color: '#fff',
                        padding: '8px 24px',
                        borderRadius: 'var(--radius)',
                        fontSize: '14px',
                        opacity: loading() ? 0.6 : 1,
                      }}
                    >
                      退回
                    </button>
                  </div>
                </Show>

                <Show when={a.status === 'pending_approve' && user()?.role === 'leader'}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>救助确认</h3>
                  <div style={{ fontSize: '14px', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--text-light)' }}>困难说明:</span> {a.difficulty_description}
                  </div>
                  <label style={{ fontSize: '13px', color: 'var(--text-light)', display: 'block', marginBottom: '12px' }}>
                    救助金额 (元)
                    <input
                      type="number"
                      value={amount()}
                      onInput={(e) => setAmount(e.currentTarget.value)}
                      style={{
                        display: 'block',
                        width: '200px',
                        padding: '8px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        marginTop: '4px',
                        fontSize: '14px',
                      }}
                    />
                  </label>
                  <label style={{ fontSize: '13px', color: 'var(--text-light)', display: 'block', marginBottom: '12px' }}>
                    审批意见
                    <textarea
                      value={opinion()}
                      onInput={(e) => setOpinion(e.currentTarget.value)}
                      rows={3}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        marginTop: '4px',
                        fontSize: '14px',
                        resize: 'vertical',
                      }}
                    />
                  </label>
                  <Show when={error()}>
                    <div style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '8px' }}>{error()}</div>
                  </Show>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button
                      onClick={() => handleAction('approve')}
                      disabled={loading()}
                      style={{
                        background: 'var(--success)',
                        color: '#fff',
                        padding: '8px 24px',
                        borderRadius: 'var(--radius)',
                        fontSize: '14px',
                        opacity: loading() ? 0.6 : 1,
                      }}
                    >
                      确认通过
                    </button>
                    <button
                      onClick={() => handleAction('reject')}
                      disabled={loading()}
                      style={{
                        background: 'var(--danger)',
                        color: '#fff',
                        padding: '8px 24px',
                        borderRadius: 'var(--radius)',
                        fontSize: '14px',
                        opacity: loading() ? 0.6 : 1,
                      }}
                    >
                      驳回
                    </button>
                  </div>
                </Show>

                <Show when={
                  (a.status === 'approved' || a.status === 'rejected') ||
                  (a.status === 'draft' && user()?.role !== 'community_worker') ||
                  (a.status === 'pending_verify' && user()?.role !== 'clerk') ||
                  (a.status === 'pending_approve' && user()?.role !== 'leader')
                }>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>申请详情</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                    <div><span style={{ color: 'var(--text-light)' }}>身份证号:</span> {a.applicant_id_card}</div>
                    <div><span style={{ color: 'var(--text-light)' }}>困难说明:</span> {a.difficulty_description}</div>
                    <Show when={a.assistance_amount}>
                      <div><span style={{ color: 'var(--text-light)' }}>救助金额:</span> ¥{a.assistance_amount}</div>
                    </Show>
                  </div>
                </Show>
              </div>
            </div>

            <Show when={a.audit_logs?.length > 0}>
              <div style={{
                background: 'var(--white)',
                borderRadius: 'var(--radius)',
                padding: '24px',
                boxShadow: 'var(--shadow)',
                marginTop: '20px',
              }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>审批记录</h3>
                <table>
                  <thead>
                    <tr>
                      <th>操作人</th>
                      <th>动作</th>
                      <th>状态变更</th>
                      <th>意见</th>
                      <th>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={a.audit_logs}>
                      {(entry) => (
                        <tr>
                          <td>{entry.operator_name}</td>
                          <td>{entry.action}</td>
                          <td>{entry.from_status} → {entry.to_status}</td>
                          <td>{entry.opinion || '-'}</td>
                          <td style={{ fontSize: '12px', color: 'var(--text-light)' }}>{fmtTime(entry.created_at)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </div>
        );
      }}
    </Show>
  );
}
