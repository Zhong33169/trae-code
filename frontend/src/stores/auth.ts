import { createSignal } from 'solid-js';

const [user, setUser] = createSignal<any>(null);
const [token, setToken] = createSignal<string | null>(localStorage.getItem('token'));

export { user, token, setUser, setToken };

export function logout() {
  localStorage.removeItem('token');
  setToken(null);
  setUser(null);
}
