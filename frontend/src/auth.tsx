import { createContext, useContext, createSignal, ParentProps, Context } from 'solid-js';
import type { User } from './types';
import { api } from './api';

interface AuthContextType {
  user: () => User | null;
  setUser: (u: User | null) => void;
  doLogin: (username: string, password: string) => Promise<User>;
}

const AuthContext: Context<AuthContextType> = createContext<AuthContextType>({
  user: () => null,
  setUser: () => {},
  doLogin: async () => null as any,
});

export function AuthProvider(props: ParentProps) {
  const [user, setUser] = createSignal<User | null>(null);

  const doLogin = async (username: string, password: string): Promise<User> => {
    const data = await api.login(username, password);
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, doLogin }}>
      {props.children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
