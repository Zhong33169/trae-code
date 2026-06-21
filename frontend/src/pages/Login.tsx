import { createSignal, Show } from 'solid-js';
import { useAuth } from '../App';

export function LoginPage() {
  const { doLogin, isLoggedIn } = useAuth();
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await doLogin(username(), password());
    } catch (err: any) {
      setError(err?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { username: 'zhangsan', password: '123456', label: '登记员（张三）' },
    { username: 'lisi', password: '123456', label: '审核主管（李四）' },
    { username: 'wangwu', password: '123456', label: '复核负责人（王五）' },
  ];

  return (
    <div class="login-page">
      <div class="login-box">
        <h1>医疗事件管理系统</h1>
        <p>请选择岗位登录系统</p>
        <Show when={error()}>
          <div class="alert alert-error">{error()}</div>
        </Show>
        <form onSubmit={handleLogin}>
          <div class="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              placeholder="输入用户名"
            />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              placeholder="输入密码"
            />
          </div>
          <button
            type="submit"
            class="btn btn-primary"
            style="width: 100%; justify-content: center; padding: 10px;"
            disabled={loading()}
          >
            {loading() ? '登录中...' : '登录'}
          </button>
        </form>
        <div style="margin-top: 24px;">
          <p style="font-size: 13px; color: var(--gray-400); margin-bottom: 8px;">演示账号（点击快速登录）：</p>
          {demoAccounts.map((acc) => (
            <button
              class="btn btn-outline btn-sm"
              style="margin-right: 6px; margin-bottom: 6px;"
              onClick={async () => {
                setUsername(acc.username);
                setPassword(acc.password);
                setError('');
                setLoading(true);
                try {
                  await doLogin(acc.username, acc.password);
                } catch (err: any) {
                  setError(err?.error || '登录失败');
                } finally {
                  setLoading(false);
                }
              }}
            >
              {acc.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
