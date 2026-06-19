import React from "react";
import type { User, UserRole } from "../lib/types";
import { ROLE_LABEL } from "../lib/types";
import { Lock, User as UserIcon } from "lucide-react";

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

const DEMO_ACCOUNTS = [
  { username: "registrar", password: "123456", role: "registrar" as UserRole },
  { username: "reviewer", password: "123456", role: "reviewer" as UserRole },
  { username: "archiver", password: "123456", role: "archiver" as UserRole },
];

export default function LoginForm({ onLogin, loading, error }: LoginFormProps) {
  const [username, setUsername] = React.useState("registrar");
  const [password, setPassword] = React.useState("123456");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onLogin(username, password);
  };

  const quickLogin = async (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    await onLogin(u, p);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">菜品上新流程管理</h1>
          <p className="text-indigo-300 mt-2">三岗流水线 · 补录强校验 · 证据链完整</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
          <div className="mb-4">
            <label className="block text-sm font-medium text-indigo-200 mb-1.5">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="输入用户名"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-indigo-200 mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="输入密码"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-400/30 text-red-200 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <div className="mt-6">
          <p className="text-center text-indigo-300 text-sm mb-3">快速切换演示账号</p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.username}
                onClick={() => quickLogin(acc.username, acc.password)}
                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors"
              >
                <UserIcon className="w-5 h-5 text-indigo-300" />
                <span className="text-sm font-medium">{ROLE_LABEL[acc.role]}</span>
                <span className="text-xs text-indigo-400">{acc.username}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
