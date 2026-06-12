import { createSignal, onMount, For, Show } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { user } from '../stores/auth';
import { apiFetch } from '../utils/api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

const TABS = [
  { key: 'draft', label: '待建单' },
  { key: 'pending_verify', label: '待核实' },
  { key: 'pending_approve', label: '待复核' },
  { key: 'completed', label: '已完结' },
];

const DEFAULT_TAB: Record<string, string> = {
  community_worker: 'draft',
  clerk: 'pending_verify',
  leader: 'pending_approve',
};

const DIFFICULTY_TYPES = [
  { value: 'medical', label: '医疗困难' },
  { value: 'disaster', label: '灾害' },
  { value: 'disability', label: '残疾' },
  { value: 'low_income', label: '低收入' },
  { value: 'other', label: '其他' },
];

const DIFFICULTY_LABELS: Record<string, string> = {
  medical: '医疗困难',
  disaster: '灾害',
  disability: '残疾',
  low_income: '低收入',
  other: '其他',
};

interface AppItem {
  id: number;
  application_no: string;
  applicant_name: string;
  difficulty_type: string;
  status: string;
  deadline: string | null;
  version: number;
}

export default function Queue() {
  const navigate = useNavigate();
  const params = useParams();
  const [activeTab, setActiveTab] = createSignal(
    params.tab || DEFAULT_TAB[user()?.role] || 'draft'
  );
  const [items, setItems] = createSignal<AppItem[]>([]);
  const [showCreate, setShowCreate] = createSignal(false);

  const [form, setForm] = createSignal({
    applicant_name: '',
    applicant_id_card: '',
    difficulty_type: '',
    difficulty_description: '',
    assistance_amount: '',
  });

  const fetchData = async () => {
    try {
      let statusParam = activeTab();
      if (statusParam === 'completed') {
        statusParam = 'approved';
      }
      const data = await apiFetch(`/api/applications?status=${statusParam}`);
      const list = Array.isArray(data) ? data : [];
      if (activeTab() === 'completed') {
        const rejected = await apiFetch('/api/applications?status=rejected');
        const rejectedList = Array.isArray(rejected) ? rejected : [];
        setItems([...list, ...rejectedList]);
      } else {
        setItems(list);
      }
    } catch {}
  };

  onMount(fetchData);

  const changeTab = (key: string) => {
    setActiveTab(key);
    fetchData();
  };

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

  const handleCreate = async () => {
    try {
      await apiFetch('/api/applications', {
        method: 'POST',
        body: JSON.stringify({
          applicant_name: form().applicant_name,
          applicant_id_card: form().applicant_id_card,
          difficulty_type: form().difficulty_type,
          difficulty_description: form().difficulty_description,
          assistance_amount: form().assistance_amount,
        }),
      });
      setShowCreate(false);
      setActiveTab('draft');
      setForm({
        applicant_name: '',
        applicant_id_card: '',
        difficulty_type: '',
        difficulty_description: '',
        assistance_amount: '',
      });
      fetchData();
    } catch {}
  };

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600 }}>待办队列</h2>
        <Show when={user()?.role === 'community_worker'}>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              background: 'var(--primary)',
              color: '#fff',
              padding: '8px 20px',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
            }}
          >
            + 新建申请
          </button>
        </Show>
      </div>

      <div style={{
        display: 'flex',
        gap: '0',
        borderBottom: '2px solid var(--border)',
        marginBottom: '20px',
      }}>
        <For each={TABS}>
          {(tab) => (
            <button
              onClick={() => changeTab(tab.key)}
              style={{
                padding: '10px 24px',
                background: 'none',
                fontSize: '14px',
                fontWeight: activeTab() === tab.key ? 600 : 400,
                color: activeTab() === tab.key ? 'var(--primary)' : 'var(--text-light)',
                borderBottom: activeTab() === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: '-2px',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          )}
        </For>
      </div>

      <div style={{
        background: 'var(--white)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow)',
      }}>
        <For each={items()} fallback={
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>
            暂无数据
          </div>
        }>
          {(item) => (
            <div
              onClick={() => navigate(`/application/${item.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f7fafc'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-light)', width: '130px' }}>
                  {item.application_no}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 500, width: '80px' }}>
                  {item.applicant_name}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-light)', width: '100px' }}>
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

      <Modal open={showCreate()} title="新建帮扶申请" onClose={() => setShowCreate(false)} width="560px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-light)' }}>
            申请人姓名
            <input
              value={form().applicant_name}
              onInput={(e) => setForm({ ...form(), applicant_name: e.currentTarget.value })}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                marginTop: '4px',
                fontSize: '14px',
              }}
            />
          </label>
          <label style={{ fontSize: '13px', color: 'var(--text-light)' }}>
            身份证号
            <input
              value={form().applicant_id_card}
              onInput={(e) => setForm({ ...form(), applicant_id_card: e.currentTarget.value })}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                marginTop: '4px',
                fontSize: '14px',
              }}
            />
          </label>
          <label style={{ fontSize: '13px', color: 'var(--text-light)' }}>
            困难类型
            <select
              value={form().difficulty_type}
              onChange={(e) => setForm({ ...form(), difficulty_type: e.currentTarget.value })}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                marginTop: '4px',
                fontSize: '14px',
              }}
            >
              <option value="">请选择</option>
              <For each={DIFFICULTY_TYPES}>
                {(dt) => <option value={dt.value}>{dt.label}</option>}
              </For>
            </select>
          </label>
          <label style={{ fontSize: '13px', color: 'var(--text-light)' }}>
            困难情况说明
            <textarea
              value={form().difficulty_description}
              onInput={(e) => setForm({ ...form(), difficulty_description: e.currentTarget.value })}
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
          <label style={{ fontSize: '13px', color: 'var(--text-light)' }}>
            救助金额 (元)
            <input
              type="number"
              value={form().assistance_amount}
              onInput={(e) => setForm({ ...form(), assistance_amount: e.currentTarget.value })}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                marginTop: '4px',
                fontSize: '14px',
              }}
            />
          </label>
          <button
            onClick={handleCreate}
            style={{
              background: 'var(--primary)',
              color: '#fff',
              padding: '10px',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
              marginTop: '8px',
            }}
          >
            提交申请
          </button>
        </div>
      </Modal>
    </div>
  );
}
