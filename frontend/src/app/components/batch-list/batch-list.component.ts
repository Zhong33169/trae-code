import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import {
  BatchChange, AuditLog, User,
  BATCH_STATUS_LABELS, BATCH_ITEM_STATUS_LABELS,
  STATUS_LABELS
} from '../../models';

@Component({
  selector: 'app-batch-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="batch-page">
      <div class="page-header">
        <div class="title-group">
          <h2>📋 批量变更批次</h2>
          <span class="count-badge">共 {{ batches.length }} 个批次</span>
        </div>
        <button (click)="refresh()" class="btn btn-secondary">🔄 刷新</button>
      </div>

      <div class="content-split">
        <div class="batch-list-panel">
          <table class="batch-table">
            <thead>
              <tr>
                <th>批次号</th>
                <th>目标状态</th>
                <th>状态</th>
                <th>总数</th>
                <th>成功</th>
                <th>失败</th>
                <th>操作人</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              <tr
                *ngFor="let b of batches"
                (click)="selectBatch(b)"
                [class.selected]="selectedBatch?.id === b.id"
                class="batch-row"
              >
                <td class="batch-no">{{ b.batch_no }}</td>
                <td>{{ b.target_status ? STATUS_LABELS[b.target_status] : '—' }}</td>
                <td>
                  <span class="status-tag" [class]="'status-' + b.status">
                    {{ BATCH_STATUS_LABELS[b.status] }}
                  </span>
                </td>
                <td class="num">{{ b.total_count }}</td>
                <td class="num success">{{ b.success_count }}</td>
                <td class="num failed">{{ b.failed_count }}</td>
                <td>{{ b.operator_id }}</td>
                <td class="time">{{ formatTime(b.created_at) }}</td>
              </tr>
              <tr *ngIf="batches.length === 0">
                <td colspan="8" class="empty-row">暂无批次数据</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="detail-panel" *ngIf="selectedBatch">
          <div class="detail-header">
            <div>
              <h3>{{ selectedBatch.batch_no }}</h3>
              <span class="status-tag" [class]="'status-' + selectedBatch.status">
                {{ BATCH_STATUS_LABELS[selectedBatch.status] }}
              </span>
              <span *ngIf="selectedBatch.target_status" class="target-tag">
                目标：{{ STATUS_LABELS[selectedBatch.target_status] }}
              </span>
            </div>
            <div class="action-group">
              <button
                *ngIf="hasFailedItems"
                (click)="retryAllFailed()"
                class="btn btn-warn"
              >
                🔄 重试全部失败项 ({{ failedCount }})
              </button>
              <button
                *ngIf="selectedRetryIds.length > 0"
                (click)="retrySelected()"
                class="btn btn-primary"
              >
                🔁 重试选中 ({{ selectedRetryIds.length }})
              </button>
            </div>
          </div>

          <div class="stats-row">
            <div class="stat-card total"><div class="stat-num">{{ selectedBatch.total_count }}</div><div class="stat-label">总数</div></div>
            <div class="stat-card success"><div class="stat-num">{{ selectedBatch.success_count }}</div><div class="stat-label">成功</div></div>
            <div class="stat-card failed"><div class="stat-num">{{ selectedBatch.failed_count }}</div><div class="stat-label">失败</div></div>
          </div>

          <div class="detail-section">
            <h4>📦 明细项</h4>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width:40px;"></th>
                  <th>订单号</th>
                  <th>状态</th>
                  <th>重试次数</th>
                  <th>处理时间</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  *ngFor="let item of selectedBatch.items"
                  [class.item-failed]="item.status === 'failed'"
                  [class.item-success]="item.status === 'success'"
                >
                  <td>
                    <input
                      *ngIf="item.status === 'failed' || item.status === 'retry_pending'"
                      type="checkbox"
                      [checked]="selectedRetryIds.includes(item.id)"
                      (change)="toggleRetry(item.id)"
                    />
                  </td>
                  <td class="order-no">{{ item.order_no }}</td>
                  <td>
                    <span class="item-status" [class]="'item-' + item.status">
                      {{ BATCH_ITEM_STATUS_LABELS[item.status] }}
                    </span>
                  </td>
                  <td>{{ item.retry_count }}</td>
                  <td class="time">{{ item.processed_at ? formatTime(item.processed_at) : '—' }}</td>
                </tr>
              </tbody>
            </table>
            <div *ngIf="hasFailedItems" class="error-details">
              <h5>❌ 失败项详情</h5>
              <div *ngFor="let item of failedItems" class="error-item">
                <div class="error-header">
                  <span class="order-no">{{ item.order_no }}</span>
                  <span class="item-status item-failed">{{ BATCH_ITEM_STATUS_LABELS[item.status] }}</span>
                </div>
                <div class="error-message">{{ item.error_message }}</div>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h4>📜 批次审计日志</h4>
            <div class="audit-list" *ngIf="auditLogs.length > 0">
              <div *ngFor="let log of auditLogs" class="audit-item" [class.audit-item-failed]="!!log.failure_reason">
                <span class="audit-time">{{ formatTime(log.created_at) }}</span>
                <span class="audit-user">{{ log.username }}</span>
                <span class="audit-action">{{ log.action }}</span>
                <span class="audit-detail">{{ log.detail }}</span>
                <span class="audit-failure" *ngIf="log.failure_reason">❌ {{ log.failure_reason }}</span>
              </div>
            </div>
            <div *ngIf="auditLogs.length === 0" class="empty-tip">暂无审计记录</div>
          </div>
        </div>

        <div class="detail-panel empty-panel" *ngIf="!selectedBatch">
          <div class="empty-hint">
            <div class="empty-icon">←</div>
            <p>请从左侧选择一个批次查看明细、失败详情与重试操作</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .batch-page { display: flex; flex-direction: column; gap: 16px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; background: white; padding: 14px 20px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .title-group { display: flex; align-items: center; gap: 12px; }
    .title-group h2 { font-size: 18px; }
    .count-badge { background: #ede9fe; color: #6d28d9; padding: 3px 10px; border-radius: 12px; font-size: 12px; }

    .btn { padding: 7px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s; }
    .btn-primary { background: #2563eb; color: white; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
    .btn-warn { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }
    .btn-warn:hover { box-shadow: 0 3px 8px rgba(245,158,11,0.3); }

    .content-split { display: grid; grid-template-columns: 1fr 600px; gap: 16px; }

    .batch-list-panel { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); max-height: calc(100vh - 180px); overflow-y: auto; }
    .batch-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .batch-table thead { position: sticky; top: 0; background: #f9fafb; z-index: 1; }
    .batch-table th, .batch-table td { padding: 11px 14px; text-align: left; border-bottom: 1px solid #f3f4f6; }
    .batch-table th { font-weight: 600; color: #374151; font-size: 12px; }
    .batch-row { cursor: pointer; transition: background 0.15s; }
    .batch-row:hover { background: #f9fafb; }
    .batch-row.selected { background: #f5f3ff; }
    .batch-no { font-family: monospace; color: #6d28d9; font-weight: 500; }
    .num { text-align: center; font-family: monospace; }
    .num.success { color: #059669; font-weight: 600; }
    .num.failed { color: #dc2626; font-weight: 600; }
    .time { color: #6b7280; font-size: 12px; }
    .empty-row { text-align: center; padding: 40px !important; color: #9ca3af; }

    .status-tag { display: inline-block; padding: 2px 10px; border-radius: 10px; color: white; font-size: 11px; font-weight: 500; }
    .status-pending { background: #9ca3af; }
    .status-processing { background: #3b82f6; }
    .status-partial_success { background: #f59e0b; }
    .status-all_success { background: #10b981; }
    .status-all_failed { background: #ef4444; }

    .detail-panel { background: white; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); padding: 18px; max-height: calc(100vh - 180px); overflow-y: auto; }
    .empty-panel { display: flex; align-items: center; justify-content: center; }
    .empty-hint { text-align: center; color: #9ca3af; }
    .empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.4; }

    .detail-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 1px solid #f3f4f6; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
    .detail-header h3 { font-size: 16px; margin-bottom: 6px; }
    .detail-header .status-tag { margin-right: 8px; }
    .target-tag { background: #eef2ff; color: #4338ca; padding: 2px 10px; border-radius: 10px; font-size: 11px; }
    .action-group { display: flex; gap: 8px; flex-wrap: wrap; }

    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
    .stat-card { padding: 14px; border-radius: 8px; text-align: center; }
    .stat-card.total { background: #f3f4f6; }
    .stat-card.success { background: #d1fae5; }
    .stat-card.failed { background: #fee2e2; }
    .stat-num { font-size: 24px; font-weight: 700; font-family: monospace; }
    .stat-label { font-size: 12px; color: #6b7280; margin-top: 2px; }

    .detail-section { margin-bottom: 18px; }
    .detail-section h4 { font-size: 14px; color: #374151; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #f5f3ff; }
    .detail-section h5 { font-size: 13px; color: #991b1b; margin-bottom: 8px; margin-top: 12px; }

    .items-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .items-table th, .items-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #f3f4f6; }
    .items-table th { font-weight: 600; background: #fafafa; color: #374151; font-size: 11px; }
    .items-table .item-failed { background: #fef2f2; }
    .items-table .item-success { background: #f0fdf4; }
    .order-no { font-family: monospace; }

    .item-status { display: inline-block; padding: 1px 8px; border-radius: 8px; font-size: 11px; font-weight: 500; }
    .item-pending { background: #e5e7eb; color: #374151; }
    .item-success { background: #d1fae5; color: #065f46; }
    .item-failed { background: #fee2e2; color: #991b1b; }
    .item-retry_pending { background: #fef3c7; color: #92400e; }

    .error-details { margin-top: 10px; }
    .error-item { padding: 10px; background: #fef2f2; border-left: 3px solid #ef4444; border-radius: 4px; margin-bottom: 6px; }
    .error-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .error-message { font-size: 12px; color: #7f1d1d; font-family: monospace; }

    .audit-list { display: flex; flex-direction: column; gap: 6px; }
    .audit-item { display: flex; flex-wrap: wrap; gap: 8px; padding: 7px 10px; background: #fafafa; border-radius: 5px; font-size: 12px; }
    .audit-time { color: #9ca3af; font-family: monospace; }
    .audit-user { font-weight: 500; color: #6d28d9; }
    .audit-action { background: #f5f3ff; color: #6d28d9; padding: 1px 7px; border-radius: 4px; }
    .audit-detail { color: #6b7280; flex: 1; }
    .audit-failure { color: #b91c1c; background: #fef2f2; padding: 1px 7px; border-radius: 4px; flex: 100%; font-family: monospace; }
    .audit-item-failed { border-left: 3px solid #ef4444; background: #fff5f5; }

    .empty-tip { color: #9ca3af; font-size: 13px; padding: 12px; text-align: center; background: #fafafa; border-radius: 6px; }
  `]
})
export class BatchListComponent implements OnInit {
  private api = inject(ApiService);

  BATCH_STATUS_LABELS = BATCH_STATUS_LABELS;
  BATCH_ITEM_STATUS_LABELS = BATCH_ITEM_STATUS_LABELS;
  STATUS_LABELS = STATUS_LABELS;

  batches: BatchChange[] = [];
  selectedBatch: BatchChange | null = null;
  auditLogs: AuditLog[] = [];
  selectedRetryIds: number[] = [];
  currentUser: User | null = null;

  ngOnInit() {
    this.api.getCurrentUser().subscribe((u) => {
      this.currentUser = u;
      this.selectedRetryIds = [];
      if (u) {
        this.refresh();
      } else {
        this.batches = [];
        this.selectedBatch = null;
        this.auditLogs = [];
      }
    });
  }

  get hasFailedItems() {
    return this.selectedBatch?.items.some((i) => i.status === 'failed' || i.status === 'retry_pending') ?? false;
  }

  get failedItems() {
    return this.selectedBatch?.items.filter((i) => i.status === 'failed' || i.status === 'retry_pending') ?? [];
  }

  get failedCount() {
    return this.failedItems.length;
  }

  refresh() {
    this.api.listBatches().subscribe((batches) => {
      this.batches = batches;
      if (this.selectedBatch) {
        const updated = batches.find((b) => b.id === this.selectedBatch!.id);
        if (updated) this.selectBatch(updated);
      }
    });
  }

  selectBatch(batch: BatchChange) {
    this.selectedBatch = batch;
    this.selectedRetryIds = [];
    this.api.listAuditLogs(undefined, batch.id).subscribe((logs) => {
      this.auditLogs = logs;
    });
  }

  toggleRetry(id: number) {
    const idx = this.selectedRetryIds.indexOf(id);
    if (idx >= 0) this.selectedRetryIds.splice(idx, 1);
    else this.selectedRetryIds.push(id);
  }

  retryAllFailed() {
    if (!this.selectedBatch || !this.hasFailedItems) return;
    const ids = this.failedItems.map((i) => i.id);
    this.api.retryBatch(this.selectedBatch.id, ids).subscribe({
      next: (batch) => {
        this.selectBatch(batch);
        this.refresh();
        alert(`重试完成：成功 ${batch.success_count} 条，失败 ${batch.failed_count} 条`);
      },
      error: (e) => alert('重试失败：' + e.message),
    });
  }

  retrySelected() {
    if (!this.selectedBatch || this.selectedRetryIds.length === 0) return;
    this.api.retryBatch(this.selectedBatch.id, this.selectedRetryIds).subscribe({
      next: (batch) => {
        this.selectBatch(batch);
        this.selectedRetryIds = [];
        this.refresh();
        alert(`重试完成：成功 ${batch.success_count} 条，失败 ${batch.failed_count} 条`);
      },
      error: (e) => alert('重试失败：' + e.message),
    });
  }

  formatTime(s: string) {
    if (!s) return '';
    const d = new Date(s);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}
