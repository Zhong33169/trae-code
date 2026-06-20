import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { User, OrderSummary, QueueStats, Evidence, BatchResultItem } from '../../models/app.models';

const STATUS_LABELS: any = {
  draft: ['草稿', 'tag-draft'],
  pending_audit: ['待审核', 'tag-pending_audit'],
  audit_rejected: ['审核驳回（待补正）', 'tag-audit_rejected'],
  pending_review: ['待复核归档', 'tag-pending_review'],
  review_rejected: ['复核驳回（待补正）', 'tag-review_rejected'],
  archived: ['已归档', 'tag-archived']
};

const ROLE_QUEUES: any = {
  registrar: [
    { key: 'mine', label: '我创建的', statuses: [], myCreated: true },
    { key: 'rejected', label: '待补正', statuses: ['audit_rejected', 'review_rejected'] },
    { key: 'pending_audit', label: '待审核', statuses: ['pending_audit'] },
    { key: 'pending_review', label: '待复核', statuses: ['pending_review'] },
    { key: 'all', label: '全部单据', statuses: [] }
  ],
  auditor: [
    { key: 'pending_audit', label: '待我审核', statuses: ['pending_audit'] },
    { key: 'rejected', label: '已驳回', statuses: ['audit_rejected'] },
    { key: 'pending_review', label: '待复核', statuses: ['pending_review'] },
    { key: 'all', label: '全部单据', statuses: [] }
  ],
  reviewer: [
    { key: 'pending_review', label: '待我复核', statuses: ['pending_review'] },
    { key: 'review_rejected', label: '复核驳回', statuses: ['review_rejected'] },
    { key: 'archived', label: '已归档', statuses: ['archived'] },
    { key: 'all', label: '全部单据', statuses: [] }
  ]
};

@Component({
  selector: 'app-queue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './queue.component.html',
  styleUrls: ['./queue.component.css']
})
export class QueueComponent implements OnInit, OnDestroy {
  destroy$ = new Subject<void>();
  user: User | null = null;
  queues: any[] = [];
  activeQueue = '';
  filters = { status: '', statusIn: [] as string[], keyword: '', myCreated: false };
  orders: OrderSummary[] = [];
  total = 0;
  page = 1;
  pageSize = 20;
  loading = false;
  stats: QueueStats | null = null;

  selectedMap = new Map<number, boolean>();
  selectedCount = 0;
  previewOrder: OrderSummary | null = null;
  previewEvidences: Evidence[] = [];
  previewLoading = false;

  batchDialog = false;
  batchRunning = false;
  batchResults: (BatchResultItem & { order?: OrderSummary })[] = [];

  createDialog = false;
  createLoading = false;
  createForm = {
    applicant: '', department: '', equipment_name: '', equipment_model: '',
    quantity: 1, borrow_reason: '', expected_return_date: ''
  };

  statusLabels = STATUS_LABELS;
  evidenceTypes: any = { borrow: '借用', return: '归还验收', loss: '损耗确认' };

  constructor(
    public auth: AuthService,
    private orderService: OrderService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.auth.user$.pipe(takeUntil(this.destroy$)).subscribe(u => {
      this.user = u;
      this.queues = ROLE_QUEUES[u?.role || 'registrar'] || [];
      if (this.queues.length && !this.activeQueue) this.selectQueue(this.queues[0].key);
    });
    this.loadStats();
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(m => {
      const id = m.get('highlight');
      if (id) {
        setTimeout(() => {
          const el = document.getElementById(`row-${id}`);
          if (el) { el.classList.add('row-hl'); setTimeout(() => el.classList.remove('row-hl'), 2000); }
        }, 300);
      }
    });
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  loadStats() {
    this.orderService.stats().subscribe(r => { if (r.code === 0) this.stats = r.data; });
  }

  selectQueue(key: string) {
    this.activeQueue = key;
    const q = this.queues.find((x: any) => x.key === key);
    if (!q) return;
    this.filters = {
      status: q.statuses.length === 1 ? q.statuses[0] : '',
      statusIn: q.statuses.length > 1 ? q.statuses : [],
      keyword: '',
      myCreated: !!q.myCreated
    };
    this.page = 1;
    this.selectedMap.clear();
    this.selectedCount = 0;
    this.previewOrder = null;
    this.loadOrders();
  }

  loadOrders() {
    this.loading = true;
    const params: any = { page: this.page, pageSize: this.pageSize };
    if (this.filters.status) params.status = this.filters.status;
    if (this.filters.statusIn.length) params.statusIn = this.filters.statusIn;
    if (this.filters.keyword) params.keyword = this.filters.keyword.trim();
    if (this.filters.myCreated) params.myCreated = true;
    this.orderService.list(params).subscribe({
      next: r => {
        if (r.code === 0) {
          this.orders = r.data.rows;
          this.total = r.data.total;
          this.orders.forEach(o => o.selected = !!this.selectedMap.get(o.id));
          this.updateSelectedCount();
          if (this.orders.length && !this.previewOrder) this.preview(this.orders[0]);
        }
      },
      error: () => {},
      complete: () => this.loading = false
    });
  }

  refreshAll() {
    this.loadStats();
    this.loadOrders();
  }

  statusTag(s: string) { return STATUS_LABELS[s] || [s, 'tag-draft']; }

  canBatchReview(o: OrderSummary) {
    return this.user?.role === 'reviewer'
      && ['pending_review', 'review_rejected'].includes(o.status);
  }

  toggleSelect(o: OrderSummary) {
    if (!this.canBatchReview(o)) return;
    o.selected = !o.selected;
    this.selectedMap.set(o.id, o.selected);
    if (!o.selected) this.selectedMap.delete(o.id);
    this.updateSelectedCount();
  }

  toggleSelectAll() {
    const selectable = this.orders.filter(o => this.canBatchReview(o));
    const allSel = selectable.every(o => o.selected);
    selectable.forEach(o => {
      o.selected = !allSel;
      if (o.selected) this.selectedMap.set(o.id, true);
      else this.selectedMap.delete(o.id);
    });
    this.updateSelectedCount();
  }

  updateSelectedCount() {
    this.selectedCount = Array.from(this.selectedMap.values()).filter(Boolean).length;
  }

  preview(o: OrderSummary) {
    this.previewOrder = o;
    this.previewLoading = true;
    this.previewEvidences = [];
    this.orderService.detail(o.id).subscribe({
      next: r => {
        if (r.code === 0) {
          this.previewEvidences = r.data.evidences;
          Object.assign(this.previewOrder || {}, r.data.order);
        }
      },
      error: () => {},
      complete: () => this.previewLoading = false
    });
  }

  goDetail(o: OrderSummary) {
    this.router.navigate(['/order', o.id]);
  }

  evidenceTagClass(t: string) {
    return { borrow: 'tag-borrow', return: 'tag-return', loss: 'tag-loss' }[t] || '';
  }

  hasEvidence(o: OrderSummary, t: 'borrow' | 'return' | 'loss') {
    return (o as any)[`${t}_evidence_count`] > 0;
  }

  openBatchReview() {
    if (this.selectedCount === 0) { alert('请先勾选待复核的单据'); return; }
    this.batchDialog = true;
    this.batchResults = [];
  }

  runBatchReview() {
    const ids = Array.from(this.selectedMap.keys()).filter(k => this.selectedMap.get(k));
    if (!ids.length) return;
    this.batchRunning = true;
    this.orderService.batchReview(ids).subscribe({
      next: r => {
        if (r.code === 0) {
          this.batchResults = r.data.map((it: any) => {
            const order = this.orders.find(o => o.id === it.orderId) || null;
            return { ...it, order };
          });
          this.selectedMap.clear();
          this.selectedCount = 0;
          this.refreshAll();
        }
      },
      error: e => { this.batchResults = ids.map(id => ({ orderId: id, status: 'retry', message: e.error?.message || e.message, failureReason: null })); },
      complete: () => this.batchRunning = false
    });
  }

  retryFailed(result: any) {
    if (result.status === 'success') return;
    const order = this.orders.find(o => o.id === result.orderId);
    if (order) { this.router.navigate(['/order', order.id]); this.batchDialog = false; }
  }

  openCreate() {
    if (this.user?.role !== 'registrar') { alert('仅登记员可以新建借用单'); return; }
    this.createForm = {
      applicant: '', department: '', equipment_name: '', equipment_model: '',
      quantity: 1, borrow_reason: '', expected_return_date: ''
    };
    this.createDialog = true;
  }

  submitCreate(direct: boolean) {
    const f = this.createForm;
    const need = ['applicant', 'department', 'equipment_name', 'borrow_reason', 'expected_return_date'];
    const missing = need.filter(k => !(f as any)[k]);
    if (missing.length) { alert('请完整填写：借用人、部门、器材名称、借用理由、预计归还日期'); return; }
    if (f.quantity < 1) { alert('数量必须 >= 1'); return; }
    this.createLoading = true;
    this.orderService.create(f).subscribe({
      next: r => {
        if (r.code !== 0) { alert(r.message); this.createLoading = false; return; }
        const newId = r.data.order?.id;
        if (direct && newId) {
          this.orderService.submit(newId, { ...f, version: r.data.order?.version }).subscribe({
            next: rs => {
              this.createLoading = false;
              if (rs.code === 0) {
                this.createDialog = false;
                this.refreshAll();
                this.router.navigate(['/order', newId]);
              } else {
                alert(rs.message);
                this.createDialog = false;
                this.refreshAll();
                if (newId) this.router.navigate(['/order', newId]);
              }
            },
            error: e => { alert(e.error?.message || e.message); this.createLoading = false; }
          });
        } else {
          this.createLoading = false;
          this.createDialog = false;
          this.refreshAll();
          if (newId) this.router.navigate(['/order', newId]);
        }
      },
      error: e => { alert(e.error?.message || e.message); this.createLoading = false; }
    });
  }

  statCountForQueue(key: string): number {
    const q = this.queues.find((x: any) => x.key === key);
    if (!q || !this.stats) return 0;
    if (q.key === 'mine') return this.total;
    if (q.statuses.length === 1) return (this.stats as any)[q.statuses[0]] || 0;
    if (q.statuses.length > 1) return q.statuses.reduce((a: number, s: string) => a + ((this.stats as any)[s] || 0), 0);
    return Object.values(this.stats).reduce((a: any, b: any) => a + b, 0);
  }
}
