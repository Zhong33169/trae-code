import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
      <div class="card" style="width: 400px; padding: 32px;">
        <h1 style="text-align: center; margin-bottom: 8px; color: #333;">软件外包项目发布管理系统</h1>
        <p style="text-align: center; color: #999; margin-bottom: 24px;">请登录您的账号</p>

        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label class="form-label">用户名</label>
            <input type="text" class="form-input" [(ngModel)]="username" name="username" placeholder="请输入用户名" required>
          </div>
          <div class="form-group">
            <label class="form-label">密码</label>
            <input type="password" class="form-input" [(ngModel)]="password" name="password" placeholder="请输入密码" required>
          </div>
          <button type="submit" class="btn-primary" style="width: 100%; padding: 12px; font-size: 16px;" [disabled]="loading">
            {{ loading ? '登录中...' : '登 录' }}
          </button>
        </form>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f0f0f0;">
          <p style="font-size: 12px; color: #999; margin-bottom: 8px;">样例账号：</p>
          <div style="font-size: 12px; color: #666; line-height: 1.8;">
            <div>发布登记员：registrar1 / 123456</div>
            <div>发布审核主管：supervisor1 / 123456</div>
            <div>复核负责人：reviewer1 / 123456</div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  username = '';
  password = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService
  ) {}

  onSubmit(): void {
    if (!this.username || !this.password) {
      this.toastService.warning('请输入用户名和密码');
      return;
    }

    this.loading = true;
    this.authService.login(this.username, this.password).subscribe({
      next: () => {
        this.toastService.success('登录成功');
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.loading = false;
        this.toastService.error(err.error?.detail || '登录失败，请检查用户名和密码');
      }
    });
  }
}
