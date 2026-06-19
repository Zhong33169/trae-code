import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { OperationLog, StatusLabels } from '../../models/release.model';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-header">
      <h1 class="page-title">操作记录</h1>
    </div>

    <div class="card">
      <div style="display: flex; gap: 12px; margin-bottom: 16px; align-items: center;">
        <input type="text" class="form-input" placeholder="按发布申请ID筛选" [(ngModel)]="filterAppId" (keyup.enter)="loadLogs()" style="width: 200px;">
        <button class="btn-primary" (click)="loadLogs()">查询</button>
        <button class="btn-default" (click)="resetFilter()">重置</button>
      </div>

      <div *ngIf="loading" class="loading">加载中...</div>
      <div *ngIf="!loading && logs.length === 0" class="empty">暂无操作记录</div>

      <table *ngIf="!loading && logs.length > 0" class="table">
        <thead>
          <tr>
            <th>时间</th>
            <th>操作人</th>
            <th>操作类型</th>
            <th>发布申请ID</th>
            <th>状态变更</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let log of logs">
            <td>{{ formatDate(log.created_at) }}</td>
            <td>{{ log.operator?.full_name || '系统' }}</td>
            <td>
              <span style="color: #1890ff;">{{ getOperationLabel(log.operation_type) }}</span>
            </td>
            <td>
              <a *ngIf="log.release_application_id" [routerLink]="['/releases', log.release_application_id]" style="color: #1890ff; cursor: pointer;">
                #{{ log.release_application_id }}
              </a>
              <span *ngIf="!log.release_application_id">-</span>
            </td>
            <td>
              <span *ngIf="log.old_status || log.new_status">
                {{ getStatusLabel(log.old_status || '') }} → {{ getStatusLabel(log.new_status || '') }}
              </span>
              <span *ngIf="!log.old_status && !log.new_status">-</span>
            </td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" [title]="log.operation_detail || ''">
              {{ log.operation_detail || '-' }}
            </td>
          </tr>
        </tbody>
      </table>

      <div *ngIf="logs.length > 0" style="display: flex; justify-content: center; margin-top: 16px; gap: 8px;">
        <button class="btn-default" (click)="prevPage()" [disabled]="skip === 0">上一页</button>
        <span style="line-height: 36px; color: #666;">第 {{ currentPage }} 页</span>
        <button class="btn-default" (click)="nextPage()" [disabled]="logs.length < limit">下一页</button>
      </div>
    </div>
  `
})
export class LogsComponent implements OnInit {
  logs: OperationLog[] = [];
  loading = true;
  filterAppId: string = '';
  skip = 0;
  limit = 20;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  get currentPage(): number {
    return Math.floor(this.skip / this.limit) + 1;
  }

  loadLogs(): void {
    this.loading = true;
    const params: any = { skip: this.skip, limit: this.limit };
    if (this.filterAppId) {
      const appId = parseInt(this.filterAppId, 10);
      if (!isNaN(appId)) {
        params.app_id = appId;
      }
    }
    this.apiService.getOperationLogs(params).subscribe({
      next: (data) => {
        this.logs = data.items || [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toastService.error(err.error?.detail || '加载失败');
      }
    });
  }

  resetFilter(): void {
    this.filterAppId = '';
    this.skip = 0;
    this.loadLogs();
  }

  prevPage(): void {
    if (this.skip >= this.limit) {
      this.skip -= this.limit;
      this.loadLogs();
    }
  }

  nextPage(): void {
    this.skip += this.limit;
    this.loadLogs();
  }

  getOperationLabel(type: string): string {
    const labels: Record<string, string> = {
      'create': '创建',
      'update': '更新',
      'submit_review': '提交审核',
      'review_approve': '审核通过',
      'review_reject': '审核驳回',
      'submit_recheck': '提交复核',
      'recheck_approve': '复核通过',
      'recheck_reject': '复核驳回',
      'publish': '发布',
      'rollback': '回滚',
      'archive': '归档',
      'create_rollback_plan': '创建回滚预案',
      'update_rollback_plan': '更新回滚预案',
      'approve_rollback_plan': '审核回滚预案',
      'create_post_launch_review': '创建上线复盘',
      'update_post_launch_review': '更新上线复盘',
      'complete_post_launch_review': '完成上线复盘',
      'create_handover': '发起交接',
      'confirm_handover': '确认交接'
    };
    return labels[type] || type;
  }

  getStatusLabel(status: string): string {
    return (StatusLabels as any)[status] || status || '-';
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  }
}
