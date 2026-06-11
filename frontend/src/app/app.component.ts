import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from './services/api.service';
import { User, ROLE_LABELS } from './models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="app-shell">
      <header class="app-header">
        <div class="brand">
          <h1>🚚 货运物流公司 - 运输订单管理系统</h1>
          <span class="subtitle">批量变更 · 复核归档 · 全流程追踪</span>
        </div>
        <nav class="main-nav">
          <a routerLink="/orders" routerLinkActive="active" class="nav-link">📦 运输订单队列</a>
          <a routerLink="/batches" routerLinkActive="active" class="nav-link">📋 批量变更批次</a>
        </nav>
        <div class="user-panel">
          <label class="user-label">当前角色：</label>
          <select
            [value]="currentUser?.id ?? ''"
            (change)="onUserChange($any($event.target).value)"
            class="user-select"
          >
            <option value="">-- 请选择登录角色 --</option>
            <option *ngFor="let u of users" [value]="u.id">
              {{ u.display_name }}（{{ ROLE_LABELS[u.role] }}）
            </option>
          </select>
        </div>
      </header>
      <main class="app-main">
        <div *ngIf="!currentUser" class="login-warning">
          ⚠️ 请先在右上角选择登录角色以开始操作
        </div>
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f0f2f5; color: #1f2937; }
    .app-shell { min-height: 100vh; display: flex; flex-direction: column; }
    .app-header {
      background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%);
      color: white;
      padding: 14px 28px;
      display: flex;
      align-items: center;
      gap: 32px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    }
    .brand h1 { font-size: 18px; font-weight: 600; }
    .subtitle { font-size: 12px; opacity: 0.8; }
    .main-nav { display: flex; gap: 6px; flex: 1; }
    .nav-link {
      color: rgba(255,255,255,0.85);
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      transition: all 0.2s;
    }
    .nav-link:hover { background: rgba(255,255,255,0.12); color: white; }
    .nav-link.active { background: rgba(255,255,255,0.2); color: white; font-weight: 500; }
    .user-panel { display: flex; align-items: center; gap: 8px; font-size: 14px; }
    .user-label { opacity: 0.9; }
    .user-select {
      padding: 7px 12px;
      border: none;
      border-radius: 6px;
      background: rgba(255,255,255,0.95);
      color: #1f2937;
      font-size: 13px;
      min-width: 180px;
    }
    .app-main { flex: 1; padding: 20px 28px; }
    .login-warning {
      background: #fef3c7;
      border: 1px solid #fcd34d;
      color: #92400e;
      padding: 12px 20px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
    }
  `]
})
export class AppComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  users: User[] = [];
  currentUser: User | null = null;
  ROLE_LABELS = ROLE_LABELS;

  ngOnInit() {
    this.api.listUsers().subscribe((users) => {
      this.users = users;
    });
    this.api.getCurrentUser().subscribe((u) => {
      this.currentUser = u;
    });
  }

  onUserChange(val: string) {
    if (!val) {
      this.api.clearCurrentUser();
      return;
    }
    const userId = parseInt(val, 10);
    this.api.setCurrentUserById(userId).subscribe({
      next: () => {},
      error: (e) => alert('切换角色失败：' + e.message),
    });
  }
}
