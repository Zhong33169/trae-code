import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-batches',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="max-w-[1400px] mx-auto p-6">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-slate-800">批次中心</h2>
          <p class="text-sm text-slate-500 mt-1">批量操作产生的批次，支持查看结果和失败项重试</p>
        </div>
        <div class="flex items-center gap-3">
          <button (click)="reload()" class="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm">🔄 刷新</button>
          <a routerLink="/queue" class="px-4 py-2 bg-primary text-white rounded-lg text-sm">返回队列 →</a>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div class="text-xs text-slate-500">批次总数</div>
          <div class="text-3xl font-bold mt-1 text-slate-800">{{ data.total || 0 }}</div>
        </div>
        <div class="bg-green-50 border border-green-200 rounded-xl p-5">
          <div class="text-xs text-green-700">全部成功</div>
          <div class="text-3xl font-bold mt-1 text-green-600">{{ fullSuccess }}</div>
        </div>
        <div class="bg-red-50 border border-red-200 rounded-xl p-5">
          <div class="text-xs text-red-700">存在失败</div>
          <div class="text-3xl font-bold mt-1 text-red-600">{{ hasFailed }}</div>
        </div>
        <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <div class="text-xs text-yellow-700">累计失败项（可重试）</div>
          <div class="text-3xl font-bold mt-1 text-yellow-600">{{ totalFailItems }}</div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th class="px-5 py-4">批次号</th>
              <th class="px-5 py-4">操作</th>
              <th class="px-5 py-4">创建人</th>
              <th class="px-5 py-4">总数</th>
              <th class="px-5 py-4">成功</th>
              <th class="px-5 py-4">失败</th>
              <th class="px-5 py-4">创建时间</th>
              <th class="px-5 py-4">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let b of list" class="border-t border-slate-100 hover:bg-blue-50/30">
              <td class="px-5 py-4">
                <a [routerLink]="['/batch', b.id]" class="font-mono text-primary font-medium hover:underline">{{ b.batch_no }}</a>
              </td>
              <td class="px-5 py-4">
                <span class="px-2 py-0.5 rounded text-xs" [ngClass]="actionCls(b.action)">{{ actionLabel(b.action) }}</span>
              </td>
              <td class="px-5 py-4 text-slate-600">{{ b.creator_name }}</td>
              <td class="px-5 py-4 font-medium">{{ b.total_count }}</td>
              <td class="px-5 py-4 text-success font-medium">{{ b.success_count }}</td>
              <td class="px-5 py-4">
                <span *ngIf="b.failed_count === 0" class="text-slate-400">0</span>
                <span *ngIf="b.failed_count > 0" class="text-danger font-semibold">{{ b.failed_count }}</span>
              </td>
              <td class="px-5 py-4 text-xs text-slate-500">{{ b.created_at }}</td>
              <td class="px-5 py-4">
                <a [routerLink]="['/batch', b.id]" class="text-xs px-3 py-1 border border-slate-200 rounded hover:border-primary hover:text-primary">详情</a>
              </td>
            </tr>
            <tr *ngIf="!list.length">
              <td colspan="8" class="px-5 py-16 text-center text-slate-400 text-sm">暂无批次，去队列中做一次批量操作试试 →</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class BatchesPage implements OnInit {
  data: any = { list: [], total: 0 };
  list: any[] = [];
  constructor(private api: ApiService) {}

  ngOnInit() { this.reload(); }
  async reload() {
    this.data = await this.api.batches({ size: 50 });
    this.list = this.data.list;
  }

  get fullSuccess() { return this.list.filter((b: any) => b.failed_count === 0).length; }
  get hasFailed() { return this.list.filter((b: any) => b.failed_count > 0).length; }
  get totalFailItems() { return this.list.reduce((s: number, b: any) => s + (b.failed_count || 0), 0); }

  actionLabel(a: string) {
    return ({ submit: '提交核验', resubmit: '重新提交', verify_pass: '核验通过', confirm_pass: '确认归档', reject: '驳回' } as any)[a] || a;
  }
  actionCls(a: string) {
    if (a.includes('pass') || a === 'submit' || a === 'resubmit') return 'bg-green-50 text-green-700';
    if (a === 'reject') return 'bg-red-50 text-red-700';
    return 'bg-slate-50 text-slate-700';
  }
}
