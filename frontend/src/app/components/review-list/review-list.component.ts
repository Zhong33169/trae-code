import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  RiskReview,
  ReviewStatus,
  REVIEW_STATUS_NAMES,
  REVIEW_STATUS_BADGE,
  ROLE_NAMES,
  UserRole,
} from '../../models';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-review-list',
  templateUrl: './review-list.component.html',
  styleUrls: ['./review-list.component.css'],
})
export class ReviewListComponent implements OnInit {
  reviews: RiskReview[] = [];
  loading = true;
  currentRole: UserRole = 'registrar';

  readonly REVIEW_STATUS_NAMES = REVIEW_STATUS_NAMES;
  readonly REVIEW_STATUS_BADGE = REVIEW_STATUS_BADGE;
  readonly ROLE_NAMES = ROLE_NAMES;

  constructor(
    private orderService: OrderService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentRole = this.authService.getCurrentUserRole();
    this.loadReviews();
  }

  loadReviews(): void {
    this.loading = true;
    this.orderService.getReviews().subscribe({
      next: (data) => {
        this.reviews = data;
        this.loading = false;
      },
      error: () => {
        this.reviews = [];
        this.loading = false;
      },
    });
  }

  goDetail(id: number): void {
    this.router.navigate(['/reviews', id]);
  }

  formatDate(d: string): string {
    if (!d) return '-';
    return d.substring(0, 16).replace('T', ' ');
  }

  statusBadge(status: ReviewStatus): string {
    return this.REVIEW_STATUS_BADGE[status] || 'badge-default';
  }
}
