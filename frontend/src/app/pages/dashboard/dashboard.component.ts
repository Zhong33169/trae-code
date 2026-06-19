import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { Statistics } from '../../models/release.model';
import { StatusLabels } from '../../models/release.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <h1 class="page-title">数据统计</h1>
    </div>

    <div *ngIf="loading" class="loading">加载中...</div>

    <div *ngIf="!loading && stats">
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
        <div class="stat-card">
          <div class="stat-number" style="color: #1890ff;">{{ stats.total }}</div>
          <div class="stat-label">总申请数</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color: #fa8c16;">{{ stats.pending_review + stats.pending_recheck }}</div>
          <div class="stat-label">待处理</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color: #52c41a;">{{ stats.published + stats.reviewed_post_launch }}</div>
          <div class="stat-label">已发布</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color: #ff4d4f;">{{ stats.rolled_back }}</div>
          <div class="stat-label">已回滚</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
        <div class="card">
          <h3 style="margin-bottom: 16px;">各状态分布</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 12px;">
            <div *ngFor="let item of statusItems" class="status-item" style="flex: 1; min-width: 140px; padding: 12px; background: #fafafa; border-radius: 6px; cursor: pointer;" (click)="goToList(item.key)">
              <div style="font-size: 24px; font-weight: 600; color: #333;">{{ item.count }}</div>
              <div style="font-size: 13px; color: #666; margin-top: 4px;">{{ item.label }}</div>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-bottom: 16px;">按项目分布</h3>
          <div *ngIf="projectItems.length > 0">
            <div *ngFor="let item of projectItems" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
              <span style="color: #333;">{{ item.name }}</span>
              <span style="color: #1890ff; font-weight: 500;">{{ item.count }}</span>
            </div>
          </div>
          <div *ngIf="projectItems.length === 0" class="empty">暂无数据</div>
        </div>
      </div>

      <div class="card" style="margin-top: 20px;">
        <h3 style="margin-bottom: 16px;">按创建人分布</h3>
        <div style="display: flex; gap: 16px; flex-wrap: wrap;">
          <div *ngFor="let item of creatorItems" style="padding: 12px 20px; background: #e6f7ff; border-radius: 6px;">
            <span style="color: #1890ff; font-weight: 500;">{{ item.name }}</span>
            <span style="margin-left: 8px; color: #666;">{{ item.count }} 条</span>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  stats: Statistics | null = null;
  loading = true;

  constructor(private apiService: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    this.apiService.getStatistics().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  get statusItems(): { key: string; label: string; count: number }[] {
    if (!this.stats) return [];
    const statuses = ['draft', 'pending_review', 'review_approved', 'review_rejected',
                      'pending_recheck', 'recheck_approved', 'recheck_rejected',
                      'published', 'rolled_back', 'reviewed_post_launch', 'archived'];
    return statuses.map(s => ({
      key: s,
      label: (StatusLabels as any)[s] || s,
      count: (this.stats as any)[s] || 0
    }));
  }

  get projectItems(): { name: string; count: number }[] {
    if (!this.stats?.by_project) return [];
    return Object.entries(this.stats.by_project).map(([name, count]) => ({ name, count }));
  }

  get creatorItems(): { name: string; count: number }[] {
    if (!this.stats?.by_creator) return [];
    return Object.entries(this.stats.by_creator).map(([name, count]) => ({ name, count }));
  }

  goToList(status: string): void {
    this.router.navigate(['/releases'], { queryParams: { status } });
  }
}
