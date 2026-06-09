import { createContext, useContext, createSignal, ParentComponent, Accessor } from 'solid-js';
import { User, UserRole } from '../types';
import { api } from '../services/api';

interface UserContextType {
  currentUser: Accessor<User | null>;
  users: Accessor<User[]>;
  setCurrentUser: (user: User) => void;
  loadUsers: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
}

const UserContext = createContext<UserContextType>();

export const UserProvider: ParentComponent = (props) => {
  const [currentUser, setCurrentUser] = createSignal<User | null>(null);
  const [users, setUsers] = createSignal<User[]>([]);

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
      if (data.length > 0 && !currentUser()) {
        setCurrentUser(data[0]);
      }
    } catch (e) {
      console.error('加载用户失败', e);
    }
  };

  const hasRole = (role: UserRole) => {
    return currentUser()?.role === role;
  };

  return (
    <UserContext.Provider
      value={{
        currentUser,
        users,
        setCurrentUser,
        loadUsers,
        hasRole,
      }}
    >
      {props.children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
};
