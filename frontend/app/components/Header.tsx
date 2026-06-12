'use client';

import { useState, useEffect } from 'react';
import { User } from '../types';
import { getUsers, switchUser, getCurrentUser } from '../lib/api';

export default function Header() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const [usersRes, currentRes] = await Promise.all([getUsers(), getCurrentUser()]);
      if (usersRes.success) {
        setUsers(usersRes.data);
      }
      if (currentRes.success) {
        setCurrentUser(currentRes.data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSwitchUser(userId: string) {
    try {
      const res = await switchUser(userId);
      if (res.success) {
        setCurrentUser(res.data);
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to switch user:', err);
    }
  }

  return (
    <header className="header">
      <div className="container header-content">
        <h1>B2B批发平台 - 商家入驻单系统</h1>
        <div className="user-info">
          {currentUser && (
            <>
              <span className="user-role">
                {currentUser.name} · {currentUser.roleLabel}
              </span>
            </>
          )}
          <div className="user-switcher">
            <select
              value={currentUser?.id || ''}
              onChange={(e) => handleSwitchUser(e.target.value)}
              disabled={loading}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  切换到：{user.name}（{user.roleLabel}）
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}
