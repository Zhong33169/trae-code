import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TopicService, AuditLog, ImportBatch } from '../../services/topic.service';

@Component({
  selector: 'app-audit-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>审计日志</h2>
      </div>

      <div class="card">
        <div class="filters">
          <div class="filter-item flex-1">
            <label>按导入批次筛选（可选）</label>
            <select [(ngModel)]="filterBatchId" class="input">
              <option value="">全部批次 / 不筛选</option>
              <option *ngFor="let b of batches()" [value]="b.id">{{ b.batch_no }} - {{ b.source }}</option>
            </select>
          </div>
          <div class="filter-item flex-1">
            <label>选题单ID（可选，留空查询全部）</label>
            <input [(ngModel)]="filterTopicId" class="input" placeholder="选题单ID" />
          </div>
          <div class="filter-item">
            <button class="btn-primary" (click)="load()">查询</button>
          </div>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>操作人</th>
              <th>动作</th>
              <th>状态变更</th>
              <th>关联选题</th>
              <th>关联批次</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let log of logs()">
              <td>{{ log.created_at | slice : 0 : 19 }}</td>
              <td>{{ log.user_name }} <span class="muted">(id: {{ log.user_id | slice : 0 : 8 }})</span></td>
              <td>
                <div><span class="act act-{{ log.action }}">{{ actionLabel(log.action) }}</span></div>
                <div *ngIf="log.process_stage" class="stage-tag">{{ stageLabel(log.process_stage) }}</div>
              </td>
              <td>
                <span *ngIf="log.old_status" class="status-mini status-{{ log.old_status }}">{{ statusLabel(log.old_status) }}</span>
                <span *ngIf="log.old_status && log.new_status"> → </span>
                <span *ngIf="log.new_status" class="status-mini status-{{ log.new_status }}">{{ statusLabel(log.new_status) }}</span>
                <span *ngIf="!log.old_status && !log.new_status">-</span>
              </td>
              <td>
                <a *ngIf="log.topic_id" [routerLink]="['/topics', log.topic_id]" class="link">查看</a>
                <span *ngIf="!log.topic_id" class="muted">全局</span>
              </td>
              <td>
                <span *ngIf="log.import_batch_id" class="muted" style="font-family: monospace; font-size: 12px;">{{ log.import_batch_id | slice : 0 : 8 }}</span>
                <span *ngIf="!log.import_batch_id" class="muted">-</span>
              </td>
              <td style="max-width: 400px;">
                <div *ngIf="log.decision_summary" class="decision-summary">{{ log.decision_summary }}</div>
                <div *ngIf="!log.decision_summary">{{ log.detail || '-' }}</div>
                <div *ngIf="log.detail && log.decision_summary" class="muted" style="margin-top: 4px; font-size: 12px;">{{ log.detail }}</div>
                <div *ngIf="log.field_snapshot_old && log.field_snapshot_new" class="snapshot-area">
                  <button class="btn-link snapshot-btn" (click)="toggleSnapshot(log.id)">
                    {{ snapshotExpanded()[log.id] ? '收起字段快照' : '展开字段快照' }}
                  </button>
                  <div *ngIf="snapshotExpanded()[log.id]" class="snapshot-compare">
                    <div class="snapshot-col">
                      <div class="muted" style="font-size: 11px;">原值：</div>
                      <pre class="snapshot-pre">{{ formatSnapshot(log.field_snapshot_old) }}</pre>
                    </div>
                    <div class="snapshot-col">
                      <div class="muted" style="font-size: 11px;">新值：</div>
                      <pre class="snapshot-pre">{{ formatSnapshot(log.field_snapshot_new) }}</pre>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
            <tr *ngIf="logs().length === 0"><td colspan="7" class="empty">暂无记录</td></tr>
          </tbody>
        </table>

        <div class="muted" style="margin-top: 12px; font-size: 12px;">
          审计日志包含：登记、审核通过、退回、复核归档、补正重提、上传附件、离线回填成功/冲突/失败等所有操作及失败原因。
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .page { display: flex; flex-direction: column; gap: 16px; }
      .page-header h2 { margin: 0; color: #1f3a68; }
      .card { background: #fff; border-radius: 6px; padding: 18px; }
      .filters { display: flex; gap: 12px; align-items: end; margin-bottom: 14px; }
      .filter-item { display: flex; flex-direction: column; gap: 4px; }
      .filter-item label { font-size: 12px; color: #666; }
      .filter-item.flex-1 { flex: 1; }
      .input { padding: 6px 10px; border: 1px solid #cfd8e3; border-radius: 4px; font-size: 14px; }
      .btn-primary { padding: 6px 14px; background: #1f3a68; color: #fff; border: 0; border-radius: 4px; cursor: pointer; }
      .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .data-table th { background: #eef2fb; padding: 10px; text-align: left; color: #445; font-weight: 600; }
      .data-table td { padding: 10px; border-top: 1px solid #eef0f5; vertical-align: top; }
      .data-table .empty { text-align: center; color: #999; padding: 40px 0; }
      .muted { color: #888; font-size: 12px; }
      .link { color: #1f5fb0; text-decoration: none; }
      .act { padding: 2px 10px; border-radius: 10px; font-size: 12px; display: inline-block; }
      .act-create { background: #e3f0ff; color: #1f5fb0; }
      .act-approve { background: #d8f3df; color: #1d7a38; }
      .act-reject { background: #fde0dc; color: #a53225; }
      .act-archive { background: #efe2fb; color: #6b3ea5; }
      .act-rectify { background: #fff3d6; color: #a76b12; }
      .act-upload_attachment { background: #e3f0ff; color: #1f5fb0; }
      .act-import_create { background: #d8f3df; color: #1d7a38; }
      .act-import_conflict { background: #fff3d6; color: #a76b12; }
      .act-import_error { background: #fde0dc; color: #a53225; }
      .act-conflict_submit { background: #e3f0ff; color: #1f5fb0; }
      .act-conflict_resolve { background: #d8f3df; color: #1d7a38; }
      .act-conflict_ignore { background: #eee; color: #666; }
      .status-mini { padding: 1px 6px; border-radius: 8px; font-size: 12px; }
      .status-registered { background: #e3f0ff; color: #1f5fb0; }
      .status-reviewed { background: #fff3d6; color: #a76b12; }
      .status-archived { background: #d8f3df; color: #1d7a38; }
      .status-rejected { background: #fde0dc; color: #a53225; }
      .stage-tag { margin-top: 4px; display: inline-block; padding: 1px 8px; background: #eef2fb; color: #1f3a68; border-radius: 8px; font-size: 11px; }
      .decision-summary { background: #f0f5ff; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #1f5fb0; }
      .snapshot-area { margin-top: 6px; }
      .snapshot-btn { font-size: 12px; }
      .snapshot-compare { display: flex; gap: 10px; margin-top: 4px; }
      .snapshot-col { flex: 1; }
      .snapshot-pre { margin: 0; font-size: 11px; background: #f7f9fc; padding: 6px; border-radius: 4px; white-space: pre-wrap; }
    `,
  ],
})
export class AuditPageComponent implements OnInit {
  logs = signal<AuditLog[]>([]);
  batches = signal<ImportBatch[]>([]);
  filterTopicId = '';
  filterBatchId = '';
  snapshotExpanded = signal<Record<string, boolean>>({});

  constructor(public auth: AuthService, private service: TopicService) {}

  ngOnInit() {
    this.loadBatches();
    this.load();
  }

  toggleSnapshot(id: string) {
    this.snapshotExpanded.update(m => ({ ...m, [id]: !m[id] }));
  }

  formatSnapshot(json?: string) {
    if (!json) return '-';
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  }

  stageLabel(s?: string) {
    const map: Record<string, string> = {
      submit: '阶段：登记员提交',
      resolve: '阶段：采纳线下',
      ignore: '阶段：保留线上',
    };
    return map[s || ''] || '';
  }

  loadBatches() {
    this.service.listBatches().subscribe((res) => {
      if (res.code === 0) this.batches.set(res.data || []);
    });
  }

  load() {
    const params: { topic_id?: string; batch_id?: string } = {};
    if (this.filterTopicId.trim()) params.topic_id = this.filterTopicId.trim();
    if (this.filterBatchId) params.batch_id = this.filterBatchId;
    this.service.listAudit(Object.keys(params).length ? params : undefined).subscribe((res) => {
      if (res.code === 0) this.logs.set(res.data || []);
    });
  }

  statusLabel(s?: string) {
    return ({ registered: '已登记', reviewed: '已审核', archived: '已归档', rejected: '已退回' } as Record<string, string>)[s || ''] || s;
  }

  actionLabel(a?: string) {
    return (
      {
        create: '登记',
        approve: '审核通过',
        reject: '退回',
        archive: '复核归档',
        rectify: '补正重提',
        upload_attachment: '上传附件',
        import_create: '离线回填·创建',
        import_conflict: '离线回填·冲突',
        import_error: '离线回填·失败',
        conflict_submit: '冲突·登记员提交',
        conflict_resolve: '冲突·采纳线下',
        conflict_ignore: '冲突·保留线上',
      } as Record<string, string>
    )[a || ''] || a;
  }
}
