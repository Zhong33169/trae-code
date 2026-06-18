import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api.service';
import { DEMO_ACCOUNTS, AppUser, Role } from './models';

const TOKEN_KEY = 'rr_token';
const USER_KEY = 'rr_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  private _user = signal<AppUser | null>(this.restoreUser());
  private _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  readonly user = this._user.asReadonly();
  readonly token = this._token.asReadonly();

  private restoreUser(): AppUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as AppUser; } catch { return null; }
  }

  async login(username: string, password: string): Promise<AppUser> {
    const res = await firstValueFrom(
      this.http.post<{ data: { token: string; user: AppUser } }>(`${API_BASE}/api/login`, { username, password })
    );
    const { token, user } = res.data;
    this._token.set(token);
    this._user.set(user);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }

  async switchRole(role: Role): Promise<AppUser> {
    const acc = DEMO_ACCOUNTS[role];
    return this.login(acc.username, acc.password);
  }

  logout(): void {
    this._token.set(null);
    this._user.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  isLoggedIn(): boolean {
    return !!this._token();
  }
}
