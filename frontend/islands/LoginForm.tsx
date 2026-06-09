import { useState } from "preact/hooks";
import { login } from "../utils/api.ts";
import { setToken, setUser } from "../utils/auth.ts";
import { ROLE_MAP } from "../utils/types.ts";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!username || !password) {
      setError("请输入用户名和密码");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await login(username, password);
      setToken(result.token);
      setUser(result.user);
      window.location.href = "/";
    } catch (err: any) {
      setError(err.error || "登录失败，请检查用户名和密码");
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { username: "reception", password: "123456", role: "接诊助理" },
    { username: "physician", password: "123456", role: "坐诊医师" },
    { username: "pharmacy", password: "123456", role: "药房管理员" },
  ];

  const quickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="text-6xl mb-4">💊</div>
          <h2 className="mt-2 text-3xl font-extrabold text-gray-900">
            处方流转单系统
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            请登录您的账号以继续
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-xl rounded-xl border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                用户名
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
                className="appearance-none relative block w-full px-4 py-3 border border-gray-300 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-colors"
                placeholder="请输入用户名"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                className="appearance-none relative block w-full px-4 py-3 border border-gray-300 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-colors"
                placeholder="请输入密码"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "登录中..." : "登录"}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">演示账号</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.username}
                  onClick={() => quickLogin(acc.username, acc.password)}
                  className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  <span className="text-gray-700 font-medium">{acc.username}</span>
                  <span className="text-gray-500 text-xs bg-gray-100 px-2 py-1 rounded">
                    {acc.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500">
          © 2024 处方流转单系统 · 安全可靠
        </p>
      </div>
    </div>
  );
}
