'use client';

import React, { useEffect, useState } from 'react';
import { User } from '@/lib/types';
import { fetchUsers } from '@/lib/api';
import { UserProvider } from '@/lib/user-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ROLE_LABELS: Record<string, string> = {
  clerk: '登记员',
  supervisor: '审核主管',
  rechecker: '复核负责人',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    fetchUsers().then((data) => {
      setUsers(data);
      const stored = localStorage.getItem('selectedUserId');
      if (stored) {
        const found = data.find((u) => u.id === Number(stored));
        if (found) setUser(found);
      }
    }).catch(() => {});
  }, []);

  const handleSelectUser = (u: User) => {
    setUser(u);
    localStorage.setItem('selectedUserId', String(u.id));
    setShowDropdown(false);
  };

  const navLinks = [
    { href: '/', label: '首页' },
    { href: '/orders', label: '工单列表' },
    { href: '/orders/new', label: '新建工单' },
  ];

  return (
    <html lang="zh-CN">
      <head>
        <title>产业园物业-异常申诉复核企业报修单系统</title>
      </head>
      <body>
        <UserProvider value={{ user, setUser, users }}>
          <header className="bg-slate-800 text-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-8">
                  <Link href="/" className="text-lg font-bold tracking-wide">
                    产业园物业-报修单系统
                  </Link>
                  <nav className="hidden sm:flex space-x-1">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          pathname === link.href
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm bg-slate-700 hover:bg-slate-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>{user ? `${user.name} (${ROLE_LABELS[user.role] || user.role})` : '选择用户'}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showDropdown && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
                      <div className="py-1">
                        {users.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => handleSelectUser(u)}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between ${
                              user?.id === u.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                            }`}
                          >
                            <span>{u.name}</span>
                            <span className="text-xs text-slate-500">{ROLE_LABELS[u.role] || u.role}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <nav className="sm:hidden flex space-x-1 pb-2 -mt-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      pathname === link.href
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
        </UserProvider>
      </body>
    </html>
  );
}
