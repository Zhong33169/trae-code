import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CheckinService } from '../../services/checkin.service';
import { AuditLog, STATUS_LABELS, STATUS_COLORS } from '../../models';

@Component({
  selector: 'app-audit',
  template: `
    <div class="page">
      <div class="page-header">
        <h2>审计日志 - 失败记录追溯</h2>
        <div class="header-hint">
          这里列出所有处理失败的值机记录，可回溯是谁、什么时候、为什么没处理成功
        </div>
      </div>

      <ng-container *ngIf="loaded">
        <div class="stats-bar">
          <div class="stat-item">
            <span class="stat-label">失败总计</span>
            <span class="stat-value">{{ logs.length }}</span>
          </div>
          <div class="stat-item stat-norecord">
            <span class="stat-label">无关联记录</span>
            <span class="stat-value">{{ noRecordLogs.length }}</span>
            <span class="stat-desc">（创建失败、记录不存在等）</span>
          </div>
          <div class="stat-item stat-linked">
            <span class="stat-label">值机记录关联</span>
            <span class="stat-value">{{ linkedLogs.length }}</span>
            <span class="stat-desc">（已绑定真实值机记录）</span>
          </div>
        </div>

        <!-- 无关联记录失败 - 独立类型展示 -->
        <div class="card norecord-card" *ngIf="noRecordLogs.length > 0">
          <div class="card-header">
            <h3 class="norecord-title">⚠️ 无关联记录失败</h3>
            <span class="norecord-hint">创建失败或记录不存在，无可跳转的详情页</span>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作人</th>
                <th>业务动作</th>
                <th>失败原因</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of noRecordLogs">
                <td class="mono small">{{ log.created_at?.substring(0, 19) }}</td>
                <td><b>{{ log.user_name }}</b></td>
                <td><span class="action-tag">{{ log.action }}</span></td>
                <td class="failure-cell">
                  <div class="failure-box">{{ log.failure_reason }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 值机记录关联失败 -->
        <div class="card linked-card" *ngIf="linkedLogs.length > 0">
          <div class="card-header">
            <h3 class="linked-title">📋 值机记录关联失败</h3>
            <span class="linked-hint">已绑定真实值机记录，可跳转查看详情</span>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>记录ID</th>
                <th>时间</th>
                <th>操作人</th>
                <th>动作</th>
                <th>状态变更</th>
                <th>详情</th>
                <th>失败原因</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of linkedLogs">
                <td class="mono"><b>#{{ log.checkin_record_id }}</b></td>
                <td class="mono small">{{ log.created_at?.substring(0, 19) }}</td>
                <td><b>{{ log.user_name }}</b></td>
                <td><span class="action-tag">{{ log.action }}</span></td>
                <td>
                  <span *ngIf="log.old_status" class="status-tag small" [style.background]="STATUS_COLORS[log.old_status]">
                    {{ STATUS_LABELS[log.old_status] }}
                  </span>
                  <span *ngIf="log.old_status && log.new_status"> → </span>
                  <span *ngIf="log.new_status" class="status-tag small" [style.background]="STATUS_COLORS[log.new_status]">
                    {{ STATUS_LABELS[log.new_status] }}
                  </span>
                </td>
                <td class="small">{{ log.detail || '-' }}</td>
                <td class="failure-cell">
                  <div class="failure-box">{{ log.failure_reason }}</div>
                </td>
                <td>
                  <button class="btn-link" (click)="goRecord(log.checkin_record_id)">查看记录</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div *ngIf="logs.length === 0" class="empty-card">
          <div class="empty">暂无失败记录</div>
        </div>
      </ng-container>

      <div class="stats-box" *ngIf="logs.length > 0">
        <h4>📊 统计说明</h4>
        <p>共 <b>{{ logs.length }}</b> 条失败记录，其中 <b>{{ noRecordLogs.length }}</b> 条无关联（创建失败/记录不存在），<b>{{ linkedLogs.length }}</b> 条绑定真实值机记录。</p>
        <p class="hint">所有操作（包括成功和失败）都会记录审计日志，点击「查看记录」可跳转到对应值机记录详情页查看完整日志。</p>
      </div>
    </div>
  `,
  styles: [
    `
    .page { display: flex; flex-direction: column; gap: 16px; }
    .page-header h2 { font-size: 20px; color: #1e293b; margin: 0 0 4px; }
    .header-hint { font-size: 13px; color: #64748b; }

    .stats-bar { display: flex; gap: 16px; background: white; border-radius: 8px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .stat-item { flex: 1; text-align: center; padding: 8px 12px; border-radius: 6px; }
    .stat-label { display: block; font-size: 12px; color: #64748b; margin-bottom: 4px; }
    .stat-value { display: block; font-size: 28px; font-weight: 700; color: #1e293b; line-height: 1.1; }
    .stat-desc { display: block; font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .stat-norecord { background: #fffbeb; }
    .stat-norecord .stat-value { color: #b45309; }
    .stat-linked { background: #eff6ff; }
    .stat-linked .stat-value { color: #1d4ed8; }

    .card { background: white; border-radius: 8px; padding: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: hidden; }
    .card-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid #e2e8f0; }
    .norecord-card { border-top: 3px solid #f59e0b; }
    .linked-card { border-top: 3px solid #3b82f6; }
    .norecord-title { margin: 0; font-size: 15px; color: #b45309; display: flex; align-items: center; gap: 6px; }
    .linked-title { margin: 0; font-size: 15px; color: #1d4ed8; display: flex; align-items: center; gap: 6px; }
    .norecord-hint, .linked-hint { font-size: 12px; color: #94a3b8; }

    .empty { text-align: center; padding: 60px; color: #94a3b8; font-size: 14px; }
    .empty-card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .table th {
      background: #f8fafc; padding: 12px 10px; text-align: left; color: #475569;
      font-weight: 600; border-bottom: 1px solid #e2e8f0; white-space: nowrap;
    }
    .table td { padding: 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .table tbody tr:hover { background: #f8fafc; }
    .mono { font-family: 'SF Mono', Monaco, monospace; }
    .small { font-size: 12px; }
    .status-tag { display: inline-block; padding: 3px 10px; border-radius: 10px; color: white; font-size: 12px; }
    .status-tag.small { padding: 2px 8px; font-size: 11px; }
    .action-tag { background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    .failure-cell { max-width: 350px; }
    .failure-box {
      background: #fef2f2; color: #991b1b; padding: 8px 10px; border-radius: 4px;
      font-size: 12px; line-height: 1.6; border-left: 3px solid #dc2626;
    }
    .btn-link { background: none; border: none; color: #3b82f6; cursor: pointer; padding: 4px; font-size: 13px; }
    .btn-link:hover { text-decoration: underline; }
    .no-record-tag { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 11px; white-space: nowrap; }
    .no-link-hint { color: #cbd5e1; font-size: 13px; }
    .stats-box { background: #f8fafc; padding: 14px 18px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .stats-box h4 { margin: 0 0 6px; color: #1e293b; }
    .stats-box p { margin: 4px 0; font-size: 13px; color: #475569; }
    .stats-box .hint { color: #94a3b8; font-size: 12px; }
    `,
  ],
})
export class AuditComponent implements OnInit {
  logs: AuditLog[] = [];
  noRecordLogs: AuditLog[] = [];
  linkedLogs: AuditLog[] = [];
  loaded = false;
  STATUS_LABELS = STATUS_LABELS;
  STATUS_COLORS = STATUS_COLORS;

  constructor(private service: CheckinService, private router: Router) {}

  ngOnInit(): void {
    this.service.getFailureLogs().subscribe({
      next: logs => {
        this.logs = logs;
        this.noRecordLogs = logs.filter(l => l.checkin_record_id === null);
        this.linkedLogs = logs.filter(l => l.checkin_record_id !== null);
        this.loaded = true;
      },
      error: err => {
        console.error(err);
        this.loaded = true;
      },
    });
  }

  goRecord(id: number | null): void {
    if (id !== null && id !== undefined) {
      this.router.navigate(['/orders', id]);
    }
  }
}
