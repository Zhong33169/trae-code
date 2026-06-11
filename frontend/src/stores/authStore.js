import { createSignal, createEffect } from 'solid-js';
import { getCurrentUserId, setCurrentUser } from '../api/expenseApi';

const [userId, setUserId] = createSignal(getCurrentUserId());
const [userInfo, setUserInfo] = createSignal(null);

createEffect(() => {
  const id = userId();
  if (id) {
    localStorage.setItem('fsc_user_id', id);
  } else {
    localStorage.removeItem('fsc_user_id');
  }
});

export const useAuth = () => {
  const login = (id) => {
    setUserId(id);
    setCurrentUser(id);
  };

  const logout = () => {
    setUserId('');
    setUserInfo(null);
    localStorage.removeItem('fsc_user_id');
  };

  const setUser = (user) => {
    setUserInfo(user);
  };

  return {
    userId,
    userInfo,
    login,
    logout,
    setUser,
  };
};
