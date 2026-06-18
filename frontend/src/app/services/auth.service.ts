import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

export interface User {
  id: string;
  username: string;
  role: 'registrar' | 'reviewer' | 'archiver';
  display_name: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _token = signal<string | null>(localStorage.getItem('token'));
  private _user = signal<User | null>(
    localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null
  );

  token = this._token.asReadonly();
  currentUser = this._user.asReadonly();
  isLoggedIn = computed(() => !!this._token());

  constructor(private http: HttpClient, private router: Router) {}

  getAuthHeaders() {
    return this._token()
      ? new HttpHeaders({ Authorization: this._token()! })
      : new HttpHeaders();
  }

  login(username: string, password: string) {
    return this.http
      .post<any>('/api/auth/login', { username, password })
      .pipe(
        tap((res) => {
          if (res.code === 0 && res.data) {
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            this._token.set(res.data.token);
            this._user.set(res.data.user);
          }
        })
      );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this._token.set(null);
    this._user.set(null);
  }

  hasRole(roles: string[]) {
    return !!this._user() && roles.includes(this._user()!.role);
  }
}
