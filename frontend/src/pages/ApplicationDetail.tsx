import { createSignal, onMount, Show, For, createMemo } from 'solid-js';
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

interface PendingMaterial {
  stage: string;
  file_name: string;
  file_path: string;
  material_type: string;
}

interface ScanRecord {
  id: number;
  application_id: number | null;
  scanner_id: number;
  scanner_name: string;
  code: string;
  credential_no: string;
  result: string;
  scan_time: string;
}

interface AuditLog {
  id: number;
  application_id: number;
  operator_id: number;
  operator_name: string;
  operator_role: string;
  action: string;
  from_status: string;
  to_status: string;
  opinion: string;
  client_version: number;
  deadline_check: string;
  failure_reason: string;
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
  overdue_reason: string;
  available_actions: string[];
  materials: Material[];
  scan_records: ScanRecord[];
  audit_logs: AuditLog[];
}

const STAGE_MAP: Record<string, number> = {
  draft: 0,
  pending_verify: 1,
  pending_approve: 2,
  approved: 3,
  rejected: 3,
};

const STAGE_DISPLAY: Record<string, string> = {
  application: '申请阶段',
  verification: '核验阶段',
  approval: '审批阶段',
};

const ACTION_STAGE: Record<string, string> = {
  submit: 'application',
  verify: 'verification',
  approve: 'approval',
};

const RESULT_LABELS: Record<string, string> = {
  pass: '通过',
  invalid_code: '无效编码',
  duplicate_scan: '重复扫码',
  role_mismatch: '角色不匹配',
};

const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  submit: '提交',
  verify: '核实通过',
  approve: '审批通过',
  reject: '驳回',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  medical: '医疗困难',
  disaster: '灾害',
  disability: '残疾',
  low_income: '低收入',
  other: '其他',
};

const MATERIAL_TYPES: Record<string, string[]> = {
  application: ['申请表', '困难证明', '身份证复印件', '收入证明'],
  verification: ['核验报告', '入户照片', '访谈记录', '证明材料'],
  approval: ['审批意见', '会议纪要', '公示截图'],
};

const OPINION_REQUIRED_ACTIONS = new Set(['submit', 'verify', 'approve', 'reject']);
const OVERDUE_REQUIRED_ACTIONS = new Set(['submit', 'verify', 'approve', 'reject']);

export default function ApplicationDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const [app, setApp] = createSignal<Application | null>(null);
  const [opinion, setOpinion] = createSignal('');
  const [overdueReason, setOverdueReason] = createSignal('');
  const [amount, setAmount] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [pendingMaterials, setPendingMaterials] = createSignal<PendingMaterial[]>([]);
  const [newFileName, setNewFileName] = createSignal('');
  const [newMaterialType, setNewMaterialType] = createSignal('');

  const isOverdue = createMemo(() => {
    const dl = app()?.deadline;
    if (!dl) return false;
    return new Date() > new Date(dl);
  });

  const overdueDays = createMemo(() => {
    const dl = app()?.deadline;
    if (!dl) return 0;
    const diff = Date.now() - new Date(dl).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  });

  const requireOpinion = (action: string) => OPINION_REQUIRED_ACTIONS.has(action);
  const requireOverdueReason = (action: string) => OVERDUE_REQUIRED_ACTIONS.has(action) && isOverdue();

  onMount(async () => {
    try {
      const data = await apiFetch(`/api/applications/${params.id}`);
      setApp(data);
      setAmount(String(data.assistance_amount || ''));
      setOverdueReason(data.overdue_reason || '');
    } catch (err: any) {
      setError(err.detail || err.message || '加载失败');
    }
  });

  const currentStage = () => STAGE_MAP[app()?.status || 'draft'] || 0;

  const stages = () => [
    { label: '困难帮扶', completed: currentStage() > 0, active: currentStage() === 0 },
    { label: '入户核实', completed: currentStage() > 1, active: currentStage() === 1 },
    { label: '救助确认', completed: currentStage() > 2, active: currentStage() === 2 },
  ];

  const currentStageKey = () => {
    const s = app()?.status;
    if (s === 'draft') return 'application';
    if (s === 'pending_verify') return 'verification';
    if (s === 'pending_approve') return 'approval';
    return '';
  };

  const materialsByStage = (stage: string) => {
    return app()?.materials?.filter(m => m.stage === stage) || [];
  };

  const pendingByStage = (stage: string) => {
    return pendingMaterials().filter(m => m.stage === stage);
  };

  const addMaterial = () => {
    if (!newFileName().trim()) return;
    const stage = currentStageKey();
    if (!stage) return;
    const matType = newMaterialType() || (MATERIAL_TYPES[stage]?.[0] || '其他');
    setPendingMaterials([
      ...pendingMaterials(),
      {
        stage,
        file_name: newFileName().trim(),
        file_path: `uploads/${app()?.application_no}/${stage}/${Date.now()}_${newFileName().trim()}`,
        material_type: matType,
      }
    ]);
    setNewFileName('');
    setNewMaterialType('');
  };

  const removePendingMaterial = (idx: number) => {
    const arr = [...pendingMaterials()];
    arr.splice(idx, 1);
    setPendingMaterials(arr);
  };

  const canEditMaterials = () => {
    const s = app()?.status;
    const r = user()?.role;
    if (s === 'draft' && r === 'community_worker') return true;
    if (s === 'pending_verify' && r === 'clerk') return true;
    if (s === 'pending_approve' && r === 'leader') return true;
    return false;
  };

  const validateBeforeSubmit = (action: string): string | null => {
    if (requireOpinion(action) && !opinion().trim()) {
      const stageLabel = action === 'submit' ? '困难帮扶提交' : action === 'verify' ? '入户核实' : action === 'approve' ? '救助确认' : '驳回';
      return `${stageLabel}必须填写处理意见`;
    }
    if (requireOverdueReason(action) && !overdueReason().trim()) {
      return `申请已逾期${overdueDays()}天，必须填写逾期说明`;
    }
    return null;
  };

  const handleAction = async (action: string) => {
    if (!app()) return;
    const validationError = validateBeforeSubmit(action);
    if (validationError) {
      const appNo = app()?.application_no || '';
      setError(appNo ? `[${appNo}] ${validationError}` : validationError);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const body: any = {
        action,
        opinion: opinion(),
        materials: pendingMaterials(),
        version: app()!.version,
        overdue_reason: overdueReason(),
      };
      await apiFetch(`/api/applications/${params.id}/advance`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await apiFetch(`/api/applications/${params.id}`);
      setApp(data);
      setOpinion('');
      setOverdueReason('');
      setPendingMaterials([]);
    } catch (err: any) {
      const msg = err.detail || err.message || '操作失败';
      const appNo = app()?.application_no || '';
      setError(appNo ? `[${appNo}] ${msg}` : msg);
    } finally {
      setLoading(false);
    }
  };

  const fmtTime = (t: string | null) => t ? new Date(t).toLocaleString('zh-CN') : '';

  return (
    <Show when={app()} fallback={
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>
        {error() || '加载中...'}
      </div>
    }>
      {() => {
        const a = app()!;
        const stageKey = currentStageKey();
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
                <h2 style={{ fontSize: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {a.application_no}
                  <Show when={isOverdue()}>
                    <span style={{
                      fontSize: '12px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      fontWeight: 500,
                    }}>
                      ⚠️ 已逾期 {overdueDays()} 天
                    </span>
                  </Show>
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
              <span>身份证号: {a.applicant_id_card}</span>
              <span>困难类型: {DIFFICULTY_LABELS[a.difficulty_type] || a.difficulty_type}</span>
              <span>救助金额: ¥{a.assistance_amount}</span>
              <span style={{ color: isOverdue() ? '#dc2626' : 'inherit' }}>
                截止日期: {a.deadline?.slice(0, 10) || '-'}
              </span>
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

                <Show when={(a.materials?.length || pendingMaterials().length) > 0}>
                  <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-light)' }}>
                      已上传材料
                    </h4>
                    <For each={a.materials}>
                      {(m) => (
                        <div style={{
                          fontSize: '13px',
                          padding: '6px 0',
                          borderBottom: '1px solid #f0f0f0',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{m.file_name}</span>
                            <span style={{ color: 'var(--text-light)', fontSize: '11px' }}>
                              {STAGE_DISPLAY[m.stage] || m.stage}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                            类型: {m.material_type}
                          </div>
                        </div>
                      )}
                    </For>
                    <For each={pendingMaterials()}>
                      {(m, idx) => (
                        <div style={{
                          fontSize: '13px',
                          padding: '6px 0',
                          borderBottom: '1px solid #f0f0f0',
                          background: '#fffbeb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}>
                          <div>
                            <div>{m.file_name} <span style={{ color: 'var(--warning)', fontSize: '11px' }}>(待提交)</span></div>
                            <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>类型: {m.material_type}</div>
                          </div>
                          <button
                            onClick={() => removePendingMaterial(idx())}
                            style={{ background: 'none', color: 'var(--danger)', fontSize: '12px', padding: '2px 6px' }}
                          >
                            移除
                          </button>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>

                <Show when={a.scan_records?.length > 0}>
                  <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-light)' }}>
                      扫码记录
                    </h4>
                    <For each={a.scan_records}>
                      {(s) => (
                        <div style={{
                          fontSize: '12px',
                          padding: '6px 0',
                          borderBottom: '1px solid #f0f0f0',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{
                              color: s.result === 'pass' ? 'var(--success)' : 'var(--danger)',
                              fontWeight: 500,
                            }}>
                              {RESULT_LABELS[s.result] || s.result}
                            </span>
                            <span style={{ color: 'var(--text-light)' }}>{fmtTime(s.scan_time)}</span>
                          </div>
                          <div style={{ color: 'var(--text-light)' }}>
                            扫码人: {s.scanner_name}
                          </div>
                          <Show when={s.credential_no}>
                            <div style={{ color: 'var(--text-light)' }}>凭证: {s.credential_no}</div>
                          </Show>
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
                <Show when={error()}>
                  <div style={{
                    color: 'var(--danger)',
                    fontSize: '13px',
                    padding: '10px 12px',
                    background: '#fef2f2',
                    borderRadius: 'var(--radius)',
                    marginBottom: '16px',
                    border: '1px solid #fecaca',
                  }}>{error()}</div>
                </Show>

                <Show when={isOverdue() && a.status !== 'approved' && a.status !== 'rejected'}>
                  <div style={{
                    background: '#fffbea',
                    border: '1px solid #fef3c7',
                    borderRadius: 'var(--radius)',
                    padding: '12px 14px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    color: '#92400e',
                  }}>
                    ⚠️ 申请已逾期 <strong>{overdueDays()}</strong> 天，原截止日期：{a.deadline?.slice(0, 10)}，请填写逾期说明后再推进。
                  </div>
                </Show>

                <Show when={a.status === 'draft'}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>困难帮扶 - 申请材料</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-light)' }}>申请人:</span> {a.applicant_name}
                    </div>
                    <div style={{ fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-light)' }}>身份证号:</span> {a.applicant_id_card}
                    </div>
                    <div style={{ fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-light)' }}>困难说明:</span> {a.difficulty_description}
                    </div>

                    <label style={{ fontSize: '13px', color: 'var(--text-light)', display: 'block' }}>
                      提交意见 <span style={{ color: 'var(--danger)' }}>*</span>
                      <textarea
                        value={opinion()}
                        onInput={(e) => setOpinion(e.currentTarget.value)}
                        rows={3}
                        placeholder="请填写困难帮扶提交意见..."
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

                    <Show when={requireOverdueReason('submit')}>
                      <label style={{ fontSize: '13px', color: 'var(--text-light)', display: 'block' }}>
                        逾期说明 <span style={{ color: 'var(--danger)' }}>*</span>
                        <textarea
                          value={overdueReason()}
                          onInput={(e) => setOverdueReason(e.currentTarget.value)}
                          rows={2}
                          placeholder="请填写逾期未及时处理的原因..."
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
                    </Show>

                    <Show when={canEditMaterials()}>
                      <div style={{ marginTop: '12px', padding: '12px', background: '#f7fafc', borderRadius: 'var(--radius)' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>上传申请材料</h4>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input
                            placeholder="材料文件名 (如: 困难证明.pdf)"
                            value={newFileName()}
                            onInput={(e) => setNewFileName(e.currentTarget.value)}
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius)',
                              fontSize: '13px',
                            }}
                          />
                          <select
                            value={newMaterialType()}
                            onChange={(e) => setNewMaterialType(e.currentTarget.value)}
                            style={{
                              padding: '6px 10px',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius)',
                              fontSize: '13px',
                            }}
                          >
                            <option value="">选择类型</option>
                            <For each={MATERIAL_TYPES.application}>
                              {(t) => <option value={t}>{t}</option>}
                            </For>
                          </select>
                          <button
                            onClick={addMaterial}
                            style={{
                              background: 'var(--primary)',
                              color: '#fff',
                              padding: '6px 16px',
                              borderRadius: 'var(--radius)',
                              fontSize: '13px',
                            }}
                          >
                            添加
                          </button>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                          已添加待提交材料: {pendingByStage('application').length} 份
                        </div>
                      </div>
                    </Show>

                    <Show when={user()?.role === 'community_worker'}>
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
                    </Show>
                  </div>
                </Show>

                <Show when={a.status === 'pending_verify'}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>入户核实 - 核验材料</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-light)' }}>申请人:</span> {a.applicant_name}
                    </div>
                    <div style={{ fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-light)' }}>困难说明:</span> {a.difficulty_description}
                    </div>

                    <label style={{ fontSize: '13px', color: 'var(--text-light)', display: 'block' }}>
                      核实意见 <span style={{ color: 'var(--danger)' }}>*</span>
                      <textarea
                        value={opinion()}
                        onInput={(e) => setOpinion(e.currentTarget.value)}
                        rows={3}
                        placeholder="请填写入户核实意见..."
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

                    <Show when={requireOverdueReason('verify')}>
                      <label style={{ fontSize: '13px', color: 'var(--text-light)', display: 'block' }}>
                        逾期说明 <span style={{ color: 'var(--danger)' }}>*</span>
                        <textarea
                          value={overdueReason()}
                          onInput={(e) => setOverdueReason(e.currentTarget.value)}
                          rows={2}
                          placeholder="请填写逾期未及时核实的原因..."
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
                    </Show>

                    <Show when={canEditMaterials()}>
                      <div style={{ padding: '12px', background: '#f7fafc', borderRadius: 'var(--radius)' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>上传核验材料</h4>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input
                            placeholder="材料文件名 (如: 核验报告.pdf)"
                            value={newFileName()}
                            onInput={(e) => setNewFileName(e.currentTarget.value)}
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius)',
                              fontSize: '13px',
                            }}
                          />
                          <select
                            value={newMaterialType()}
                            onChange={(e) => setNewMaterialType(e.currentTarget.value)}
                            style={{
                              padding: '6px 10px',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius)',
                              fontSize: '13px',
                            }}
                          >
                            <option value="">选择类型</option>
                            <For each={MATERIAL_TYPES.verification}>
                              {(t) => <option value={t}>{t}</option>}
                            </For>
                          </select>
                          <button
                            onClick={addMaterial}
                            style={{
                              background: 'var(--primary)',
                              color: '#fff',
                              padding: '6px 16px',
                              borderRadius: 'var(--radius)',
                              fontSize: '13px',
                            }}
                          >
                            添加
                          </button>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                          已添加待提交材料: {pendingByStage('verification').length} 份
                        </div>
                      </div>
                    </Show>

                    <Show when={user()?.role === 'clerk'}>
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
                  </div>
                </Show>

                <Show when={a.status === 'pending_approve'}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>救助确认 - 审批材料</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-light)' }}>申请人:</span> {a.applicant_name}
                    </div>
                    <div style={{ fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-light)' }}>困难说明:</span> {a.difficulty_description}
                    </div>

                    <label style={{ fontSize: '13px', color: 'var(--text-light)', display: 'block' }}>
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

                    <label style={{ fontSize: '13px', color: 'var(--text-light)', display: 'block' }}>
                      审批意见 <span style={{ color: 'var(--danger)' }}>*</span>
                      <textarea
                        value={opinion()}
                        onInput={(e) => setOpinion(e.currentTarget.value)}
                        rows={3}
                        placeholder="请填写审批意见..."
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

                    <Show when={requireOverdueReason('approve')}>
                      <label style={{ fontSize: '13px', color: 'var(--text-light)', display: 'block' }}>
                        逾期说明 <span style={{ color: 'var(--danger)' }}>*</span>
                        <textarea
                          value={overdueReason()}
                          onInput={(e) => setOverdueReason(e.currentTarget.value)}
                          rows={2}
                          placeholder="请填写逾期未及时审批的原因..."
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
                    </Show>

                    <Show when={canEditMaterials()}>
                      <div style={{ padding: '12px', background: '#f7fafc', borderRadius: 'var(--radius)' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>上传审批材料</h4>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input
                            placeholder="材料文件名 (如: 审批意见.pdf)"
                            value={newFileName()}
                            onInput={(e) => setNewFileName(e.currentTarget.value)}
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius)',
                              fontSize: '13px',
                            }}
                          />
                          <select
                            value={newMaterialType()}
                            onChange={(e) => setNewMaterialType(e.currentTarget.value)}
                            style={{
                              padding: '6px 10px',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius)',
                              fontSize: '13px',
                            }}
                          >
                            <option value="">选择类型</option>
                            <For each={MATERIAL_TYPES.approval}>
                              {(t) => <option value={t}>{t}</option>}
                            </For>
                          </select>
                          <button
                            onClick={addMaterial}
                            style={{
                              background: 'var(--primary)',
                              color: '#fff',
                              padding: '6px 16px',
                              borderRadius: 'var(--radius)',
                              fontSize: '13px',
                            }}
                          >
                            添加
                          </button>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                          已添加待提交材料: {pendingByStage('approval').length} 份
                        </div>
                      </div>
                    </Show>

                    <Show when={user()?.role === 'leader'}>
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
                  </div>
                </Show>

                <Show when={
                  a.status === 'approved' || a.status === 'rejected'
                }>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>申请详情</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                    <div><span style={{ color: 'var(--text-light)' }}>身份证号:</span> {a.applicant_id_card}</div>
                    <div><span style={{ color: 'var(--text-light)' }}>困难说明:</span> {a.difficulty_description}</div>
                    <Show when={a.assistance_amount}>
                      <div><span style={{ color: 'var(--text-light)' }}>救助金额:</span> ¥{a.assistance_amount}</div>
                    </Show>
                    <Show when={a.opinion_text}>
                      <div><span style={{ color: 'var(--text-light)' }}>处理意见:</span> {a.opinion_text}</div>
                    </Show>
                    <Show when={a.overdue_reason}>
                      <div><span style={{ color: 'var(--text-light)' }}>逾期说明:</span> {a.overdue_reason}</div>
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
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-light)' }}>操作人</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-light)' }}>角色</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-light)' }}>动作</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-light)' }}>状态变更</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-light)' }}>时限检查</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-light)' }}>版本</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-light)' }}>意见</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-light)' }}>失败原因</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-light)' }}>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={a.audit_logs}>
                      {(entry) => {
                        const isFailure = !!entry.failure_reason;
                        return (
                          <tr style={{
                            borderBottom: '1px solid #f0f0f0',
                            background: isFailure ? '#fef2f2' : 'inherit',
                          }}>
                            <td style={{ padding: '8px 12px' }}>{entry.operator_name}</td>
                            <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-light)' }}>{entry.operator_role || '-'}</td>
                            <td style={{ padding: '8px 12px' }}>{ACTION_LABELS[entry.action] || entry.action}</td>
                            <td style={{ padding: '8px 12px' }}>{entry.from_status || '-'} → {entry.to_status || '-'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '12px' }}>
                              <span style={{
                                color: entry.deadline_check?.includes('overdue') ? 'var(--warning)' : 'var(--text-light)',
                              }}>
                                {entry.deadline_check || '-'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-light)' }}>
                              v{entry.client_version || 0}
                            </td>
                            <td style={{ padding: '8px 12px' }}>{entry.opinion || '-'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--danger)' }}>{entry.failure_reason || '-'}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-light)' }}>{fmtTime(entry.created_at)}</td>
                          </tr>
                        );
                      }}
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
