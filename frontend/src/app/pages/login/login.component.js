var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
let LoginComponent = class LoginComponent {
    constructor(auth, router) {
        this.auth = auth;
        this.router = router;
        this.role = 'registrar';
        this.username = 'registrar';
        this.password = '123456';
        this.loading = false;
        this.error = '';
    }
    ngOnChanges() {
        this.username = this.role;
    }
    submit() {
        this.error = '';
        this.loading = true;
        this.auth.login(this.username, this.password).subscribe({
            next: (res) => {
                this.loading = false;
                if (res.code === 0) {
                    this.router.navigate(['/topics']);
                }
                else {
                    this.error = res.message || '登录失败';
                }
            },
            error: (e) => {
                this.loading = false;
                this.error = '请求失败：' + (e.message || JSON.stringify(e));
            },
        });
    }
};
LoginComponent = __decorate([
    Component({
        selector: 'app-login',
        standalone: true,
        imports: [CommonModule, FormsModule, RouterModule],
        template: `
    <div class="login-wrap">
      <div class="login-card">
        <h2 class="title">新闻采编中心 · 选题单离线台账回填系统</h2>
        <p class="subtitle">请选择角色并登录</p>
        <form (ngSubmit)="submit()" class="form">
          <div class="field">
            <label>角色</label>
            <select [(ngModel)]="role" name="role" class="input">
              <option value="registrar">选题登记员 (registrar / 123456)</option>
              <option value="reviewer">选题审核主管 (reviewer / 123456)</option>
              <option value="archiver">新闻采编中心复核负责人 (archiver / 123456)</option>
            </select>
          </div>
          <div class="field">
            <label>用户名</label>
            <input [(ngModel)]="username" name="username" class="input" placeholder="用户名" />
          </div>
          <div class="field">
            <label>密码</label>
            <input [(ngModel)]="password" name="password" type="password" class="input" placeholder="密码" />
          </div>
          <button type="submit" class="btn-primary" [disabled]="loading">
            {{ loading ? '登录中...' : '登录' }}
          </button>
          <div *ngIf="error" class="error">{{ error }}</div>
        </form>
        <div class="tip">演示账号：registrar / reviewer / archiver，密码均为 123456</div>
      </div>
    </div>
  `,
        styles: [
            `
      .login-wrap {
        min-height: 100vh; display: flex; align-items: center; justify-content: center;
        background: linear-gradient(135deg, #1f3a68 0%, #3a6aa8 100%);
      }
      .login-card {
        background: #fff; padding: 32px 40px; border-radius: 8px; width: 420px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      }
      .title { font-size: 18px; color: #1f3a68; margin: 0 0 4px; }
      .subtitle { color: #666; font-size: 13px; margin: 0 0 20px; }
      .form { display: flex; flex-direction: column; gap: 14px; }
      .field { display: flex; flex-direction: column; gap: 6px; }
      .field label { font-size: 13px; color: #444; }
      .input { padding: 8px 10px; border: 1px solid #cfd8e3; border-radius: 4px; font-size: 14px; }
      .btn-primary {
        padding: 10px; background: #1f3a68; color: #fff; border: 0;
        border-radius: 4px; cursor: pointer; font-size: 14px;
      }
      .btn-primary[disabled] { opacity: 0.6; }
      .error { color: #c0392b; font-size: 13px; }
      .tip { margin-top: 16px; font-size: 12px; color: #888; }
    `,
        ],
    })
], LoginComponent);
export { LoginComponent };
//# sourceMappingURL=login.component.js.map