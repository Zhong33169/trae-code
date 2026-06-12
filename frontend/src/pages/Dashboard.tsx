import { createSignal, onMount, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { apiFetch } from '../utils/api';
import { user } from '../stores/auth';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';

const DIFFICULTY_LABELS: Record<string, string> = {
  medical: '医疗困难',
  disaster: '灾害',
  disability: '残疾',
  low_income: '低收入',
  other: '其他',
};

interface Stats {
  pending_count: number;
  done_count: number;
  overdue_count: number;
  today_scan_count: number;
}

interface PendingItem {
  id: number;
  application_no: string;
  applicant_name: string;
  difficulty_type: string;
  status: string;
  deadline: string | null;
}

function pendingStatusForRole(role: string): string {
  if (role === 'community_worker') return 'draft';
  if (role === 'clerk') return 'pending_verify';
  if (role === 'leader') return 'pending_approve';
  return '';
}

const PENDING_LABEL: Record<string, string> = {
  community_worker: '待建单',
  clerk: '待核实',
  leader: '待复核',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = createSignal<Stats>({
    pending_count: 0,
    done_count: 0,
    overdue_count: 0,
    today_scan_count: 0,
  });
  const [pendingList, setPendingList] = createSignal<PendingItem[]>([]);

  onMount(async () => {
    try {
      const status = pendingStatusForRole(user()?.role || '');
      const [s, p] = await Promise.all([
        apiFetch('/api/stats/summary'),
        apiFetch(status ? `/api/applications?status=${status}` : '/api/applications'),
      ]);
      setStats(s);
      setPendingList(Array.isArray(p) ? p.slice(0, 5) : []);
    } catch {}
  });

  const formatDeadline = (dl: string | null) => {
    if (!dl) return '';
    const diff = new Date(dl).getTime() - Date.now();
    const hours = Math.floor(diff / 3600000);
    if (hours < 0) return `逾期 ${Math.abs(hours)} 小时`;
    if (hours < 24) return `剩余 ${hours} 小时`;
    return `剩余 ${Math.floor(hours / 24)} 天`;
  };

  const deadlineColor = (dl: string | null) => {
    if (!dl) return 'var(--text-light)';
    const diff = new Date(dl).getTime() - Date.now();
    if (diff < 0) return 'var(--danger)';
    if (diff < 86400000) return 'var(--warning)';
    return 'var(--text-light)';
  };

  const pendingLabel = () => PENDING_LABEL[user()?.role || ''] || '待办';

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>工作台</h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '28px',
      }}>
        <StatCard label={`${pendingLabel()}数`} value={stats().pending_count} color="var(--warning)" icon="📋" />
        <StatCard label="已办数" value={stats().done_count} color="var(--success)" icon="✅" />
        <StatCard label="逾期数" value={stats().overdue_count} color="var(--danger)" icon="⚠️" />
        <StatCard label="今日扫码" value={stats().today_scan_count} color="var(--primary)" icon="📷" />
      </div>

      <div style={{
        background: 'var(--white)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow)',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '15px', fontWeight: 600 }}>{pendingLabel()}预览</span>
          <button
            onClick={() => navigate('/queue')}
            style={{
              background: 'none',
              color: 'var(--primary)',
              fontSize: '13px',
              padding: '4px 0',
            }}
          >
            查看全部 →
          </button>
        </div>
        <div>
          <For each={pendingList()} fallback={
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>
              暂无待办事项
            </div>
          }>
            {(item) => (
              <div
                onClick={() => navigate(`/application/${item.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f7fafc'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-light)', width: '120px' }}>
                    {item.application_no}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 500, width: '80px' }}>
                    {item.applicant_name}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                    {DIFFICULTY_LABELS[item.difficulty_type] || item.difficulty_type}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '12px', color: deadlineColor(item.deadline) }}>
                    {formatDeadline(item.deadline)}
                  </span>
                  <StatusBadge status={item.status} />
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
