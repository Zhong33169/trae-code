import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '../types';
import * as api from '../api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.getCurrentUser()
        .then((u) => setUser(u))
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string) => {
    const result = await api.login(username);
    localStorage.setItem('token', result.token);
    setUser(result.user);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
