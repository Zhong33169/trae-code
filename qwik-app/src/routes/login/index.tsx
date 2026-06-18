import { component$, useSignal, $ } from '@builder.io/qwik';
import { useNavigate } from '@builder.io/qwik-city';
import { login, setAuth } from '~/utils/api';
import { roleLabels } from '~/utils/api';

interface DemoAccount {
  username: string;
  password: string;
  role: string;
  name: string;
}

const demoAccounts: DemoAccount[] = [
  { username: 'registrar1', password: '123456', role: 'registrar', name: '张登记' },
  { username: 'registrar2', password: '123456', role: 'registrar', name: '李登记' },
  { username: 'auditor1', password: '123456', role: 'audit_supervisor', name: '王审核' },
  { username: 'auditor2', password: '123456', role: 'audit_supervisor', name: '赵审核' },
  { username: 'reviewer1', password: '123456', role: 'review_leader', name: '陈复核' },
];

export default component$(() => {
  const nav = useNavigate();
  const username = useSignal('');
  const password = useSignal('');
  const loading = useSignal(false);
  const error = useSignal('');

  const handleSubmit = $(async () => {
    if (!username.value.trim() || !password.value.trim()) {
      error.value = '请输入用户名和密码';
      return;
    }

    loading.value = true;
    error.value = '';

    try {
      const result = await login(username.value.trim(), password.value.trim());
      setAuth(result);
      nav('/applications');
    } catch (e: any) {
      error.value = e.message || '登录失败';
    } finally {
      loading.value = false;
    }
  });

  const handleDemoLogin = $(async (account: DemoAccount) => {
    loading.value = true;
    error.value = '';
    try {
      const result = await login(account.username, account.password);
      setAuth(result);
      nav('/applications');
    } catch (e: any) {
      error.value = e.message || '登录失败';
    } finally {
      loading.value = false;
    }
  });

  return (
    <div class="login-page">
      <div class="login-card">
        <h1 class="login-title">展商申请管理系统</h1>
        <p class="login-subtitle">展会主办方展商审批管理平台</p>

        {error.value && <div class="alert alert-error" style={{ marginBottom: '16px' }}>{error.value}</div>}

        <div class="form-item">
          <label class="form-label">用户名</label>
          <input
            class="form-input"
            type="text"
            placeholder="请输入用户名"
            value={username.value}
            onInput$={(e) => (username.value = (e.target as HTMLInputElement).value)}
            onKeyDown$={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
          />
        </div>

        <div class="form-item">
          <label class="form-label">密码</label>
          <input
            class="form-input"
            type="password"
            placeholder="请输入密码"
            value={password.value}
            onInput$={(e) => (password.value = (e.target as HTMLInputElement).value)}
            onKeyDown$={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
          />
        </div>

        <button
          class="btn btn-primary btn-block"
          disabled={loading.value}
          onClick$={handleSubmit}
        >
          {loading.value ? '登录中...' : '登录'}
        </button>

        <div class="demo-accounts">
          <div class="demo-title">演示账号（点击快速登录）</div>
          <div class="demo-btns">
            {demoAccounts.map((acc) => (
              <div
                key={acc.username}
                class="demo-btn"
                onClick$={() => handleDemoLogin(acc)}
              >
                {acc.name}
                <small>{roleLabels[acc.role]}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export const head = {
  title: '登录 - 展商申请管理系统',
};
