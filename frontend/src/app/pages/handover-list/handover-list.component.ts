import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { ShiftHandover, ShiftLabels } from '../../models/release.model';
import { Role } from '../../models/auth.model';

@Component({
  selector: 'app-handover-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-header">
      <h1 class="page-title">换班交接</h1>
      <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
        <input type="checkbox" [(ngModel)]="onlyMy" (change)="loadData()">
        <span style="font-size: 14px;">只看我的</span>
      </label>
    </div>

    <div class="card">
      <div *ngIf="loading" class="loading">加载中...</div>

      <table *ngIf="!loading">
        <thead>
          <tr>
            <th style="width: 60px;">ID</th>
            <th>发布申请</th>
            <th>班次</th>
            <th>交出人</th>
            <th>接收人</th>
            <th>状态</th>
            <th>发起时间</th>
            <th style="width: 180px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of handovers">
            <td>{{ item.id }}</td>
            <td><a [routerLink]="['/releases', item.release_application_id]">申请 #{{ item.release_application_id }}</a></td>
            <td>
              <span class="status-tag status-{{ item.shift }}">{{ getShiftLabel(item.shift) }}</span>
            </td>
            <td>{{ item.from_user?.full_name || '-' }}</td>
            <td>{{ item.to_user?.full_name || '-' }}</td>
            <td>
              <span class="handover-status" [class.handover-confirmed]="item.is_confirmed" [class.handover-pending]="!item.is_confirmed">
                {{ item.is_confirmed ? '已确认' : '待确认' }}
              </span>
            </td>
            <td>{{ formatDate(item.created_at) }}</td>
            <td>
              <button class="btn-default" style="padding: 4px 10px; font-size: 12px;" [routerLink]="['/releases', item.release_application_id]">查看详情</button>
              <button *ngIf="canConfirm(item)" class="btn-success" style="padding: 4px 10px; font-size: 12px; margin-left: 4px;" (click)="confirmHandover(item.id)">确认</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div *ngIf="!loading && handovers.length === 0" class="empty">暂无交接记录</div>
    </div>
  `
})
export class HandoverListComponent implements OnInit {
  handovers: ShiftHandover[] = [];
  loading = true;
  onlyMy = true;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.apiService.getShiftHandovers({ my: this.onlyMy }).subscribe({
      next: (data) => {
        this.handovers = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toastService.error(err.error?.detail || '加载失败');
      }
    });
  }

  getShiftLabel(shift: string): string {
    return (ShiftLabels as any)[shift] || shift;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  }

  canConfirm(item: ShiftHandover): boolean {
    if (item.is_confirmed) return false;
    return item.to_user_id === this.authService.currentUser?.id;
  }

  confirmHandover(id: number): void {
    if (!confirm('确认接收此交接？')) return;
    this.apiService.confirmShiftHandover(id).subscribe({
      next: () => {
        this.toastService.success('确认成功');
        this.loadData();
      },
      error: (err) => {
        this.toastService.error(err.error?.detail || '操作失败');
      }
    });
  }
}
