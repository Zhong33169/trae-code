import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { OverviewStats, STATUS_NAMES } from '../../models';
import { StatsService } from '../../services/stats.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  stats!: OverviewStats;
  loading = true;
  statusBarItems: { key: string; label: string; count: number; color: string }[] = [];

  constructor(
    private statsService: StatsService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.loadUsers();
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    this.statsService.getOverview().subscribe({
      next: (data) => {
        this.stats = data;
        this.buildStatusBar();
        this.loading = false;
      },
      error: () => {
        this.stats = {
          todo_by_role: { registrar: 0, supervisor: 0, reviewer: 0 },
          by_status: {
            draft: 0, submitted: 0, returned_to_registrar: 0,
            resubmitted: 0, supervisor_approved: 0, supervisor_rejected: 0,
            high_risk_escalated: 0, reviewer_approved: 0, reviewer_rejected: 0,
            archived: 0, overdue: 0,
          },
          by_risk: { low: 0, medium: 0, high: 0 },
          by_stage: { appointment: 0, dispatch: 0, delivery: 0 },
          my_todo: 0,
          total_orders: 0,
        };
        this.buildStatusBar();
        this.loading = false;
      },
    });
  }

  buildStatusBar(): void {
    const mapping: { key: keyof OverviewStats['by_status']; color: string }[] = [
      { key: 'draft', color: '#bfbfbf' },
      { key: 'submitted', color: '#faad14' },
      { key: 'returned_to_registrar', color: '#ff4d4f' },
      { key: 'resubmitted', color: '#1677ff' },
      { key: 'supervisor_approved', color: '#1677ff' },
      { key: 'supervisor_rejected', color: '#ff4d4f' },
      { key: 'high_risk_escalated', color: '#cf1322' },
      { key: 'reviewer_approved', color: '#52c41a' },
      { key: 'reviewer_rejected', color: '#ff4d4f' },
      { key: 'archived', color: '#52c41a' },
      { key: 'overdue', color: '#ff4d4f' },
    ];
    this.statusBarItems = mapping.map((m) => ({
      key: m.key,
      label: STATUS_NAMES[m.key as keyof typeof STATUS_NAMES] || m.key,
      count: this.stats.by_status[m.key],
      color: m.color,
    }));
  }

  get totalStatusCount(): number {
    return this.statusBarItems.reduce((s, i) => s + i.count, 0) || 1;
  }

  goCreate(): void {
    this.router.navigate(['/orders/create']);
  }

  goOrders(params?: { status?: string; risk?: string; view?: string }): void {
    this.router.navigate(['/orders'], { queryParams: params });
  }
}
