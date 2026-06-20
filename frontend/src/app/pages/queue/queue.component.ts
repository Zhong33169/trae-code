import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { OrderService, RefreshEvent, WriteRequestMeta } from '../../services/order.service';
import { User, OrderSummary, QueueStats, Evidence, BatchResultItem } from '../../models/app.models';

const STATUS_META: Record<string, [string, string]> = {
  draft: ['草稿', 'tag-draft'],
  pending_audit: ['待审核', 'tag-pending_audit'],
  audit_rejected: ['审核驳回（待补正）', 'tag-audit_rejected'],
  pending_review: ['待复核归档', 'tag-pending_review'],
  review_rejected: ['复核驳回（待补正）', 'tag-review_rejected'],
  archived: ['已归档', 'tag-archived']
};

const EVIDENCE_META: Record<string, string> = {
  borrow: '借用',
  return: '归还验收',
  loss: '损耗确认'
};

interface QueueDefinition {
  key: string;
  label: string;
  statuses: string[];
  myCreated: boolean;
}

const ROLE_QUEUES: Record<string, QueueDefinition[]> = {
  registrar: [
    { key: 'mine',            label: '我创建的',         statuses: [],                            myCreated: true },
    { key: 'rejected',        label: '待补正',           statuses: ['audit_rejected','review_rejected'], myCreated: false },
    { key: 'pending_audit',   label: '待审核',           statuses: ['pending_audit'],             myCreated: false },
    { key: 'pending_review',  label: '待复核',           statuses: ['pending_review'],            myCreated: false },
    { key: 'archived',        label: '已归档',           statuses: ['archived'],                  myCreated: false },
    { key: 'all',             label: '全部单据',         statuses: [],                            myCreated: false }
  ],
  auditor: [
    { key: 'pending_audit',   label: '待我审核',         statuses: ['pending_audit'],             myCreated: false },
    { key: 'audit_rejected',  label: '我已驳回',         statuses: ['audit_rejected'],            myCreated: false },
    { key: 'pending_review',  label: '待复核',           statuses: ['pending_review'],            myCreated: false },
    { key: 'all',             label: '全部单据',         statuses: [],                            myCreated: false }
  ],
  reviewer: [
    { key: 'pending_review',  label: '待我复核',         statuses: ['pending_review'],            myCreated: false },
    { key: 'review_rejected', label: '我已驳回',         statuses: ['review_rejected'],           myCreated: false },
    { key: 'archived',        label: '已归档',           statuses: ['archived'],                  myCreated: false },
    { key: 'all',             label: '全部单据',         statuses: [],                            myCreated: false }
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
  // ===== 基础字段 =====
  private readonly destroy$ = new Subject<void>();
  user: User | null = null;
  queues: QueueDefinition[] = [];
  activeQueue = '';
  orders: OrderSummary[] = [];
  total = 0;
  page = 1;
  pageSize = 20;
  loading = false;
  stats: QueueStats | null = null;
  filters = { keyword: '', status: '', statusIn: [] as string[], myCreated: false };

  // ===== 选择相关字段（下沉）=====
  private readonly selectedSet = new Set<number>();
  get selectedIds(): number[] { return Array.from(this.selectedSet); }
  get selectedCount(): number { return this.selectedSet.size; }
  get selectableCount(): number { return this.orders.filter(o => this.canBatchSelect(o)).length; }
  get selectAllChecked(): boolean {
    return this.selectableCount > 0 && this.orders.filter(o => this.canBatchSelect(o)).every(o => this.selectedSet.has(o.id));
  }
  get selectAllIndeterminate(): boolean {
    const c = this.selectableCount;
    return c > 0 && this.selectedCount > 0 && this.selectedCount < c;
  }

  // ===== 批量结果相关（下沉）=====
  batchDialog = false;
  batchRunning = false;
  batchResults: Array<BatchResultItem & { order?: OrderSummary; statusLabel: string; icon: string }> = [];
  get batchSummary(): { total: number; success: number; failed: number; retry: number } {
    return {
      total: this.batchResults.length,
      success: this.batchResults.filter(r => r.status === 'success').length,
      failed:  this.batchResults.filter(r => r.status === 'failed').length,
      retry:   this.batchResults.filter(r => r.status === 'retry').length
    };
  }

  // ===== 预览相关字段（下沉）=====
  previewOrder: OrderSummary | null = null;
  previewEvidences: Evidence[] = [];
  previewLoading = false;
  get previewEvidenceBorrow(): Evidence | undefined { return this.previewEvidences.find(e => e.type === 'borrow'); }
  get previewEvidenceReturn(): Evidence | undefined { return this.previewEvidences.find(e => e.type === 'return'); }
  get previewEvidenceLoss(): Evidence | undefined   { return this.previewEvidences.find(e => e.type === 'loss'); }

  // ===== 新建借用单对话框 =====
  createDialog = false;
  createLoading = false;
  createForm = {
    applicant: '', department: '', equipment_name: '', equipment_model: '',
    quantity: 1, borrow_reason: '', expected_return_date: ''
  };

  constructor(
    public auth: AuthService,
    private orderService: OrderService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  // ================= 生命周期 =================
  ngOnInit() {
    this.auth.user$.pipe(takeUntil(this.destroy$)).subscribe(u => {
      const prevRole = this.user?.role;
      this.user = u;
      this.queues = ROLE_QUEUES[u?.role || 'registrar'] || [];
      if (prevRole !== u?.role) {
        // 角色切换：清空选择和预览，回到该角色默认队列
        this.resetSelection();
        this.previewOrder = null;
        this.previewEvidences = [];
        if (this.queues.length) this.selectQueue(this.queues[0].key);
      }
    });

    // 订阅全局刷新事件
    this.orderService.refreshEvents$.pipe(takeUntil(this.destroy$)).subscribe(ev => this.handleRefresh(ev));

    // URL 高亮
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(m => {
      const id = m.get('highlight');
      if (id) setTimeout(() => this.highlightRow(parseInt(id)), 400);
    });

    this.loadStats();
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  // ================= 刷新处理（联动）=================
  private handleRefresh(ev: RefreshEvent) {
    if (ev.kind === 'all' || ev.kind === 'queue' || ev.kind === 'stats') this.loadStats();
    if (ev.kind === 'all' || ev.kind === 'queue') this.loadOrders();
    if (ev.kind === 'roleChanged') {
      this.resetSelection();
      this.previewOrder = null;
      this.previewEvidences = [];
      if (this.queues.length) this.selectQueue(this.queues[0].key);
    }
    if (ev.kind === 'preview' && this.previewOrder?.id === ev.orderId) this.preview(this.previewOrder);
    if (ev.kind === 'detail' && this.previewOrder?.id === ev.orderId) this.preview(this.previewOrder);
  }

  // ================= 队列选择（含筛选联动）=================
  selectQueue(key: string) {
    this.activeQueue = key;
    const q = this.queues.find(x => x.key === key);
    if (!q) return;
    this.filters = {
      keyword: '',
      status: q.statuses.length === 1 ? q.statuses[0] : '',
      statusIn: q.statuses.length > 1 ? q.statuses : [],
      myCreated: q.myCreated
    };
    this.page = 1;
    this.resetSelection();
    this.previewOrder = null;
    this.loadOrders();
  }

  // ================= 数据加载 =================
  loadStats() {
    this.orderService.stats().subscribe(r => { if (r.code === 0) this.stats = r.data; });
  }

  loadOrders() {
    this.loading = true;
    const params: any = { page: this.page, pageSize: this.pageSize };
    if (this.filters.status) params.status = this.filters.status;
    if (this.filters.statusIn.length) params.statusIn = this.filters.statusIn;
    if (this.filters.keyword.trim()) params.keyword = this.filters.keyword.trim();
    if (this.filters.myCreated) params.myCreated = true;
    this.orderService.list(params).subscribe({
      next: r => {
        if (r.code === 0) {
          this.orders = r.data.rows;
          this.total = r.data.total;
          // 同步选中状态到新数据
          this.orders.forEach(o => { (o as any).$selected = this.selectedSet.has(o.id); });
          // 若有行但当前无预览，默认预览第一条
          if (this.orders.length && !this.previewOrder) this.preview(this.orders[0]);
          // 若预览行已不在当前队列，清空
          if (this.previewOrder && !this.orders.find(o => o.id === this.previewOrder?.id)) {
            this.previewOrder = this.orders[0] || null;
            this.previewEvidences = [];
            if (this.previewOrder) this.preview(this.previewOrder);
          }
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

  // ================= 列表辅助（下沉）=================
  statusMeta(s: string): { label: string; css: string } {
    const m = STATUS_META[s];
    return { label: m?.[0] || s, css: m?.[1] || 'tag-draft' };
  }
  queueStatCount(key: string): number {
    const q = this.queues.find(x => x.key === key);
    if (!q || !this.stats) return 0;
    if (q.myCreated) return this.total;
    if (q.statuses.length === 1) return (this.stats as any)[q.statuses[0]] || 0;
    if (q.statuses.length > 1) return q.statuses.reduce((a, s) => a + ((this.stats as any)[s] || 0), 0);
    return Object.values(this.stats).reduce((a: any, b: any) => a + b, 0);
  }
  canBatchSelect(o: OrderSummary): boolean {
    return this.user?.role === 'reviewer' && ['pending_review', 'review_rejected'].includes(o.status);
  }
  orderHasEvidence(o: OrderSummary, t: 'borrow' | 'return' | 'loss'): boolean {
    return (o as any)[`${t}_evidence_count`] > 0;
  }
  orderEvidenceCount(o: OrderSummary, t: 'borrow' | 'return' | 'loss'): number {
    return (o as any)[`${t}_evidence_count`] || 0;
  }
  evidenceLabel(t: string): string { return EVIDENCE_META[t] || t; }
  evidenceTagClass(t: string): string {
    return { borrow: 'tag-borrow', return: 'tag-return', loss: 'tag-loss' }[t] || '';
  }
  lossChipVisible(o: OrderSummary): boolean {
    return this.orderHasEvidence(o, 'loss') || !!o.loss_remark;
  }
  rowHighlighted(o: OrderSummary): boolean {
    return this.previewOrder?.id === o.id;
  }

  // ================= 选择逻辑（下沉）=================
  resetSelection() {
    this.selectedSet.clear();
    this.orders.forEach(o => { (o as any).$selected = false; });
  }
  isSelected(o: OrderSummary): boolean {
    return this.selectedSet.has(o.id);
  }
  toggleSelect(o: OrderSummary, event?: Event) {
    event?.stopPropagation();
    if (!this.canBatchSelect(o)) return;
    if (this.selectedSet.has(o.id)) this.selectedSet.delete(o.id);
    else this.selectedSet.add(o.id);
    (o as any).$selected = this.selectedSet.has(o.id);
  }
  toggleSelectAll(event?: Event) {
    event?.stopPropagation();
    const selectable = this.orders.filter(o => this.canBatchSelect(o));
    if (!selectable.length) return;
    const toSelect = !this.selectAllChecked;
    selectable.forEach(o => {
      (o as any).$selected = toSelect;
      if (toSelect) this.selectedSet.add(o.id); else this.selectedSet.delete(o.id);
    });
  }

  // ================= 预览（侧栏联动）=================
  preview(o: OrderSummary) {
    this.previewOrder = o;
    this.previewLoading = true;
    this.orderService.detail(o.id).subscribe({
      next: r => {
        if (r.code === 0) {
          this.previewEvidences = r.data.evidences;
          // 合并最新字段到 orders 列表对应项（证据计数等）
          const idx = this.orders.findIndex(x => x.id === o.id);
          if (idx >= 0) Object.assign(this.orders[idx], r.data.order);
          if (this.previewOrder?.id === o.id) Object.assign(this.previewOrder, r.data.order);
        }
      },
      error: () => {},
      complete: () => this.previewLoading = false
    });
  }
  formatDateTime(s?: string): string {
    return s ? s.slice(5, 16) : '';
  }
  previewChipClass(t: string): string {
    return { borrow: 'tag-borrow', return: 'tag-return', loss: 'tag-loss' }[t] || '';
  }

  // ================= 批量复核（下沉 + 联动刷新）=================
  openBatchReview() {
    if (this.batchRunning) return;
    if (this.selectedCount === 0) { alert('请先勾选待复核的单据'); return; }
    this.batchDialog = true;
    this.batchRunning = false;
    this.batchResults = [];
  }
  closeBatchDialogSafe() {
    if (this.batchRunning) return;
    this.batchDialog = false;
    this.batchResults = [];
  }
  runBatchReview() {
    if (!this.selectedCount || this.batchRunning) return;
    const reqMeta: WriteRequestMeta = {
      requestId: OrderService.newRequestId(),
      action: 'batchReview',
      sentAt: Date.now()
    };
    this.batchRunning = true;
    this.orderService.batchReview(this.selectedIds, {}, reqMeta.requestId).subscribe({
      next: r => {
        if (r.code === 0) {
          this.batchResults = r.data.map(it => {
            const order = this.orders.find(o => o.id === it.orderId);
            const meta = it.status === 'success'
              ? { statusLabel: '成功', icon: '✅' }
              : it.status === 'retry'
                ? { statusLabel: '需重试', icon: '⚠️' }
                : { statusLabel: '失败', icon: '❌' };
            return { ...it, order, ...meta };
          });
          this.resetSelection();
          this.refreshPreviewAfterBatch();
        }
      },
      error: e => {
        this.batchResults = this.selectedIds.map(id => {
          const order = this.orders.find(o => o.id === id);
          return {
            orderId: id, status: 'retry',
            message: e.error?.message || e.message,
            failureReason: null, order, statusLabel: '需重试', icon: '⚠️'
          };
        });
      },
      complete: () => this.batchRunning = false
    });
  }
  private refreshPreviewAfterBatch() {
    if (this.previewOrder) {
      const updated = this.orders.find(o => o.id === this.previewOrder?.id);
      if (updated) this.preview(updated);
      else { this.previewOrder = this.orders[0] || null; this.previewEvidences = []; if (this.previewOrder) this.preview(this.previewOrder); }
    }
  }
  goToFailedResult(result: any) {
    if (result.status === 'success') return;
    const order = this.orders.find(o => o.id === result.orderId);
    if (order) { this.closeBatchDialogSafe(); this.goDetail(order); }
  }

  // ================= 新建（下沉校验）=================
  openCreateDialog() {
    if (this.createLoading) return;
    if (this.user?.role !== 'registrar') { alert('仅器材借用登记员可以新建借用单'); return; }
    this.createForm = { applicant: '', department: '', equipment_name: '', equipment_model: '', quantity: 1, borrow_reason: '', expected_return_date: '' };
    this.createDialog = true;
  }
  closeCreateDialogSafe() {
    if (this.createLoading) return;
    this.createDialog = false;
  }
  validateCreateForm(): string | null {
    const f = this.createForm;
    const need: [string, string, any][] = [
      ['applicant', '借用人', f.applicant],
      ['department', '所属部门', f.department],
      ['equipment_name', '器材名称', f.equipment_name],
      ['borrow_reason', '借用理由', f.borrow_reason],
      ['expected_return_date', '预计归还日期', f.expected_return_date]
    ];
    const miss = need.filter(([,, v]) => !v || typeof v === 'string' && !v.trim());
    if (miss.length) return '请完整填写：' + miss.map(m => m[1]).join('、');
    if ((f.quantity || 0) < 1) return '数量必须大于等于 1';
    if ((f.borrow_reason || '').trim().length < 5) return '借用理由至少 5 个字';
    return null;
  }
  submitCreate(directAudit: boolean) {
    if (this.createLoading) return;
    const err = this.validateCreateForm();
    if (err) { alert(err); return; }
    this.createLoading = true;
    const reqMeta: WriteRequestMeta = {
      requestId: OrderService.newRequestId(),
      action: 'create',
      sentAt: Date.now()
    };
    const finish = () => { this.createLoading = false; };
    this.orderService.create(this.createForm, reqMeta.requestId).subscribe({
      next: r => {
        if (r.code !== 0) { finish(); alert(r.message); return; }
        const newId = r.data?.order?.id;
        if (directAudit && newId) {
          const submitMeta: WriteRequestMeta = {
            requestId: OrderService.newRequestId(),
            action: 'submit',
            sentAt: Date.now()
          };
          this.orderService.submit(newId, { ...this.createForm, version: r.data.order?.version }, submitMeta.requestId).subscribe({
            next: rs => {
              finish();
              this.closeCreateDialogSafe();
              if (rs.code !== 0) alert(rs.message);
              if (newId) this.router.navigate(['/order', newId]);
            },
            error: e => { finish(); alert(e.error?.message || e.message); }
          });
        } else {
          finish();
          this.closeCreateDialogSafe();
          if (newId) this.router.navigate(['/order', newId]);
        }
      },
      error: e => { finish(); alert(e.error?.message || e.message); }
    });
  }

  // ================= 导航 =================
  goDetail(o: OrderSummary) {
    this.router.navigate(['/order', o.id]);
  }
  backToQueueWithHighlight(id: number) {
    this.router.navigate(['/queue'], { queryParams: { highlight: id } });
  }

  // ================= UI 辅助 =================
  private highlightRow(id: number) {
    const el = document.getElementById(`row-${id}`);
    if (!el) return;
    el.classList.add('row-hl');
    setTimeout(() => el.classList.remove('row-hl'), 2200);
    // 滚动到该行
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 触发预览
    const order = this.orders.find(o => o.id === id);
    if (order) this.preview(order);
  }

  changePage(delta: number) {
    const np = this.page + delta;
    if (np < 1) return;
    if ((np - 1) * this.pageSize >= this.total) return;
    this.page = np;
    this.loadOrders();
  }
}
