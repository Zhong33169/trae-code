import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { ReleaseApplication, ReleaseStatus, StatusLabels } from '../../models/release.model';
import { Role } from '../../models/auth.model';

@Component({
  selector: 'app-release-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-header">
      <h1 class="page-title">发布申请列表</h1>
      <div class="toolbar">
        <button *ngIf="isRegistrar" class="btn-primary" (click)="goToCreate()">+ 新建申请</button>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <select class="form-select" [(ngModel)]="filterStatus" (change)="loadData()">
          <option value="">全部状态</option>
          <option *ngFor="let s of statusOptions" [value]="s.value">{{ s.label }}</option>
        </select>
        <input type="text" class="form-input" placeholder="搜索标题/项目/版本..." [(ngModel)]="keyword" (keyup.enter)="loadData()">
        <button class="btn-default" (click)="loadData()">搜索</button>
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
          <input type="checkbox" [(ngModel)]="onlyMy" (change)="loadData()">
          <span style="font-size: 14px;">只看我创建的</span>
        </label>
      </div>

      <div *ngIf="isRegistrar" style="margin-bottom: 12px;">
        <button class="btn-primary" [disabled]="selectedIds.length === 0" (click)="batchSubmit()">
          批量提交审核 ({{ selectedIds.length }})
        </button>
        <span *ngIf="selectedIds.length > 0" style="margin-left: 12px; color: #666;">已选 {{ selectedIds.length }} 项</span>
      </div>

      <div *ngIf="loading" class="loading">加载中...</div>

      <table *ngIf="!loading">
        <thead>
          <tr>
            <th *ngIf="isRegistrar" style="width: 40px;">
              <input type="checkbox" [checked]="isAllSelected" (change)="toggleSelectAll()">
            </th>
            <th style="width: 60px;">ID</th>
            <th>标题</th>
            <th>项目名称</th>
            <th>版本号</th>
            <th>状态</th>
            <th *ngIf="!isRegistrar">创建人</th>
            <th>创建时间</th>
            <th style="width: 180px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of items">
            <td *ngIf="isRegistrar">
              <input type="checkbox" [checked]="selectedIds.includes(item.id)" (change)="toggleSelect(item.id)" [disabled]="!canSubmit(item)">
            </td>
            <td>{{ item.id }}</td>
            <td><a [routerLink]="['/releases', item.id]">{{ item.title }}</a></td>
            <td>{{ item.project_name }}</td>
            <td>{{ item.version }}</td>
            <td>
              <span class="status-tag status-{{ item.status }}">{{ getStatusLabel(item.status) }}</span>
            </td>
            <td *ngIf="!isRegistrar">{{ item.creator?.full_name || '-' }}</td>
            <td>{{ formatDate(item.created_at) }}</td>
            <td>
              <button class="btn-default" style="padding: 4px 10px; font-size: 12px;" [routerLink]="['/releases', item.id]">查看</button>
              <button *ngIf="canEdit(item)" class="btn-primary" style="padding: 4px 10px; font-size: 12px; margin-left: 4px;" [routerLink]="['/releases', item.id, 'edit']">编辑</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div *ngIf="!loading && items.length === 0" class="empty">暂无数据</div>

      <div class="pagination" *ngIf="!loading && total > 0">
        <span style="color: #666; margin-right: 12px;">共 {{ total }} 条</span>
        <button class="page-btn" [disabled]="page === 1" (click)="changePage(page - 1)">上一页</button>
        <span style="padding: 6px 12px;">第 {{ page }} / {{ totalPages }} 页</span>
        <button class="page-btn" [disabled]="page >= totalPages" (click)="changePage(page + 1)">下一页</button>
      </div>
    </div>
  `
})
export class ReleaseListComponent implements OnInit {
  items: ReleaseApplication[] = [];
  total = 0;
  loading = true;
  page = 1;
  pageSize = 10;
  filterStatus = '';
  keyword = '';
  onlyMy = false;
  selectedIds: number[] = [];

  statusOptions = Object.entries(StatusLabels).map(([value, label]) => ({ value, label }));

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private toastService: ToastService,
    private router: Router
  ) {}

  get isRegistrar(): boolean {
    return this.authService.hasRole(Role.REGISTRAR);
  }

  get isAllSelected(): boolean {
    return this.items.filter(i => this.canSubmit(i)).every(i => this.selectedIds.includes(i.id));
  }

  get totalPages(): number {
    return Math.ceil(this.total / this.pageSize);
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.apiService.getReleaseApplications({
      skip: (this.page - 1) * this.pageSize,
      limit: this.pageSize,
      status: this.filterStatus || undefined,
      keyword: this.keyword || undefined,
      my: this.onlyMy
    }).subscribe({
      next: (data) => {
        this.items = data.items;
        this.total = data.total;
        this.loading = false;
        this.selectedIds = [];
      },
      error: (err) => {
        this.loading = false;
        this.toastService.error(err.error?.detail || '加载失败');
      }
    });
  }

  getStatusLabel(status: string): string {
    return (StatusLabels as any)[status] || status;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  }

  canSubmit(item: ReleaseApplication): boolean {
    return [ReleaseStatus.DRAFT, ReleaseStatus.REVIEW_REJECTED, ReleaseStatus.RECHECK_REJECTED]
      .includes(item.status) && item.creator_id === this.authService.currentUser?.id;
  }

  canEdit(item: ReleaseApplication): boolean {
    if (!this.isRegistrar) return false;
    if (item.creator_id !== this.authService.currentUser?.id) return false;
    return [ReleaseStatus.DRAFT, ReleaseStatus.REVIEW_REJECTED, ReleaseStatus.RECHECK_REJECTED]
      .includes(item.status);
  }

  toggleSelect(id: number): void {
    const idx = this.selectedIds.indexOf(id);
    if (idx > -1) {
      this.selectedIds.splice(idx, 1);
    } else {
      this.selectedIds.push(id);
    }
  }

  toggleSelectAll(): void {
    if (this.isAllSelected) {
      this.selectedIds = [];
    } else {
      this.selectedIds = this.items.filter(i => this.canSubmit(i)).map(i => i.id);
    }
  }

  batchSubmit(): void {
    if (this.selectedIds.length === 0) return;
    if (!confirm(`确定要提交选中的 ${this.selectedIds.length} 条申请进行审核吗？`)) return;

    this.apiService.batchOperation(this.selectedIds, 'submit_review').subscribe({
      next: (result) => {
        const successCount = result.success.length;
        const failCount = result.failed.length;
        if (successCount > 0) {
          this.toastService.success(`成功提交 ${successCount} 条`);
        }
        if (failCount > 0) {
          this.toastService.error(`失败 ${failCount} 条`);
        }
        this.loadData();
      },
      error: (err) => {
        this.toastService.error(err.error?.detail || '批量操作失败');
      }
    });
  }

  goToCreate(): void {
    this.router.navigate(['/releases/new']);
  }

  changePage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.page = p;
    this.loadData();
  }
}
