'use client';

import React, { createContext, useContext } from 'react';
import { User } from '@/lib/types';

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  users: User[];
}

const UserContext = createContext<UserContextType>({ user: null, setUser: () => {}, users: [] });

export function UserProvider({ children, value }: { children: React.ReactNode; value: UserContextType }) {
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(UserContext);
}
