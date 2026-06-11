import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map } from 'rxjs';
import { User } from '../models';

const API_URL = '/api';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);

  constructor(private http: HttpClient) {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      this.tokenSubject.next(token);
      this.userSubject.next(JSON.parse(userStr));
    }
  }

  get token(): string | null {
    return this.tokenSubject.value;
  }

  get user(): User | null {
    return this.userSubject.value;
  }

  get user$(): Observable<User | null> {
    return this.userSubject.asObservable();
  }

  get role$(): Observable<string> {
    return this.userSubject.asObservable().pipe(map(u => u?.role || ''));
  }

  login(username: string, password: string): Observable<{ token: string; user: User }> {
    return this.http.post<{ token: string; user: User }>(`${API_URL}/auth/login`, { username, password }).pipe(
      tap(res => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        this.tokenSubject.next(res.token);
        this.userSubject.next(res.user);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.tokenSubject.next(null);
    this.userSubject.next(null);
  }

  isLoggedIn(): boolean {
    return !!this.tokenSubject.value;
  }

  hasRole(roles: string[]): boolean {
    const user = this.userSubject.value;
    if (!user) return false;
    return roles.includes(user.role);
  }
}
