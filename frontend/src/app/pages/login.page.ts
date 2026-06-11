import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-purple-50 px-4">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4 text-3xl">📋</div>
          <h1 class="text-2xl font-bold text-slate-800">批量变更复核系统</h1>
          <p class="text-slate-500 text-sm mt-1">SaaS客户成功团队 · 上线计划单管理</p>
        </div>
        <div class="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
          <div *ngIf="error" class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{{ error }}</div>
          <form (ngSubmit)="doLogin()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">用户名</label>
              <input [(ngModel)]="username" name="u" class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="csm_wang">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">密码</label>
              <input type="password" [(ngModel)]="password" name="p" class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="123456">
            </div>
            <button type="submit" [disabled]="loading" class="w-full py-3 bg-primary hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50">
              {{ loading ? '登录中...' : '登 录' }}
            </button>
          </form>
          <div class="mt-6 pt-6 border-t border-slate-100">
            <p class="text-xs text-slate-500 mb-3 font-semibold">演示账号（点击快速填充）：</p>
            <div class="space-y-2">
              <button *ngFor="let a of accounts" (click)="fill(a)" type="button"
                class="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 border border-slate-100 text-sm flex items-center justify-between group">
                <span>
                  <span class="font-medium text-slate-700">{{ a.name }}</span>
                  <span class="text-slate-400 text-xs ml-2">({{ a.username }})</span>
                </span>
                <span class="text-xs px-2 py-0.5 rounded-full" [ngClass]="badgeClass(a.role)">
                  {{ roleLabel(a.role) }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginPage implements OnInit {
  username = 'csm_wang';
  password = '123456';
  loading = false;
  error = '';

  accounts = [
    { username: 'csm_wang', password: '123456', name: '王晓敏', role: 'CSM' },
    { username: 'csm_li', password: '123456', name: '李伟强', role: 'CSM' },
    { username: 'delivery_zhang', password: '123456', name: '张明远', role: 'DELIVERY' },
    { username: 'delivery_chen', password: '123456', name: '陈思雨', role: 'DELIVERY' },
    { username: 'director_zhao', password: '123456', name: '赵国栋', role: 'DIRECTOR' }
  ];

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit() {
    if (localStorage.getItem('lp_token')) this.router.navigate(['/queue']);
  }

  fill(a: any) { this.username = a.username; this.password = a.password; this.error = ''; }
  roleLabel(r: string) { return ({ CSM: '客户成功经理', DELIVERY: '交付顾问', DIRECTOR: '客户成功负责人' } as any)[r]; }
  badgeClass(r: string) { return ({
    CSM: 'bg-blue-100 text-blue-700', DELIVERY: 'bg-purple-100 text-purple-700', DIRECTOR: 'bg-orange-100 text-orange-700'
  } as any)[r]; }

  async doLogin() {
    this.loading = true; this.error = '';
    try {
      const res = await this.api.login(this.username, this.password);
      if (res.code === 0) {
        localStorage.setItem('lp_token', res.data.token);
        localStorage.setItem('lp_user', JSON.stringify(res.data.user));
        this.router.navigate(['/queue']);
      } else {
        this.error = res.message || '登录失败';
      }
    } catch (e: any) {
      this.error = e.error?.message || e.message || '网络错误';
    } finally {
      this.loading = false;
    }
  }
}
