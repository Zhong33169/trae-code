import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-[1400px] mx-auto p-6">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-slate-800">审计日志</h2>
          <p class="text-sm text-slate-500 mt-1">全量操作审计，支持按用户/行为筛选</p>
        </div>
        <button (click)="reload()" class="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm">🔄 刷新</button>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 flex items-center gap-3">
        <select [(ngModel)]="filters.user_id" (change)="reload()" class="px-3 py-2 border border-slate-200 rounded text-sm bg-white">
          <option value="">全部用户</option>
          <option *ngFor="let u of users" [value]="u.id">{{ u.name }} ({{ u.username }} / {{ u.role }})</option>
        </select>
        <input [(ngModel)]="filters.action" (keyup.enter)="reload()" placeholder="筛选操作（如 ACTION / BATCH / CREATE 等）"
          class="flex-1 px-3 py-2 border border-slate-200 rounded text-sm">
        <button (click)="reload()" class="px-4 py-2 bg-primary text-white rounded text-sm">查询</button>
        <button (click)="filters = {user_id: '', action: ''}; reload()" class="px-3 py-2 text-xs text-slate-500 hover:text-primary">重置</button>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-auto max-h-[700px]">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 sticky top-0 text-left text-xs uppercase text-slate-500 z-10">
              <tr>
                <th class="px-5 py-3">时间</th>
                <th class="px-5 py-3">操作人</th>
                <th class="px-5 py-3">角色</th>
                <th class="px-5 py-3">操作</th>
                <th class="px-5 py-3">对象</th>
                <th class="px-5 py-3">详情</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let a of logs" class="border-t border-slate-100 hover:bg-blue-50/20">
                <td class="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">{{ a.created_at }}</td>
                <td class="px-5 py-3 font-medium">{{ a.user_name }}</td>
                <td class="px-5 py-3">
                  <span class="text-xs px-2 py-0.5 rounded" [ngClass]="roleCls(a.user_role)">{{ a.user_role }}</span>
                </td>
                <td class="px-5 py-3">
                  <span class="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">{{ a.action }}</span>
                </td>
                <td class="px-5 py-3 text-xs">
                  <span *ngIf="a.target_type" class="font-mono text-slate-500">{{ a.target_type }} #{{ a.target_id }}</span>
                  <span *ngIf="!a.target_type" class="text-slate-400">-</span>
                </td>
                <td class="px-5 py-3 text-xs text-slate-600 max-w-md truncate" [title]="a.detail || ''">
                  {{ formatDetail(a.detail) }}
                </td>
              </tr>
              <tr *ngIf="!logs.length">
                <td colspan="6" class="px-5 py-16 text-center text-slate-400 text-sm">暂无日志</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class AuditPage implements OnInit {
  filters: any = { user_id: '', action: '' };
  logs: any[] = [];
  users: any[] = [];
  constructor(private api: ApiService) {}

  ngOnInit() { this.loadAll(); }
  async loadAll() {
    this.users = await this.api.users();
    this.reload();
  }
  async reload() {
    this.logs = await this.api.auditLogs({ ...this.filters, size: 100 });
  }
  roleCls(r: string) {
    return ({
      CSM: 'bg-blue-100 text-blue-700', DELIVERY: 'bg-purple-100 text-purple-700', DIRECTOR: 'bg-orange-100 text-orange-700'
    } as any)[r] || 'bg-slate-100';
  }
  formatDetail(d: string) {
    if (!d) return '-';
    try { return JSON.stringify(JSON.parse(d)); } catch { return d; }
  }
}
