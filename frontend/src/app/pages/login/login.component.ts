import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-wrap">
      <div class="login-box">
        <div class="login-logo">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#1677ff" stroke-width="2">
            <path d="M20 7H4a2 2 0 00-2 2v8a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
            <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
          </svg>
          <h1>器材借用管理系统</h1>
          <p class="subtitle">Equipment Borrow Management</p>
        </div>
        <div class="alert alert-info" *ngIf="!errMsg">
          <b>演示账号：</b><br/>
          登记员：registrar01 / 123456<br/>
          审核主管：auditor01 / 123456<br/>
          复核负责人：reviewer01 / 123456
        </div>
        <div class="alert alert-error" *ngIf="errMsg">{{ errMsg }}</div>
        <form (ngSubmit)="onLogin()">
          <div class="form-item">
            <label>用户名</label>
            <input type="text" [(ngModel)]="username" name="u" placeholder="请输入用户名" autocomplete="off" required>
          </div>
          <div class="form-item">
            <label>密码</label>
            <input type="password" [(ngModel)]="password" name="p" placeholder="请输入密码" required>
          </div>
          <div class="quick-switch">
            <span class="text-sm text-gray">快速登录：</span>
            <a class="text-sm" (click)="fill('registrar01')">登记员</a>
            <a class="text-sm" (click)="fill('auditor01')">审核</a>
            <a class="text-sm" (click)="fill('reviewer01')">复核</a>
          </div>
          <button class="btn btn-primary btn-lg" style="width:100%" [disabled]="loading">
            <span *ngIf="loading" class="spinner"></span>
            {{ loading ? '登录中...' : '登 录' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-wrap { min-height: 100vh; background: linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 100%); display: flex; align-items: center; justify-content: center; padding: 20px; }
    .login-box { width: 420px; background: #fff; border-radius: 14px; box-shadow: 0 8px 30px rgba(22,119,255,.12); padding: 36px 32px; }
    .login-logo { text-align: center; margin-bottom: 22px; }
    .login-logo h1 { font-size: 22px; margin-top: 10px; color: #222; }
    .subtitle { font-size: 12px; color: #999; letter-spacing: 2px; margin-top: 4px; }
    .quick-switch { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
    .quick-switch a { padding: 3px 8px; border: 1px solid #d9d9d9; border-radius: 4px; background: #fafafa; }
    .quick-switch a:hover { color: #1677ff; border-color: #1677ff; text-decoration: none; }
  `]
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  loading = false;
  errMsg = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    const p = this.route.snapshot.queryParamMap.get('u');
    if (p) this.fill(p);
  }

  fill(u: string) { this.username = u; this.password = '123456'; }

  onLogin() {
    if (!this.username || !this.password) return;
    this.loading = true; this.errMsg = '';
    this.auth.login(this.username, this.password).subscribe({
      next: () => this.router.navigate(['/queue']),
      error: (e) => {
        this.errMsg = e.error?.message || '登录失败';
        this.loading = false;
      },
      complete: () => this.loading = false
    });
  }
}
