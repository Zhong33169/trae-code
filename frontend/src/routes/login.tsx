import { createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { login } from '../api/auth';
import { useUser } from '../app';

const DEMO = [
  { role: '传播计划登记员', user: 'register1', name: '王登记' },
  { role: '传播计划登记员', user: 'register2', name: '李补正' },
  { role: '传播计划审核主管', user: 'audit1', name: '张审核' },
  { role: '传播计划审核主管', user: 'audit2', name: '赵主管' },
  { role: '公关传播团队复核负责人', user: 'review1', name: '陈复核' },
];

export default function LoginPage() {
  const [username, setUsername] = createSignal('register1');
  const [password, setPassword] = createSignal('123456');
  const [loading, setLoading] = createSignal(false);
  const [err, setErr] = createSignal('');
  const nav = useNavigate();
  const { setUser, notify } = useUser();

  const submit = async (e: Event) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    const r = await login(username().trim(), password());
    setLoading(false);
    if (r.code === 0) {
      setUser(r.data.user);
      notify('登录成功，欢迎回来：' + r.data.user.realName, 'success');
      nav('/plans');
    } else {
      setErr(r.message);
      notify(r.message || '登录失败', 'error');
    }
  };

  const oneClick = (u: string) => { setUsername(u); };

  return (
    <div class="login-wrap">
      <form class="login-card" onSubmit={submit}>
        <div class="login-title">📣 公关传播计划管理</div>
        <div class="login-sub">跨班组协同 · 流程闭环 · 数据一致</div>
        <div class="form-item">
          <label>账号</label>
          <input value={username()} onInput={(e) => setUsername(e.currentTarget.value)} placeholder="请输入账号" />
        </div>
        <div class="form-item">
          <label>密码</label>
          <input type="password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} placeholder="请输入密码" />
        </div>
        {err() && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{err()}</div>}
        <button class="btn btn-primary btn-block" disabled={loading()} type="submit">
          {loading() ? '登录中…' : '登录'}
        </button>
        <div style={{ marginTop: 18, fontSize: 13, color: '#374151', fontWeight: 500 }}>演示账号（密码均为 123456）</div>
        <div class="acc-list">
          {DEMO.map((d) => (
            <div class="acc-card" onClick={() => oneClick(d.user)} style={{ cursor: 'pointer' }}>
              <div><b>{d.user}</b></div>
              <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>{d.name} · {d.role}</div>
            </div>
          ))}
        </div>
      </form>
    </div>
  );
}
