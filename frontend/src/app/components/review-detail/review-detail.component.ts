import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ReviewDetailResponse,
  RiskReview,
  RepairOrder,
  OrderOperation,
  FailureSummary,
  ConflictSummary,
  HandlerSummary,
  UserRole,
  ROLE_NAMES,
  STATUS_NAMES,
  STATUS_BADGE_CLASSES,
  RISK_NAMES,
  RISK_BADGE_CLASSES,
  REVIEW_STATUS_NAMES,
  REVIEW_STATUS_BADGE,
  OrderStatus,
  ReviewStatus,
} from '../../models';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-review-detail',
  templateUrl: './review-detail.component.html',
  styleUrls: ['./review-detail.component.css'],
})
export class ReviewDetailComponent implements OnInit {
  reviewId = 0;
  review: RiskReview | null = null;
  orders: RepairOrder[] = [];
  operations: OrderOperation[] = [];
  failureReasons: FailureSummary[] = [];
  versionConflicts: ConflictSummary[] = [];
  handlers: HandlerSummary[] = [];
  loading = true;
  errorMsg = '';
  currentRole: UserRole = 'registrar';

  readonly ROLE_NAMES = ROLE_NAMES;
  readonly STATUS_NAMES = STATUS_NAMES;
  readonly STATUS_BADGE_CLASSES = STATUS_BADGE_CLASSES;
  readonly RISK_NAMES = RISK_NAMES;
  readonly RISK_BADGE_CLASSES = RISK_BADGE_CLASSES;
  readonly REVIEW_STATUS_NAMES = REVIEW_STATUS_NAMES;
  readonly REVIEW_STATUS_BADGE = REVIEW_STATUS_BADGE;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.currentRole = this.authService.getCurrentUserRole();
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.router.navigate(['/reviews']);
      return;
    }
    this.reviewId = id;
    this.loadDetail();
  }

  loadDetail(): void {
    this.loading = true;
    this.orderService.getReview(this.reviewId).subscribe({
      next: (data: ReviewDetailResponse) => {
        this.review = data.review;
        this.orders = data.orders;
        this.operations = data.operations;
        this.failureReasons = data.failure_reasons;
        this.versionConflicts = data.version_conflicts;
        this.handlers = data.handlers;
        this.loading = false;
      },
      error: (e) => {
        this.errorMsg = '加载复盘详情失败：' + (e?.message || '请稍后再试');
        this.loading = false;
      },
    });
  }

  getOperatorRoleName(role: string): string {
    return this.ROLE_NAMES[role as UserRole] || role;
  }

  getStatusName(s: string): string {
    return this.STATUS_NAMES[s as OrderStatus] || s;
  }

  getStatusBadge(s: string): string {
    return this.STATUS_BADGE_CLASSES[s as OrderStatus] || 'badge-default';
  }

  getReviewStatusBadge(s: string): string {
    return this.REVIEW_STATUS_BADGE[s as ReviewStatus] || 'badge-default';
  }

  getHandlerName(h: string): string {
    return this.ROLE_NAMES[h as UserRole] || h;
  }

  formatDate(d: string): string {
    if (!d) return '-';
    return d.substring(0, 19).replace('T', ' ');
  }

  goBack(): void {
    this.router.navigate(['/reviews']);
  }

  goOrder(id: number): void {
    this.router.navigate(['/orders', id]);
  }

  getEvidenceSubmitFailures(): OrderOperation[] {
    return this.operations.filter(
      (op) =>
        op.result === '失败' &&
        (op.evidence_check?.includes('evidence') || op.opinion?.includes('证据'))
    );
  }

  getRectifyResubmitOps(): OrderOperation[] {
    return this.operations.filter((op) =>
      ['rectify', 'resubmit'].includes(op.action)
    );
  }

  getRiskChangeOps(): OrderOperation[] {
    return this.operations.filter((op) => op.action === 'risk_change');
  }

  getOrderNoById(id: number): string {
    const o = this.orders.find((x) => x.id === id);
    return o?.order_no || `#${id}`;
  }
}
