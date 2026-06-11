import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen flex flex-col">
      <header *ngIf="currentUser" class="bg-white border-b border-slate-200 shadow-sm">
        <div class="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div class="flex items-center gap-8">
            <div class="flex items-center gap-2 font-bold text-lg text-slate-800">
              <span class="text-2xl">📋</span>
              批量变更复核·上线计划单
            </div>
            <nav class="flex items-center gap-1">
              <a routerLink="/queue" routerLinkActive="bg-primary text-white !text-white" class="px-4 py-2 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 transition">
                计划单队列
              </a>
              <a routerLink="/batches" routerLinkActive="bg-primary text-white !text-white" class="px-4 py-2 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 transition">
                批次中心
              </a>
              <a routerLink="/audit" routerLinkActive="bg-primary text-white !text-white" class="px-4 py-2 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 transition">
                审计日志
              </a>
            </nav>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-3 text-sm">
              <div class="px-3 py-1 rounded-full text-xs font-semibold" [ngClass]="roleBadge">
                {{ roleLabel }}
              </div>
              <span class="font-medium text-slate-700">{{ currentUser.name }}</span>
              <span class="text-slate-400">({{ currentUser.username }})</span>
            </div>
            <div class="flex items-center gap-2">
              <label class="text-xs text-slate-500">切换角色：</label>
              <select (change)="switchRole($any($event.target).value)" class="text-xs border rounded px-2 py-1 bg-white">
                <option value="">--</option>
                <option *ngFor="let a of accounts" [value]="a.username + ':' + a.password">
                  {{ a.role }} · {{ a.name }}
                </option>
              </select>
            </div>
            <button (click)="logout()" class="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-md text-slate-700">
              退出
            </button>
          </div>
        </div>
      </header>
      <main class="flex-1">
        <router-outlet></router-outlet>
      </main>
      <div *ngIf="toast" class="fixed top-20 right-6 z-50 max-w-md animate-pulse">
        <div class="px-4 py-3 rounded-lg shadow-lg border text-sm flex items-start gap-3" [ngClass]="toastClass">
          <span class="text-lg">{{ toast.icon }}</span>
          <div class="flex-1">
            <div class="font-semibold mb-0.5">{{ toast.title }}</div>
            <div class="text-xs opacity-90">{{ toast.message }}</div>
          </div>
          <button (click)="toast = null" class="opacity-70 hover:opacity-100">×</button>
        </div>
      </div>
    </div>
  `
})
export class AppComponent implements OnInit {
  currentUser: any = null;
  toast: any = null;
  toastClass = '';

  accounts = [
    { username: 'csm_wang', password: '123456', name: '王晓敏', role: 'CSM' },
    { username: 'csm_li', password: '123456', name: '李伟强', role: 'CSM' },
    { username: 'delivery_zhang', password: '123456', name: '张明远', role: 'DELIVERY' },
    { username: 'delivery_chen', password: '123456', name: '陈思雨', role: 'DELIVERY' },
    { username: 'director_zhao', password: '123456', name: '赵国栋', role: 'DIRECTOR' }
  ];

  constructor(private router: Router) {
    (window as any).showToast = this.showToast.bind(this);
  }

  ngOnInit() {
    try {
      const u = JSON.parse(localStorage.getItem('lp_user') || 'null');
      if (u) this.currentUser = u;
    } catch {}
    window.addEventListener('storage', () => this.syncUser());
    setInterval(() => this.syncUser(), 500);
  }

  syncUser() {
    try {
      const u = JSON.parse(localStorage.getItem('lp_user') || 'null');
      this.currentUser = u;
    } catch {}
  }

  get roleLabel() {
    return ({ CSM: '客户成功经理', DELIVERY: '交付顾问', DIRECTOR: '客户成功负责人' } as any)[this.currentUser?.role] || '';
  }
  get roleBadge() {
    return ({
      CSM: 'bg-blue-100 text-blue-700',
      DELIVERY: 'bg-purple-100 text-purple-700',
      DIRECTOR: 'bg-orange-100 text-orange-700'
    } as any)[this.currentUser?.role] || '';
  }

  showToast(type: 'success' | 'error' | 'warning' | 'info', title: string, message = '') {
    const cfg: any = {
      success: { icon: '✅', cls: 'bg-success-light border-success text-success-800' },
      error: { icon: '❌', cls: 'bg-danger-light border-danger text-danger' },
      warning: { icon: '⚠️', cls: 'bg-warning-light border-warning text-warning-700' },
      info: { icon: 'ℹ️', cls: 'bg-primary-light border-primary text-primary' }
    };
    this.toast = { type, title, message, icon: cfg[type].icon };
    this.toastClass = cfg[type].cls;
    setTimeout(() => this.toast = null, 4000);
  }

  async switchRole(v: string) {
    if (!v) return;
    const [u, p] = v.split(':');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });
      const data = await res.json();
      if (data.code === 0) {
        localStorage.setItem('lp_token', data.data.token);
        localStorage.setItem('lp_user', JSON.stringify(data.data.user));
        this.currentUser = data.data.user;
        location.reload();
      } else {
        this.showToast('error', '切换失败', data.message);
      }
    } catch (e: any) {
      this.showToast('error', '网络错误', e.message);
    }
  }

  logout() {
    localStorage.removeItem('lp_token');
    localStorage.removeItem('lp_user');
    this.currentUser = null;
    this.router.navigate(['/login']);
  }
}
