import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { User, ApiResponse } from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'eb_token';
  private readonly USER_KEY = 'eb_user';
  private userSubject = new BehaviorSubject<User | null>(null);

  public user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) {
    const saved = localStorage.getItem(this.USER_KEY);
    if (saved) this.userSubject.next(JSON.parse(saved));
  }

  login(username: string, password: string): Observable<ApiResponse<{ token: string; user: User }>> {
    return this.http.post<ApiResponse<{ token: string; user: User }>>('/api/auth/login', { username, password })
      .pipe(tap(res => {
        if (res.code === 0) {
          localStorage.setItem(this.TOKEN_KEY, res.data.token);
          localStorage.setItem(this.USER_KEY, JSON.stringify(res.data.user));
          this.userSubject.next(res.data.user);
        }
      }));
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.userSubject.next(null);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getUser(): User | null {
    return this.userSubject.value;
  }

  getRole(): string | null {
    return this.getUser()?.role || null;
  }

  switchAccount(username: string, password: string): Observable<ApiResponse<any>> {
    this.logout();
    return this.login(username, password);
  }
}
