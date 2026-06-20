'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, setAuthToken, setCurrentUser } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('cs1');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accounts = [
    { u: 'admin', n: '张经理', r: '服务经理' },
    { u: 'dispatcher1', n: '李调度', r: '调度专员(白班)' },
    { u: 'dispatcher2', n: '王调度', r: '调度专员(中班)' },
    { u: 'cs1', n: '赵客服', r: '客服专员(白班)' },
    { u: 'cs2', n: '孙客服', r: '客服专员(中班)' },
    { u: 'tech1', n: '钱师傅', r: '维修师傅(白班)' },
    { u: 'tech2', n: '周师傅', r: '维修师傅(中班)' },
    { u: 'tech3', n: '吴师傅', r: '维修师傅(夜班)' },
  ];

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const r = await apiFetch<any>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (!r.ok) { setError(r.error || '登录失败'); return; }
    setAuthToken(r.data.token);
    setCurrentUser(r.data.user);
    router.replace('/quotes');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50">
      <div className="w-full max-w-5xl grid grid-cols-2 gap-0 card overflow-hidden" style={{boxShadow: '0 10px 40px rgba(37,99,235,0.15)'}}>
        <div className="p-10 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
          <div className="text-4xl mb-2">🔧</div>
          <h1 className="text-2xl font-bold mb-1">维修服务平台</h1>
          <div className="text-blue-100 text-sm mb-8">跨班组交接确认维修报价单系统</div>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <span>📋</span>
              <div>
                <div className="font-semibold">全流程状态管控</div>
                <div className="text-blue-100 text-xs">登记→报价→确认→支付→维修→归档，后端驱动状态流转</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span>🔁</span>
              <div>
                <div className="font-semibold">跨班组交接可追溯</div>
                <div className="text-blue-100 text-xs">谁交出、谁接收、哪个班次，完整记录确认过程</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span>🛡️</span>
              <div>
                <div className="font-semibold">权限边界清晰</div>
                <div className="text-blue-100 text-xs">客服不能替调度、调度不能替经理归档，后端严格校验</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span>📊</span>
              <div>
                <div className="font-semibold">数据一致性保证</div>
                <div className="text-blue-100 text-xs">列表、详情、统计、操作记录均以后端数据库为准</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-10">
          <h2 className="text-xl font-bold mb-1">账号登录</h2>
          <p className="text-gray-500 text-sm mb-6">密码统一为 <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">123456</code></p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={login} className="space-y-4">
            <div>
              <label className="label">账号</label>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="请输入账号" />
            </div>
            <div>
              <label className="label">密码</label>
              <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码" />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center py-2">
              {loading ? '登录中...' : '登 录'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-2">快速切换角色：点击下方账号填充</div>
            <div className="grid grid-cols-2 gap-1.5">
              {accounts.map(a => (
                <button key={a.u} type="button"
                  onClick={() => { setUsername(a.u); setPassword('123456'); }}
                  className="text-left text-xs px-2 py-1.5 rounded hover:bg-blue-50 border border-gray-100 transition-colors">
                  <div className="font-medium text-gray-800">{a.n}</div>
                  <div className="text-gray-500">{a.r}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
