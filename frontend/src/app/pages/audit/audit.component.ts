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

      <div class="card">
        <div *ngIf="logs.length === 0" class="empty">暂无失败记录</div>
        <table class="table" *ngIf="logs.length > 0">
          <thead>
            <tr>
              <th>时间</th>
              <th>操作人</th>
              <th>记录ID</th>
              <th>动作</th>
              <th>状态变更</th>
              <th>详情</th>
              <th>失败原因</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let log of logs">
              <td class="mono small">{{ log.created_at?.substring(0, 19) }}</td>
              <td><b>{{ log.user_name }}</b></td>
              <td class="mono">#{{ log.checkin_record_id }}</td>
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

      <div class="stats-box" *ngIf="logs.length > 0">
        <h4>📊 统计说明</h4>
        <p>共 <b>{{ logs.length }}</b> 条失败记录，涵盖重复批次、状态不一致、材料缺失、超时等异常情况。</p>
        <p class="hint">所有操作（包括成功和失败）都会记录审计日志，点击「查看记录」可跳转到对应值机记录详情页查看完整日志。</p>
      </div>
    </div>
  `,
  styles: [
    `
    .page { display: flex; flex-direction: column; gap: 16px; }
    .page-header h2 { font-size: 20px; color: #1e293b; margin: 0 0 4px; }
    .header-hint { font-size: 13px; color: #64748b; }
    .card { background: white; border-radius: 8px; padding: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: hidden; }
    .empty { text-align: center; padding: 60px; color: #94a3b8; font-size: 14px; }
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
    .stats-box { background: #f8fafc; padding: 14px 18px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .stats-box h4 { margin: 0 0 6px; color: #1e293b; }
    .stats-box p { margin: 4px 0; font-size: 13px; color: #475569; }
    .stats-box .hint { color: #94a3b8; font-size: 12px; }
    `,
  ],
})
export class AuditComponent implements OnInit {
  logs: AuditLog[] = [];
  STATUS_LABELS = STATUS_LABELS;
  STATUS_COLORS = STATUS_COLORS;

  constructor(private service: CheckinService, private router: Router) {}

  ngOnInit(): void {
    this.service.getFailureLogs().subscribe({
      next: logs => (this.logs = logs),
      error: err => console.error(err),
    });
  }

  goRecord(id: number): void {
    this.router.navigate(['/orders', id]);
  }
}
