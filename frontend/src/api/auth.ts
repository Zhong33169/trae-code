import { api, UserInfo, setToken, clearToken } from './client';

export async function login(username: string, password: string) {
  const r = await api<{ token: string; user: UserInfo }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (r.code === 0 && r.data?.token) {
    setToken(r.data.token);
    localStorage.setItem('pp_user', JSON.stringify(r.data.user));
  }
  return r;
}

export function getCurrentUser(): UserInfo | null {
  try {
    const s = localStorage.getItem('pp_user');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function logout() {
  clearToken();
}
