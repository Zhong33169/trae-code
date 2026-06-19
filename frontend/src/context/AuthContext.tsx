import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { message } from 'antd';
import { authApi } from '../api';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  switchUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const userId = localStorage.getItem('userId');
      const userInfoStr = localStorage.getItem('userInfo');

      if (userId && userInfoStr) {
        try {
          const cached = JSON.parse(userInfoStr) as User;
          setUser(cached);
          const freshUser = (await authApi.me()) as User;
          if (freshUser) {
            setUser(freshUser);
            localStorage.setItem('userInfo', JSON.stringify(freshUser));
          }
        } catch (e) {
          localStorage.removeItem('userId');
          localStorage.removeItem('userInfo');
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const loggedInUser = (await authApi.login({ username, password })) as User;
    localStorage.setItem('userId', loggedInUser.id);
    localStorage.setItem('userInfo', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userInfo');
    setUser(null);
    message.success('已退出登录');
  }, []);

  const switchUser = useCallback((targetUser: User) => {
    localStorage.setItem('userId', targetUser.id);
    localStorage.setItem('userInfo', JSON.stringify(targetUser));
    setUser(targetUser);
    message.success(`已切换到 ${targetUser.name}（${targetUser.role === 'FIELD_ADMIN' ? '田间管理员' : targetUser.role === 'TECHNICIAN' ? '农技员' : '合作社主任'}）`);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const freshUser = (await authApi.me()) as User;
      if (freshUser) {
        setUser(freshUser);
        localStorage.setItem('userInfo', JSON.stringify(freshUser));
      }
    } catch (e) {
      console.error('刷新用户信息失败', e);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        switchUser,
        refreshUser,
        isAuthenticated: !!user,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
