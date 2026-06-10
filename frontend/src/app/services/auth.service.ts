import { Injectable, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { User, UserRole } from '../models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnInit {
  private usersSubject = new BehaviorSubject<User[]>([]);
  private currentUserSubject = new BehaviorSubject<User>({
    id: 1,
    username: 'default',
    real_name: '默认用户',
    role: 'registrar' as UserRole,
  });

  users$ = this.usersSubject.asObservable();
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.http.get<User[]>(`${environment.apiBaseUrl}/auth/users`).subscribe({
      next: (users) => {
        this.usersSubject.next(users);
        if (users.length > 0) {
          const existing = this.currentUserSubject.value;
          const matched = users.find((u) => u.id === existing.id);
          this.currentUserSubject.next(matched || users[0]);
        }
      },
      error: () => {
        const fallback: User[] = [
          { id: 1, username: 'registrar', real_name: '张登记', role: 'registrar' },
          { id: 2, username: 'supervisor', real_name: '李主管', role: 'supervisor' },
          { id: 3, username: 'reviewer', real_name: '王复核', role: 'reviewer' },
        ];
        this.usersSubject.next(fallback);
        this.currentUserSubject.next(fallback[0]);
      },
    });
  }

  getUsers(): Observable<User[]> {
    return this.users$;
  }

  getUsersSnapshot(): User[] {
    return this.usersSubject.value;
  }

  getCurrentUser(): Observable<User> {
    return this.currentUser$;
  }

  getCurrentUserSnapshot(): User {
    return this.currentUserSubject.value;
  }

  getCurrentUserId(): number {
    return this.currentUserSubject.value.id;
  }

  getCurrentUserRole(): UserRole {
    return this.currentUserSubject.value.role;
  }

  switchUser(user: User): void {
    this.currentUserSubject.next(user);
  }
}
