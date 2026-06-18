import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  template: `
    <div *ngIf="authService.isLoggedIn()" class="app-shell">
      <header class="app-header">
        <div class="logo">新闻采编中心 · 选题单离线台账回填系统</div>
        <nav class="nav">
          <a routerLink="/topics" routerLinkActive="active">选题单列表</a>
          <a routerLink="/import" routerLinkActive="active">离线台账回填</a>
          <a routerLink="/audit" routerLinkActive="active">审计日志</a>
        </nav>
        <div class="user">
          <span class="role-badge role-{{ authService.currentUser()?.role }}">
            {{ roleLabel(authService.currentUser()?.role) }}
          </span>
          <span class="user-name">{{ authService.currentUser()?.display_name }}</span>
          <select
            *ngIf="false"
            (change)="switchRole($any($event.target).value)"
            class="role-switch"
          >
            <option value="registrar">选题登记员</option>
            <option value="reviewer">选题审核主管</option>
            <option value="archiver">新闻采编中心复核负责人</option>
          </select>
          <button (click)="logout()" class="btn-link">退出</button>
        </div>
      </header>
      <main class="app-main">
        <router-outlet></router-outlet>
      </main>
    </div>
    <router-outlet *ngIf="!authService.isLoggedIn()"></router-outlet>
  `,
  styles: [
    `
      .app-shell { min-height: 100vh; display: flex; flex-direction: column; }
      .app-header {
        display: flex; align-items: center; gap: 24px; padding: 12px 24px;
        background: #1f3a68; color: #fff;
      }
      .logo { font-weight: 600; font-size: 16px; }
      .nav { display: flex; gap: 8px; flex: 1; }
      .nav a {
        color: #d7e2f5; text-decoration: none; padding: 6px 12px; border-radius: 4px;
      }
      .nav a.active { background: #2d55a3; color: #fff; }
      .user { display: flex; align-items: center; gap: 12px; font-size: 14px; }
      .role-badge {
        padding: 2px 8px; border-radius: 10px; background: #3a5ea8; font-size: 12px;
      }
      .role-registrar { background: #2a8a4e; }
      .role-reviewer { background: #c0791b; }
      .role-archiver { background: #6b3ea5; }
      .user-name { color: #fff; }
      .btn-link {
        background: transparent; border: 1px solid #6f8ec4; color: #d7e2f5;
        padding: 4px 10px; border-radius: 4px; cursor: pointer;
      }
      .app-main { flex: 1; padding: 24px; background: #f4f6fa; }
    `,
  ],
})
export class AppComponent {
  constructor(public authService: AuthService, public router: Router) {}

  roleLabel(role?: string) {
    const map: Record<string, string> = {
      registrar: '选题登记员',
      reviewer: '选题审核主管',
      archiver: '新闻采编中心复核负责人',
    };
    return map[role || ''] || role;
  }

  switchRole(role: string) {
    // TODO: 预留
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
