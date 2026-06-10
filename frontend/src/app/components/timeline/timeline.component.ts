import { Component, Input } from '@angular/core';
import { OrderOperation, STATUS_NAMES, ROLE_NAMES, OrderStatus } from '../../models';

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.css'],
})
export class TimelineComponent {
  @Input() operations: OrderOperation[] = [];
  readonly STATUS_NAMES = STATUS_NAMES;
  readonly ROLE_NAMES = ROLE_NAMES;

  getDotClass(op: OrderOperation): string {
    const to = op.to_status as OrderStatus;
    if (!to) return '';
    if (
      ['archived', 'reviewer_approved', 'supervisor_approved', 'resubmitted'].includes(to)
    ) {
      return 'success';
    }
    if (
      ['returned_to_registrar', 'supervisor_rejected', 'reviewer_rejected', 'overdue'].includes(to)
    ) {
      return 'danger';
    }
    if (['high_risk_escalated', 'submitted'].includes(to)) {
      return 'warning';
    }
    return '';
  }

  getOpinionClass(op: OrderOperation): string {
    const to = op.to_status as OrderStatus;
    if (
      to === 'returned_to_registrar' ||
      to === 'supervisor_rejected' ||
      to === 'reviewer_rejected'
    ) {
      return 'danger';
    }
    return '';
  }

  formatDate(d: string): string {
    if (!d) return '';
    return d.substring(0, 19).replace('T', ' ');
  }

  hasRiskUp(rc: string): boolean {
    return !!rc && (rc.includes('升') || rc.includes('高') || rc.includes('升级'));
  }

  hasRiskDown(rc: string): boolean {
    return !!rc && (rc.includes('降') || rc.includes('低'));
  }

  evidencePass(ec: string): boolean {
    if (!ec) return false;
    return (
      ec.includes('齐全') ||
      ec.includes('通过') ||
      ec.includes('完整') ||
      ec.includes('有效') ||
      ec === 'pass'
    );
  }

  getStatusName(s: string): string {
    if (!s) return s;
    return this.STATUS_NAMES[s as OrderStatus] || s;
  }
}
