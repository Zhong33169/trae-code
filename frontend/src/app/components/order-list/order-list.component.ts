import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  RepairOrder,
  OrderStatus,
  STATUS_NAMES,
  STATUS_BADGE_CLASSES,
  RISK_NAMES,
  RISK_BADGE_CLASSES,
  STAGE_NAMES,
} from '../../models';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';

interface TabItem {
  key: string;
  label: string;
  view?: string;
  status?: OrderStatus;
  count: number;
}

@Component({
  selector: 'app-order-list',
  templateUrl: './order-list.component.html',
  styleUrls: ['./order-list.component.css'],
})
export class OrderListComponent implements OnInit {
  orders: RepairOrder[] = [];
  filteredOrders: RepairOrder[] = [];
  loading = true;

  activeTab = 'all';
  tabs: TabItem[] = [
    { key: 'all', label: '全部', count: 0 },
    { key: 'todo', label: '我的待办', view: 'todo', count: 0 },
    { key: 'my', label: '我的工单', view: 'my', count: 0 },
    { key: 'draft', label: '草稿', status: 'draft', count: 0 },
    { key: 'processing', label: '审批中', count: 0 },
    { key: 'returned', label: '已退回', count: 0 },
    { key: 'high_risk', label: '高风险', count: 0 },
    { key: 'archived', label: '已归档', status: 'archived', count: 0 },
  ];

  filterStatus = '';
  filterRisk = '';
  filterStage = '';
  keyword = '';

  readonly STATUS_NAMES = STATUS_NAMES;
  readonly STATUS_BADGE_CLASSES = STATUS_BADGE_CLASSES;
  readonly RISK_NAMES = RISK_NAMES;
  readonly RISK_BADGE_CLASSES = RISK_BADGE_CLASSES;
  readonly STAGE_NAMES = STAGE_NAMES;

  constructor(
    private orderService: OrderService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((qp) => {
      this.filterStatus = qp['status'] || '';
      this.filterRisk = qp['risk'] || '';
      this.filterStage = qp['stage'] || '';
      this.keyword = qp['keyword'] || '';
      this.activeTab = qp['tab'] || 'all';
      this.loadOrders();
    });
  }

  loadOrders(): void {
    this.loading = true;
    const activeTabDef = this.tabs.find((t) => t.key === this.activeTab);
    const params: {
      view?: string;
      status?: string;
      stage?: string;
      risk?: string;
    } = {};

    if (activeTabDef?.view) {
      params.view = activeTabDef.view;
    }
    if (this.filterStatus) {
      params.status = this.filterStatus;
    }
    if (this.filterStage) {
      params.stage = this.filterStage;
    }
    if (this.filterRisk) {
      params.risk = this.filterRisk;
    }

    this.orderService.getOrders(Object.keys(params).length ? params : undefined).subscribe({
      next: (data) => {
        this.orders = data;
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.orders = [];
        this.filteredOrders = [];
        this.loading = false;
      },
    });
  }

  applyFilters(): void {
    let list = [...this.orders];

    if (this.activeTab === 'draft') {
      list = list.filter((o) => o.status === 'draft');
    } else if (this.activeTab === 'processing') {
      list = list.filter((o) =>
        ['submitted', 'resubmitted', 'supervisor_approved', 'high_risk_escalated'].includes(o.status)
      );
    } else if (this.activeTab === 'returned') {
      list = list.filter((o) =>
        ['returned_to_registrar', 'supervisor_rejected', 'reviewer_rejected'].includes(o.status)
      );
    } else if (this.activeTab === 'high_risk') {
      list = list.filter((o) => o.risk_level === 'high');
    } else if (this.activeTab === 'archived') {
      list = list.filter((o) => o.status === 'archived');
    }

    if (this.keyword) {
      const kw = this.keyword.toLowerCase();
      list = list.filter(
        (o) =>
          o.order_no?.toLowerCase().includes(kw) ||
          o.customer_name?.toLowerCase().includes(kw) ||
          o.vehicle_plate?.toLowerCase().includes(kw)
      );
    }

    this.filteredOrders = list;
    this.recomputeCounts();
  }

  recomputeCounts(): void {
    const all = this.orders;
    const userId = this.authService.getCurrentUserId();
    const userRole = this.authService.getCurrentUserRole();

    this.tabs[0].count = all.length;
    this.tabs[1].count = all.filter((o) => {
      if (userRole === 'registrar') {
        return ['draft', 'returned_to_registrar'].includes(o.status) && o.created_by_id === userId;
      }
      if (userRole === 'supervisor') {
        return ['submitted', 'resubmitted', 'high_risk_escalated', 'reviewer_rejected'].includes(o.status);
      }
      if (userRole === 'reviewer') {
        return ['supervisor_approved', 'high_risk_escalated'].includes(o.status);
      }
      return false;
    }).length;
    this.tabs[2].count = all.filter((o) => o.created_by_id === userId).length;
    this.tabs[3].count = all.filter((o) => o.status === 'draft').length;
    this.tabs[4].count = all.filter((o) =>
      ['submitted', 'resubmitted', 'supervisor_approved', 'high_risk_escalated'].includes(o.status)
    ).length;
    this.tabs[5].count = all.filter((o) =>
      ['returned_to_registrar', 'supervisor_rejected', 'reviewer_rejected'].includes(o.status)
    ).length;
    this.tabs[6].count = all.filter((o) => o.risk_level === 'high').length;
    this.tabs[7].count = all.filter((o) => o.status === 'archived').length;
  }

  changeTab(key: string): void {
    this.activeTab = key;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: key },
      queryParamsHandling: 'merge',
    });
  }

  applyFiltersAndNavigate(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: this.filterStatus || null,
        risk: this.filterRisk || null,
        stage: this.filterStage || null,
        keyword: this.keyword || null,
      },
      queryParamsHandling: 'merge',
    });
  }

  clearFilters(): void {
    this.filterStatus = '';
    this.filterRisk = '';
    this.filterStage = '';
    this.keyword = '';
    this.activeTab = 'all';
    this.router.navigate(['/orders']);
  }

  formatDate(d: string): string {
    if (!d) return '-';
    return d.substring(0, 16).replace('T', ' ');
  }

  goDetail(id: number): void {
    this.router.navigate(['/orders', id]);
  }

  goCreate(): void {
    this.router.navigate(['/orders/create']);
  }
}
