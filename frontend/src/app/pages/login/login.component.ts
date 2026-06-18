import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
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
            <select [(ngModel)]="role" name="role" class="input" (ngModelChange)="onRoleChange()">
              <option value="registrar">选题登记员 (张登记)</option>
              <option value="reviewer">选题审核主管 (李审核)</option>
              <option value="archiver">新闻采编中心复核负责人 (王复核)</option>
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
          <div class="role-tasks">
            <div class="role-tasks-title">当前角色可办事项：</div>
            <ul>
              <li *ngFor="let t of roleTasks">{{ t }}</li>
            </ul>
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
        background: #fff; padding: 32px 40px; border-radius: 8px; width: 460px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      }
      .title { font-size: 18px; color: #1f3a68; margin: 0 0 4px; }
      .subtitle { color: #666; font-size: 13px; margin: 0 0 20px; }
      .form { display: flex; flex-direction: column; gap: 14px; }
      .field { display: flex; flex-direction: column; gap: 6px; }
      .field label { font-size: 13px; color: #444; }
      .input { padding: 8px 10px; border: 1px solid #cfd8e3; border-radius: 4px; font-size: 14px; }
      .role-tasks {
        background: #f0f5fb; border-radius: 6px; padding: 12px 16px;
        border-left: 3px solid #3a6aa8;
      }
      .role-tasks-title { font-size: 13px; color: #1f3a68; font-weight: 600; margin-bottom: 6px; }
      .role-tasks ul { margin: 0; padding-left: 20px; }
      .role-tasks li { font-size: 12px; color: #444; line-height: 1.8; }
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
export class LoginComponent {
  role = 'registrar';
  username = 'registrar';
  password = '123456';
  loading = false;
  error = '';

  private roleUserMap: Record<string, string> = {
    registrar: 'registrar',
    reviewer: 'reviewer',
    archiver: 'archiver',
  };
  private roleTasksMap: Record<string, string[]> = {
    registrar: [
      '登记选题单（新建、补录材料）',
      '查看本人登记的选题单列表',
      '离线台账批量回填（成功/冲突/失败自动分类）',
      '上传选题相关附件材料',
    ],
    reviewer: [
      '审核选题单（通过 / 退回补录）',
      '查看所有待审核选题单',
      '查看离线回填历史批次与明细',
      '查看选题审计日志',
    ],
    archiver: [
      '复核已审核选题单并归档',
      '查看全部选题单与状态流转',
      '查看所有离线回填批次与追溯',
      '查看全量审计日志',
    ],
  };

  get roleTasks(): string[] {
    return this.roleTasksMap[this.role] || [];
  }

  constructor(private auth: AuthService, private router: Router) {}

  onRoleChange() {
    this.username = this.roleUserMap[this.role] || this.role;
  }

  submit() {
    this.error = '';
    this.loading = true;
    this.auth.login(this.username, this.password).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.code === 0) {
          this.router.navigate(['/topics']);
        } else {
          this.error = res.message || '登录失败';
        }
      },
      error: (e) => {
        this.loading = false;
        this.error = '请求失败：' + (e.message || JSON.stringify(e));
      },
    });
  }
}
