import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-batch-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="max-w-[1400px] mx-auto p-6">
      <div class="mb-5">
        <a routerLink="/batches" class="text-slate-500 hover:text-primary">← 返回批次中心</a>
      </div>

      <div *ngIf="batch" class="space-y-6">
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div class="flex items-start justify-between">
            <div>
              <div class="text-xs text-slate-400 font-mono mb-1">批次号</div>
              <h2 class="text-2xl font-bold text-slate-800">{{ batch.batch_no }}</h2>
              <div class="mt-2 flex items-center gap-3 text-sm">
                <span class="px-2 py-0.5 rounded text-xs" [ngClass]="actionCls(batch.action)">{{ actionLabel(batch.action) }}</span>
                <span class="text-slate-500">创建人：{{ batch.creator_name }}</span>
                <span class="text-slate-400">{{ batch.created_at }}</span>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-4 text-center">
              <div class="px-6 py-4 bg-slate-50 rounded-lg">
                <div class="text-xs text-slate-500">总数</div>
                <div class="text-2xl font-bold">{{ batch.total_count }}</div>
              </div>
              <div class="px-6 py-4 bg-green-50 rounded-lg">
                <div class="text-xs text-green-700">成功</div>
                <div class="text-2xl font-bold text-success">{{ batch.success_count }}</div>
              </div>
              <div class="px-6 py-4 bg-red-50 rounded-lg">
                <div class="text-xs text-red-700">失败</div>
                <div class="text-2xl font-bold text-danger">{{ batch.failed_count }}</div>
              </div>
            </div>
          </div>
          <div *ngIf="batch.failed_count > 0" class="mt-5 p-4 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-between">
            <div>
              <div class="font-semibold text-orange-700">⚠️ 有 {{ batch.failed_count }} 项失败</div>
              <div class="text-xs text-orange-600 mt-1">请先在计划单详情中修复问题（上传证据、确认版本等），再点击右侧按钮重试</div>
            </div>
            <div class="flex items-center gap-3">
              <textarea [(ngModel)]="comment" rows="2" placeholder="备注（驳回时必填）"
                class="px-3 py-2 border border-orange-200 rounded text-xs w-56 bg-white"></textarea>
              <button (click)="retry()" class="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm font-medium">
                🔁 重试失败项
              </button>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 class="font-semibold text-slate-800">批次明细（失败项不会被吞掉 ✨）</h3>
            <div class="flex items-center gap-2 text-xs">
              <button (click)="filter = 'all'" [ngClass]="{'bg-primary text-white': filter==='all'}" class="px-3 py-1 rounded border border-slate-200">全部</button>
              <button (click)="filter = 'SUCCESS'" [ngClass]="{'bg-green-600 text-white': filter==='SUCCESS'}" class="px-3 py-1 rounded border border-slate-200">成功</button>
              <button (click)="filter = 'FAILED'" [ngClass]="{'bg-red-600 text-white': filter==='FAILED'}" class="px-3 py-1 rounded border border-slate-200">失败</button>
            </div>
          </div>
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-500">
              <tr class="text-left">
                <th class="px-5 py-3">结果</th>
                <th class="px-5 py-3">计划单</th>
                <th class="px-5 py-3">操作时状态</th>
                <th class="px-5 py-3">版本</th>
                <th class="px-5 py-3">缺失证据</th>
                <th class="px-5 py-3">重试</th>
                <th class="px-5 py-3">错误信息</th>
                <th class="px-5 py-3">办理</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let it of filteredItems" class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-5 py-3">
                  <span *ngIf="it.status==='SUCCESS'" class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                    ✅ 成功
                  </span>
                  <span *ngIf="it.status==='FAILED'" class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
                    ❌ 失败
                  </span>
                </td>
                <td class="px-5 py-3">
                  <div class="text-xs font-mono text-slate-400">{{ it.plan_no }}</div>
                  <div class="font-medium">{{ it.title }}</div>
                </td>
                <td class="px-5 py-3">
                  <span class="text-xs px-2 py-0.5 rounded" [ngClass]="statusBadge(it.current_status)">{{ it.current_status }}</span>
                </td>
                <td class="px-5 py-3 text-xs text-slate-500">v{{ it.plan_version || '-' }}</td>
                <td class="px-5 py-3">
                  <div *ngIf="it.status === 'FAILED' && it.missing_labels?.length" class="flex flex-wrap gap-1">
                    <span *ngFor="let ml of it.missing_labels" class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">缺{{ ml }}</span>
                  </div>
                  <div *ngIf="it.status === 'FAILED' && it.uploadable_evidence?.length" class="mt-1">
                    <button (click)="openItemUpload(it)" class="text-[10px] px-2 py-0.5 rounded bg-primary text-white hover:bg-blue-700">📎 补传</button>
                  </div>
                  <div *ngIf="it.status === 'FAILED' && !it.missing_labels?.length" class="text-xs text-slate-400">非证据原因</div>
                  <div *ngIf="it.status === 'SUCCESS'" class="text-xs text-slate-400">-</div>
                </td>
                <td class="px-5 py-3 text-xs">{{ it.retry_count || 0 }}</td>
                <td class="px-5 py-3 max-w-xs">
                  <div *ngIf="it.status === 'SUCCESS'" class="text-slate-400 text-xs">-</div>
                  <div *ngIf="it.status === 'FAILED'" class="text-danger text-xs">
                    <span class="font-mono text-[10px] px-1.5 py-0.5 bg-red-100 rounded mr-1">{{ it.error_code }}</span>
                    {{ it.error_message }}
                  </div>
                </td>
                <td class="px-5 py-3">
                  <a [routerLink]="['/plan', it.plan_id]" class="text-xs px-3 py-1 bg-primary text-white rounded hover:bg-blue-700">去办理</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div *ngIf="showItemUpload" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" (click)="showItemUpload = false">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" (click)="$event.stopPropagation()">
          <h3 class="text-lg font-bold mb-2">📎 补传证据</h3>
          <div class="text-sm text-slate-500 mb-3">{{ uploadItem?.plan_no }} - {{ uploadItem?.title }} (v{{ uploadItem?.plan_version }})</div>
          <div *ngFor="let ev of uploadItem?.uploadable_evidence || []" class="mb-3 p-3 rounded-lg border border-slate-200">
            <div class="font-medium text-sm mb-2">{{ ev.label }} ({{ ev.type }})</div>
            <div class="grid grid-cols-2 gap-2">
              <input [(ngModel)]="uploadForm[ev.type].name" placeholder="文件名" class="px-3 py-1.5 border border-slate-200 rounded text-sm">
              <input [(ngModel)]="uploadForm[ev.type].url" placeholder="文件路径" class="px-3 py-1.5 border border-slate-200 rounded text-sm">
            </div>
          </div>
          <div class="mt-4 flex justify-end gap-3">
            <button (click)="showItemUpload = false" class="px-4 py-2 border border-slate-200 rounded-lg text-sm">取消</button>
            <button (click)="doItemUpload()" class="px-4 py-2 bg-primary text-white rounded-lg text-sm">上传并刷新</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class BatchDetailPage implements OnInit {
  batch: any = null;
  filter = 'all';
  comment = '';
  showItemUpload = false;
  uploadItem: any = null;
  uploadForm: any = {};
  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit() {
    this.route.params.subscribe(async p => {
      this.batch = await this.api.batchDetail(Number(p['id']));
    });
  }

  get filteredItems() {
    if (!this.batch) return [];
    if (this.filter === 'all') return this.batch.items;
    return this.batch.items.filter((i: any) => i.status === this.filter);
  }

  async retry() {
    try {
      const res = await this.api.batchRetry(this.batch.id, { comment: this.comment });
      if (res.code === 0) {
        const d = res.data;
        (window as any).showToast?.(d.retry_failed > 0 ? 'warning' : 'success',
          `批次${d.batch_no}重试完成`, `成功${d.retry_success}，失败${d.retry_failed}（累计：成功${d.total_success}/失败${d.total_failed}）`);
        this.batch = await this.api.batchDetail(this.batch.id);
      } else {
        (window as any).showToast?.('error', '重试失败', res.message);
      }
    } catch (e: any) {
      (window as any).showToast?.('error', '重试失败', e.error?.message || e.message);
    }
  }

  actionLabel(a: string) {
    return ({ submit: '提交核验', resubmit: '重新提交', verify_pass: '核验通过', confirm_pass: '确认归档', reject: '驳回' } as any)[a] || a;
  }
  actionCls(a: string) {
    if (a.includes('pass') || a === 'submit' || a === 'resubmit') return 'bg-green-50 text-green-700';
    if (a === 'reject') return 'bg-red-50 text-red-700';
    return 'bg-slate-50 text-slate-700';
  }
  statusBadge(s: string) {
    return ({
      DRAFT: 'bg-slate-100 text-slate-700', PENDING_REVIEW: 'bg-blue-100 text-blue-700',
      PENDING_CONFIRM: 'bg-purple-100 text-purple-700', COMPLETED: 'bg-green-100 text-green-700',
      REJECTED: 'bg-red-100 text-red-700'
    } as any)[s] || 'bg-slate-100';
  }

  openItemUpload(it: any) {
    this.uploadItem = it;
    this.uploadForm = {};
    for (const ev of (it.uploadable_evidence || [])) {
      this.uploadForm[ev.type] = { name: '', url: '' };
    }
    this.showItemUpload = true;
  }

  async doItemUpload() {
    let uploaded = 0;
    for (const ev of (this.uploadItem?.uploadable_evidence || [])) {
      const form = this.uploadForm[ev.type];
      if (form.name && form.url) {
        try {
          const res = await this.api.uploadEvidence(this.uploadItem.plan_id, {
            evidence_type: ev.type,
            name: form.name,
            url: form.url,
            version: this.uploadItem.plan_version,
            batch_item_id: this.uploadItem.item_id,
            source: 'batch_detail'
          });
          if (res.code === 0) uploaded++;
        } catch {}
      }
    }
    this.showItemUpload = false;
    if (uploaded > 0) {
      (window as any).showToast?.('success', '补传成功', `已上传 ${uploaded} 份证据，刷新批次详情`);
      this.batch = await this.api.batchDetail(this.batch.id);
    } else {
      (window as any).showToast?.('warning', '未上传', '请填写文件名和路径');
    }
  }
}
