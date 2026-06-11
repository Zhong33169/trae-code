import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { ROLE_LABELS } from './models';

@Component({
  selector: 'app-root',
  template: `
    <div *ngIf="!auth.isLoggedIn()">
      <router-outlet></router-outlet>
    </div>
    <div *ngIf="auth.isLoggedIn()" class="layout">
      <header class="header">
        <div class="logo">✈️ 航空地服 - 离线台账回填值机记录系统</div>
        <nav class="nav">
          <a routerLink="/" routerLinkActive="active">值机记录列表</a>
          <a routerLink="/create" routerLinkActive="active">登记新记录</a>
          <a routerLink="/audit" routerLinkActive="active">审计日志</a>
        </nav>
        <div class="user-info">
          <span class="role-badge">{{ roleLabel }}</span>
          <span class="username">{{ auth.user?.real_name }}</span>
          <select
            *ngIf="auth.user?.role === 'admin'"
            (change)="simulateRole($event)"
            class="role-select"
          >
            <option value="">模拟角色</option>
            <option value="initiator">发起岗</option>
            <option value="handler">办理岗</option>
            <option value="reviewer">复核岗</option>
          </select>
          <button (click)="logout()" class="logout-btn">退出</button>
        </div>
      </header>
      <main class="main">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [
    `
    .layout { min-height: 100vh; }
    .header {
      display: flex; align-items: center; justify-content: space-between;
      background: linear-gradient(135deg, #1e40af, #3b82f6);
      color: white; padding: 0 24px; height: 60px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .logo { font-size: 18px; font-weight: 600; }
    .nav { display: flex; gap: 8px; }
    .nav a {
      color: rgba(255,255,255,0.85); text-decoration: none; padding: 8px 16px;
      border-radius: 4px; transition: all 0.2s;
    }
    .nav a:hover, .nav a.active { background: rgba(255,255,255,0.2); color: white; }
    .user-info { display: flex; align-items: center; gap: 12px; }
    .role-badge {
      background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 12px; font-size: 12px;
    }
    .role-select {
      padding: 4px 8px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1);
      color: white; border-radius: 4px;
    }
    .role-select option { color: #333; }
    .logout-btn {
      background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3);
      padding: 6px 14px; border-radius: 4px; cursor: pointer;
    }
    .logout-btn:hover { background: rgba(255,255,255,0.25); }
    .main { padding: 24px; max-width: 1400px; margin: 0 auto; }
    `,
  ],
})
export class AppComponent {
  constructor(public auth: AuthService, private router: Router) {}

  get roleLabel(): string {
    const role = this.auth.user?.role;
    return role ? ROLE_LABELS[role] || role : '';
  }

  simulateRole(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const role = target.value;
    if (!role || !this.auth.user) return;
    const user = { ...this.auth.user, role: role as any };
    localStorage.setItem('user', JSON.stringify(user));
    window.location.reload();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
