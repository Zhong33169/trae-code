'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { clearAuthToken, getCurrentUser, apiFetch } from '@/lib/api';

interface UserInfo { id: number; username: string; real_name: string; role: string; shift: string; }

const ROLE_NAMES: Record<string, string> = {
  service_manager: '服务经理',
  dispatcher: '调度专员',
  customer_service: '客服专员',
  technician: '维修师傅',
};

const SHIFT_NAMES: Record<string, string> = {
  morning: '白班',
  afternoon: '中班',
  night: '夜班',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) { router.replace('/login'); return; }
    setUser(u);
    apiFetch('/api/handovers/mine?status=pending').then(r => {
      if (r.ok) {
        const mine = (r.data.handovers || []).filter((h: any) => h.is_incoming);
        setPending(mine.length);
      }
    });
  }, [router]);

  if (!user) return <div className="p-10 text-center text-gray-500">加载中...</div>;

  const navs = [
    { key: 'quotes', label: '维修报价单列表', href: '/quotes', icon: '📋' },
    { key: 'handovers', label: '换班交接中心', href: '/handovers', icon: '🔁', badge: pending },
    { key: 'statistics', label: '统计分析', href: '/statistics', icon: '📊' },
  ];

  const logout = () => {
    clearAuthToken();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-slate-900 text-white flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <div className="text-base font-bold">🔧 维修服务平台</div>
          <div className="text-xs text-slate-400 mt-1">跨班组交接确认系统</div>
        </div>
        <nav className="p-3 space-y-1 flex-1">
          {navs.map(n => (
            <Link href={n.href} key={n.key}
              className={'sidebar-item ' + (pathname?.startsWith(n.href) ? 'active' : '')}>
              <span>{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {n.badge ? <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{n.badge}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-700 text-xs text-slate-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold">
              {user.real_name[0]}
            </div>
            <div>
              <div className="font-semibold text-slate-100">{user.real_name}</div>
              <div className="text-slate-400">{ROLE_NAMES[user.role] || user.role} · {SHIFT_NAMES[user.shift] || user.shift}</div>
            </div>
          </div>
          <button onClick={logout} className="w-full btn btn-secondary text-center justify-center py-1.5">退出登录</button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-[1600px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
