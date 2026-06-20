import { component$, useStore } from "@builder.io/qwik";
import { type DocumentHead, useNavigate, routeLoader$ } from "@builder.io/qwik-city";
import { doLogin } from "~/store/auth";

export const useCheckAuth = routeLoader$(async ({ request, redirect }) => {
  const cookie = request.headers.get('cookie') || '';
  const hasToken = cookie.includes('token=') || cookie.includes('session');
  return { isServer: true, hasToken };
});

export default component$(() => {
  const nav = useNavigate();
  const form = useStore({
    username: '',
    password: '',
    error: '',
    submitting: false,
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      form.error = '请输入用户名和密码';
      return;
    }
    form.submitting = true;
    form.error = '';
    const result = await doLogin(form.username, form.password);
    form.submitting = false;
    if (result.success) {
      window.location.href = '/booking';
    } else {
      form.error = result.message;
    }
  };

  return (
    <div class="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <div class="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div class="text-center mb-8">
            <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">订舱管理系统</h1>
            <p class="text-gray-500 text-sm">请登录以访问系统</p>
          </div>

          {form.error && (
            <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start">
              <svg class="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{form.error}</span>
            </div>
          )}

          <form onSubmit$={handleSubmit} class="space-y-5">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">用户名</label>
              <input
                type="text"
                value={form.username}
                onInput$={(e) => (form.username = (e.target as HTMLInputElement).value)}
                placeholder="请输入用户名"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white"
                disabled={form.submitting}
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">密码</label>
              <input
                type="password"
                value={form.password}
                onInput$={(e) => (form.password = (e.target as HTMLInputElement).value)}
                placeholder="请输入密码"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white"
                disabled={form.submitting}
              />
            </div>
            <button
              type="submit"
              disabled={form.submitting}
              class="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
            >
              {form.submitting ? '登录中...' : '登 录'}
            </button>
          </form>

          <div class="mt-8 pt-6 border-t border-gray-100">
            <p class="text-xs text-gray-500 mb-3 text-center">演示账号</p>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick$={() => { form.username = 'registrar'; form.password = '123456'; }}
                class="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 border border-gray-100 transition-colors"
              >
                <div class="font-medium">订舱登记员</div>
                <div class="text-gray-400">registrar / 123456</div>
              </button>
              <button
                type="button"
                onClick$={() => { form.username = 'supervisor'; form.password = '123456'; }}
                class="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 border border-gray-100 transition-colors"
              >
                <div class="font-medium">订舱审核主管</div>
                <div class="text-gray-400">supervisor / 123456</div>
              </button>
              <button
                type="button"
                onClick$={() => { form.username = 'reviewer'; form.password = '123456'; }}
                class="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 border border-gray-100 transition-colors"
              >
                <div class="font-medium">复核负责人</div>
                <div class="text-gray-400">reviewer / 123456</div>
              </button>
              <button
                type="button"
                onClick$={() => { form.username = 'admin'; form.password = 'admin123'; }}
                class="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 border border-gray-100 transition-colors"
              >
                <div class="font-medium">管理员</div>
                <div class="text-gray-400">admin / admin123</div>
              </button>
            </div>
          </div>
        </div>

        <p class="text-center text-gray-400 text-xs mt-6">
          © 2025 订舱管理系统 · 所有数据仅用于演示
        </p>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "登录 - 订舱管理系统",
};
