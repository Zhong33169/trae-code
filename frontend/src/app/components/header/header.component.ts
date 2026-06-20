import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/app.models';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="header">
      <div class="header-inner">
        <div class="brand" (click)="goHome()">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1677ff" stroke-width="2">
            <path d="M20 7H4a2 2 0 00-2 2v8a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
            <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
          </svg>
          <span class="title">器材借用管理系统</span>
        </div>
        <div class="user-area">
          <div class="role-switcher">
            <label>角色切换:</label>
            <select [(ngModel)]="switchAccount" (change)="doSwitch()">
              <option value="">-- 选择账号快速登录 --</option>
              <option *ngFor="let a of accounts" [ngValue]="a" [disabled]="a.username === user?.username">
                {{ a.name }} ({{ a.roleLabel }})
              </option>
            </select>
          </div>
          <div class="user-info" *ngIf="user">
            <span class="avatar">{{ user.real_name.charAt(0) }}</span>
            <div class="user-meta">
              <div class="name">{{ user.real_name }}</div>
              <div class="role">{{ roleLabel }}</div>
            </div>
            <button class="btn btn-sm" (click)="logout()">退出</button>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .header { background: #fff; border-bottom: 1px solid #f0f0f0; padding: 0 20px; position: sticky; top: 0; z-index: 100; }
    .header-inner { max-width: 1600px; margin: 0 auto; height: 56px; display: flex; justify-content: space-between; align-items: center; }
    .brand { display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .title { font-size: 17px; font-weight: 600; color: #222; }
    .user-area { display: flex; align-items: center; gap: 18px; }
    .role-switcher { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #666; }
    .role-switcher select { padding: 4px 8px; border: 1px solid #d9d9d9; border-radius: 5px; font-size: 13px; background: #fff; }
    .user-info { display: flex; align-items: center; gap: 8px; }
    .avatar { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #1677ff, #69b1ff); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 600; }
    .user-meta { line-height: 1.2; }
    .name { font-size: 13px; font-weight: 500; }
    .role { font-size: 11px; color: #999; }
  `]
})
export class HeaderComponent implements OnInit {
  user: User | null = null;
  switchAccount: any = '';
  accounts = [
    { username: 'registrar01', password: '123456', name: '李登记员', roleLabel: '器材借用登记员' },
    { username: 'auditor01', password: '123456', name: '王审核主管', roleLabel: '器材借用审核主管' },
    { username: 'reviewer01', password: '123456', name: '张复核负责人', roleLabel: '体育场馆复核负责人' }
  ];

  constructor(public authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.authService.user$.subscribe(u => this.user = u);
  }

  get roleLabel(): string {
    const map: any = { registrar: '器材借用登记员', auditor: '器材借用审核主管', reviewer: '体育场馆复核负责人' };
    return map[this.user?.role || ''] || '';
  }

  goHome() { this.router.navigate(['/queue']); }

  doSwitch() {
    if (!this.switchAccount) return;
    const a = this.switchAccount;
    this.switchAccount = '';
    this.authService.switchAccount(a.username, a.password).subscribe({
      next: () => { this.router.navigate(['/queue']); },
      error: (e) => alert('切换失败: ' + (e.error?.message || e.message))
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
