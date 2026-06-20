import { createSignal, onMount } from 'solid-js';
import { login, setCurrentUser, getUsers } from '../api';
import type { User } from '../types';
import { roleText } from '../types';

export default function LoginPage(props: { onLogin: () => void }) {
  const [users, setUsers] = createSignal<User[]>([]);
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('123456');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  onMount(async () => {
    const res = await getUsers();
    if (res.code === 200 && res.data) {
      setUsers(res.data);
    }
  });

  const handleLogin = async () => {
    if (!username() || !password()) {
      setError('请输入用户名和密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await login(username(), password());
      if (res.code === 200 && res.data) {
        setCurrentUser(res.data.user);
        props.onLogin();
      } else {
        setError(res.message || '登录失败');
      }
    } catch (e) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (user: User) => {
    setUsername(user.username);
    setPassword('123456');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        background: '#fff',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        padding: '40px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#262626', marginBottom: '8px' }}>
            仓储配送中心
          </h1>
          <p style={{ fontSize: '16px', color: '#8c8c8c' }}>
            移动补录校验库存调整单系统
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#595959', fontWeight: 500 }}>
            演示账号（点击快速登录）
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {users().map((user) => (
              <button
                key={user.id}
                onClick={() => quickLogin(user)}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  background: username() === user.username ? '#e6f7ff' : '#fff',
                  color: username() === user.username ? '#1890ff' : '#595959',
                  fontSize: '13px',
                  transition: 'all 0.2s',
                }}
              >
                {user.real_name}（{roleText[user.role]}）
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#595959', fontWeight: 500 }}>
            用户名
          </label>
          <input
            type="text"
            value={username()}
            onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
            placeholder="请输入用户名"
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1px solid #d9d9d9',
              borderRadius: '8px',
              fontSize: '14px',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#1890ff')}
            onBlur={(e) => (e.target.style.borderColor = '#d9d9d9')}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#595959', fontWeight: 500 }}>
            密码
          </label>
          <input
            type="password"
            value={password()}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            placeholder="请输入密码"
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1px solid #d9d9d9',
              borderRadius: '8px',
              fontSize: '14px',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#1890ff')}
            onBlur={(e) => (e.target.style.borderColor = '#d9d9d9')}
          />
        </div>

        {error() && (
          <div style={{
            padding: '12px',
            background: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: '8px',
            color: '#cf1322',
            marginBottom: '16px',
            fontSize: '13px',
          }}>
            {error()}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading()}
          style={{
            width: '100%',
            padding: '14px',
            background: '#1890ff',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 500,
            cursor: loading() ? 'not-allowed' : 'pointer',
            opacity: loading() ? 0.6 : 1,
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => { if (!loading()) (e.target as HTMLButtonElement).style.background = '#40a9ff'; }}
          onMouseOut={(e) => { if (!loading()) (e.target as HTMLButtonElement).style.background = '#1890ff'; }}
        >
          {loading() ? '登录中...' : '登 录'}
        </button>

        <div style={{ marginTop: '20px', textAlign: 'center', color: '#8c8c8c', fontSize: '12px' }}>
          默认密码：123456
        </div>
      </div>
    </div>
  );
}
