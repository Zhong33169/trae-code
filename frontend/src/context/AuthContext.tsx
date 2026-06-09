import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, ROLE_NAMES } from '../types';
import { api } from '../api';

interface AuthContextType {
  currentUser: User | null;
  currentRole: string;
  currentUsername: string;
  users: User[];
  roles: Record<string, { name: string; allowed_statuses: string[] }>;
  switchRole: (role: string, username: string) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Record<string, { name: string; allowed_statuses: string[] }>>({});
  const [currentRole, setCurrentRole] = useState<string>(() => {
    return localStorage.getItem('current_role') || 'triage_nurse';
  });
  const [currentUsername, setCurrentUsername] = useState<string>(() => {
    return localStorage.getItem('current_username') || 'nurse1';
  });

  const switchRole = (role: string, username: string) => {
    setCurrentRole(role);
    setCurrentUsername(username);
    localStorage.setItem('current_role', role);
    localStorage.setItem('current_username', username);
  };

  const refreshUser = async () => {
    try {
      const user = await api.getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      console.error('获取当前用户失败:', err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [userList, roleList] = await Promise.all([
          api.getUsers(),
          api.getRoles(),
        ]);
        setUsers(userList);
        setRoles(roleList);
        await refreshUser();
      } catch (err) {
        console.error('加载用户数据失败:', err);
      }
    };
    loadData();
  }, [currentRole, currentUsername]);

  useEffect(() => {
    refreshUser();
  }, [currentRole, currentUsername]);

  return (
    <AuthContext.Provider value={{
      currentUser,
      currentRole,
      currentUsername,
      users,
      roles,
      switchRole,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
