import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Role, RoleLabels } from '../../models/auth.model';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div style="display: flex; min-height: 100vh;">
      <aside style="width: 220px; background: #001529; color: white; flex-shrink: 0;">
        <div style="padding: 20px; border-bottom: 1px solid #1f3a5f;">
          <h2 style="font-size: 16px; color: white; text-align: center;">发布管理系统</h2>
        </div>
        <nav style="padding: 12px 0;">
          <a routerLink="/dashboard" routerLinkActive="active" style="display: block; padding: 12px 24px; color: rgba(255,255,255,0.75); text-decoration: none; transition: all 0.3s;">
            📊 数据统计
          </a>
          <a routerLink="/releases" routerLinkActive="active" style="display: block; padding: 12px 24px; color: rgba(255,255,255,0.75); text-decoration: none; transition: all 0.3s;">
            📋 发布申请
          </a>
          <a routerLink="/handovers" routerLinkActive="active" style="display: block; padding: 12px 24px; color: rgba(255,255,255,0.75); text-decoration: none; transition: all 0.3s;">
            🔄 换班交接
          </a>
          <a routerLink="/logs" routerLinkActive="active" style="display: block; padding: 12px 24px; color: rgba(255,255,255,0.75); text-decoration: none; transition: all 0.3s;">
            📝 操作记录
          </a>
        </nav>
      </aside>

      <div style="flex: 1; display: flex; flex-direction: column;">
        <header style="height: 56px; background: white; box-shadow: 0 1px 4px rgba(0,0,0,0.08); display: flex; justify-content: space-between; align-items: center; padding: 0 24px; flex-shrink: 0;">
          <div style="font-size: 18px; font-weight: 500;">软件外包项目发布管理系统</div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="color: #666; font-size: 14px;">
              {{ currentUser?.full_name }}
              <span class="badge" style="background: #e6f7ff; color: #1890ff;">{{ roleLabel }}</span>
            </span>
            <button class="btn-default" (click)="logout()">退出登录</button>
          </div>
        </header>

        <main style="flex: 1; padding: 20px; overflow-y: auto;">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>

    <div style="position: fixed; top: 20px; right: 20px; z-index: 9999;">
      <div *ngFor="let toast of toasts" class="toast toast-{{toast.type}}" (click)="removeToast(toast.id)">
        {{ toast.message }}
      </div>
    </div>
  `,
  styles: [`
    nav a.active {
      background: #1890ff;
      color: white !important;
    }
    nav a:hover {
      color: white !important;
      background: rgba(255,255,255,0.1);
    }
  `]
})
export class LayoutComponent {
  currentUser = this.authService.currentUser;
  roleLabel = this.currentUser ? RoleLabels[this.currentUser.role as Role] : '';
  toasts: any[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService
  ) {
    this.toastService.toasts$.subscribe(toasts => {
      this.toasts = toasts;
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  removeToast(id: number): void {
    this.toastService.remove(id);
  }
}
