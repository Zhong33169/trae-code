import { Component, inject, signal, effect, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Batch, ROLE_LABELS, ACTION_LABELS, ActionType } from '../../core/models';

@Component({
  selector: 'app-batch-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container">
      <div style="margin-bottom:14px;display:flex;align-items:center;gap:12px">
        <a routerLink="/" class="btn btn-ghost btn-sm">← 返回队列</a>
        <h2 style="font-size:20px">批量变更工作台</h2>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>批次列表</h3>
          <span class="muted tiny">{{ batches().length }} 个批次</span>
        </div>
        <div style="overflow:auto">
          @if (batches().length === 0) {
            <div class="empty">暂无批次。在续保任务队列中选择任务后执行批量操作即可生成批次。</div>
          } @else {
            <table class="tbl">
              <thead>
                <tr>
                  <th>批次号</th>
                  <th>操作</th>
                  <th>操作人</th>
                  <th>总数</th>
                  <th>成功</th>
                  <th>失败</th>
                  <th>进度</th>
                  <th>时间</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (b of batches(); track b.id) {
                  <tr>
                    <td class="mono" style="font-weight:600">{{ b.batchNo }}</td>
                    <td>{{ actionLabel(b.action) }}</td>
                    <td>{{ b.operatorName }} <span class="muted tiny">({{ roleLabel(b.operatorRole) }})</span></td>
                    <td class="mono">{{ b.total }}</td>
                    <td class="mono" style="color:var(--green)">{{ b.successCount }}</td>
                    <td class="mono" style="color:var(--red)">{{ b.failCount }}</td>
                    <td>
                      <div class="countbar" style="width:80px" [title]="'成功 '+b.successCount+' / 失败 '+b.failCount">
                        <div class="s" [style.width.%]="b.total>0?(b.successCount/b.total*100):0"></div>
                        <div class="f" [style.width.%]="b.total>0?(b.failCount/b.total*100):0"></div>
                      </div>
                    </td>
                    <td class="mono tiny">{{ b.createdAt }}</td>
                    <td><a [routerLink]="['/batches', b.id]" class="btn btn-sm">查看明细</a></td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>
    </div>
  `,
})
export class BatchListComponent {
  private api = inject(ApiService);
  auth = inject(AuthService);

  batches = signal<Batch[]>([]);

  roleLabel = (r: string) => ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r;
  actionLabel = (a: string) => ACTION_LABELS[a as ActionType] ?? a;

  constructor() {
    effect(() => {
      this.auth.user();
      untracked(() => this.load());
    });
  }

  async load() {
    try {
      const list = await this.api.listBatches();
      this.batches.set(list);
    } catch { this.batches.set([]); }
  }
}
