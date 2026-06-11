import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { FileText, User, Lock, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isAuthenticated, loading, error } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/';

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch {
      // Error is handled in store
    }
  };

  const quickLogin = (role: string) => {
    const accounts: Record<string, { username: string; password: string }> = {
      registrar: { username: 'registrar1', password: '123456' },
      auditor: { username: 'auditor1', password: '123456' },
      reviewer: { username: 'reviewer1', password: '123456' },
    };
    const acc = accounts[role];
    if (acc) {
      setUsername(acc.username);
      setPassword(acc.password);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-8 text-center">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">软件外包项目组</h1>
            <p className="text-blue-100 text-sm mt-1">风险分级处置需求交付单系统</p>
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  账号
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="请输入账号"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="请输入密码"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading.login}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading.login ? '登录中...' : '登录'}
              </button>
            </form>

            <div className="mt-6">
              <p className="text-xs text-slate-500 mb-3 text-center">快速体验登录</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => quickLogin('registrar')}
                  className="px-2 py-2 text-xs bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  登记员
                </button>
                <button
                  onClick={() => quickLogin('auditor')}
                  className="px-2 py-2 text-xs bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  审核主管
                </button>
                <button
                  onClick={() => quickLogin('reviewer')}
                  className="px-2 py-2 text-xs bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  复核负责人
                </button>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          © 2026 软件外包项目组 · 风险分级处置系统
        </p>
      </div>
    </div>
  );
}
