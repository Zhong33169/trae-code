import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  template: `
    <div class="login-bg">
      <div class="login-card">
        <h1>✈️ 航空地服</h1>
        <h2>离线台账回填值机记录系统</h2>
        <form (ngSubmit)="onSubmit()" class="form">
          <div class="form-group">
            <label>用户名</label>
            <input
              type="text"
              [(ngModel)]="username"
              name="username"
              placeholder="initiator1 / handler1 / reviewer1 / admin"
              required
            />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input
              type="password"
              [(ngModel)]="password"
              name="password"
              placeholder="123456"
              required
            />
          </div>
          <div *ngIf="error" class="error">{{ error }}</div>
          <button type="submit" class="login-btn" [disabled]="loading">
            {{ loading ? '登录中...' : '登录' }}
          </button>
        </form>
        <div class="test-accounts">
          <h4>测试账号（密码均为 123456）：</h4>
          <ul>
            <li><b>initiator1</b> - 发起岗（登记值机记录）</li>
            <li><b>handler1</b> - 办理岗（核验材料、处理退回）</li>
            <li><b>reviewer1</b> - 复核岗（复核归档、退回修改）</li>
            <li><b>admin</b> - 管理员（可切换角色体验）</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
    .login-bg {
      min-height: 100vh;
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%);
      display: flex; align-items: center; justify-content: center;
    }
    .login-card {
      background: white; padding: 40px; border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3); width: 420px;
    }
    h1 { font-size: 24px; color: #1e40af; text-align: center; }
    h2 { font-size: 16px; color: #64748b; text-align: center; margin: 8px 0 24px; font-weight: 400; }
    .form { display: flex; flex-direction: column; gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    label { font-size: 13px; color: #475569; font-weight: 500; }
    input {
      padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px;
      transition: all 0.2s;
    }
    input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .error { color: #dc2626; font-size: 13px; background: #fef2f2; padding: 8px 12px; border-radius: 4px; }
    .login-btn {
      padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 6px;
      font-size: 15px; font-weight: 500; cursor: pointer; transition: background 0.2s;
    }
    .login-btn:hover:not(:disabled) { background: #2563eb; }
    .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .test-accounts { margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .test-accounts h4 { font-size: 13px; color: #64748b; margin-bottom: 8px; }
    .test-accounts ul { list-style: none; padding: 0; font-size: 12px; color: #475569; }
    .test-accounts li { padding: 4px 0; }
    `,
  ],
})
export class LoginComponent {
  username = '';
  password = '';
  loading = false;
  error = '';

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit(): void {
    if (!this.username || !this.password) return;
    this.loading = true;
    this.error = '';
    this.auth.login(this.username, this.password).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => {
        this.error = err.error?.error || '登录失败';
        this.loading = false;
      },
    });
  }
}
