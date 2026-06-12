import { createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { setUser, setToken } from '../stores/auth';
import { apiFetch } from '../utils/api';

const ROLES = [
  {
    role: 'community_worker',
    label: '社区专干',
    icon: '🏠',
    username: 'zhangwei',
    password: '123456',
    display_name: '张伟(社区专干)',
    desc: '负责困难家庭帮扶申请的创建与材料提交',
  },
  {
    role: 'clerk',
    label: '街道科员',
    icon: '🏛️',
    username: 'lina',
    password: '123456',
    display_name: '李娜(街道科员)',
    desc: '负责入户核实与情况调查',
  },
  {
    role: 'leader',
    label: '分管领导',
    icon: '👔',
    username: 'wangqiang',
    password: '123456',
    display_name: '王强(分管领导)',
    desc: '负责救助方案复核与审批确认',
  },
];

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleLogin = async (username: string, password: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.detail || err.message || '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a365d 0%, #2a4a7f 50%, #1a365d 100%)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '800px',
        padding: '0 24px',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '40px',
          color: '#fff',
        }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
            街道办事处
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.8 }}>
            现场扫码核验帮扶申请系统
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
        }}>
          {ROLES.map(r => (
            <button
              onClick={() => handleLogin(r.username, r.password)}
              disabled={loading()}
              style={{
                background: 'var(--white)',
                borderRadius: 'var(--radius)',
                padding: '32px 24px',
                textAlign: 'center',
                boxShadow: 'var(--shadow-md)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: loading() ? 'not-allowed' : 'pointer',
                opacity: loading() ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading()) {
                  e.currentTarget.style.transform = 'scale(1.03)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>{r.icon}</div>
              <div style={{
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--primary)',
                marginBottom: '8px',
              }}>
                {r.label}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-light)',
                marginBottom: '12px',
                lineHeight: '1.5',
              }}>
                {r.desc}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-light)',
                background: '#f7fafc',
                padding: '4px 12px',
                borderRadius: '4px',
              }}>
                演示账号: {r.username}
              </div>
            </button>
          ))}
        </div>

        {error() && (
          <div style={{
            marginTop: '20px',
            textAlign: 'center',
            color: 'var(--danger)',
            background: 'rgba(255,255,255,0.9)',
            padding: '10px',
            borderRadius: 'var(--radius)',
            fontSize: '14px',
          }}>
            {error()}
          </div>
        )}
      </div>
    </div>
  );
}
