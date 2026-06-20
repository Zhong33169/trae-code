import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { User, OrderDetail, Evidence } from '../../models/app.models';

const STATUS_LABELS: any = {
  draft: ['草稿', 'tag-draft'],
  pending_audit: ['待审核', 'tag-pending_audit'],
  audit_rejected: ['审核驳回（待补正）', 'tag-audit_rejected'],
  pending_review: ['待复核归档', 'tag-pending_review'],
  review_rejected: ['复核驳回（待补正）', 'tag-review_rejected'],
  archived: ['已归档', 'tag-archived']
};

const FLOW_STEPS_UNUSED: any = [
  { key: 'draft', label: '创建草稿', fromRoles: ['registrar'] },
  { key: 'pending_audit', label: '登记员提交', fromRoles: ['registrar'] },
  { key: 'audit_decide', label: '审核主管办理', fromRoles: ['auditor'], decider: true },
  { key: 'pending_review', label: '审核通过待复核', fromRoles: ['auditor'] },
  { key: 'review_decide', label: '复核负责人办理', fromRoles: ['reviewer'], decider: true },
  { key: 'archived', label: '归档完成', fromRoles: ['reviewer'] }
];
void FLOW_STEPS_UNUSED;

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-detail.component.html',
  styleUrls: ['./order-detail.component.css']
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  destroy$ = new Subject<void>();
  user: User | null = null;
  detail: OrderDetail | null = null;
  loading = true;
  submitting = false;
  id = 0;

  tab = 'info';
  actionDialog: string = '';
  actionForm: any = { comment: '', decision: 'approve' };
  evidenceDialog = false;
  evidenceForm: any = { type: 'borrow', description: '', file_name: '' };
  editEvidence: Evidence | null = null;

  msg: { type: 'success' | 'error' | 'warn' | 'info'; text: string } | null = null;

  statusLabels = STATUS_LABELS;
  evidenceTypes: any = { borrow: '借用', return: '归还验收', loss: '损耗确认' };

  constructor(
    public auth: AuthService,
    private orderService: OrderService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.auth.user$.pipe(takeUntil(this.destroy$)).subscribe(u => this.user = u);
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(m => {
      const id = parseInt(m.get('id') || '0');
      if (id > 0) { this.id = id; this.loadDetail(); }
    });
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  loadDetail() {
    this.loading = true;
    this.orderService.detail(this.id).subscribe({
      next: r => {
        if (r.code === 0) {
          this.detail = r.data;
          this.computeReviewChecklist();
        } else {
          this.flash('error', r.message);
        }
      },
      error: e => this.flash('error', e.error?.message || e.message),
      complete: () => this.loading = false
    });
  }

  flash(type: any, text: string) {
    this.msg = { type, text };
    setTimeout(() => { if (this.msg?.text === text) this.msg = null; }, 5000);
  }

  reviewChecklist: { label: string; pass: boolean; detail?: string }[] = [];

  computeReviewChecklist() {
    if (!this.detail) { this.reviewChecklist = []; return; }
    const o = this.detail.order;
    const evs = this.detail.evidences;
    const has = (t: string) => evs.some((e: any) => e.type === t);
    this.reviewChecklist = [
      { label: '设备借用证据（签收单）', pass: has('borrow'), detail: has('borrow') ? '已上传' : '缺少，需登记员补传借用签收凭证' },
      { label: '归还验收证据', pass: has('return'), detail: has('return') ? '已上传' : '缺少，需登记员补传归还验收清单' },
      { label: '损耗说明一致性', pass: !o.loss_remark || has('loss'), detail: o.loss_remark && !has('loss') ? '有损耗说明但未上传损耗确认凭证' : (has('loss') && !o.loss_remark ? '有损耗证据但未填写损耗说明' : '一致') },
      { label: '借用理由充分', pass: (o.borrow_reason?.length || 0) >= 5, detail: (o.borrow_reason?.length || 0) < 5 ? '理由过短' : '满足' }
    ];
  }

  canDo(action: string) {
    if (!this.detail || !this.user) return false;
    const o = this.detail.order;
    const role = this.user.role;
    switch (action) {
      case 'edit':
      case 'submit':
        return role === 'registrar'
          && o.created_by === this.user.id
          && ['draft', 'audit_rejected', 'review_rejected'].includes(o.status);
      case 'audit_approve':
      case 'audit_reject':
        return role === 'auditor' && o.status === 'pending_audit';
      case 'review_approve':
      case 'review_reject':
        return role === 'reviewer' && ['pending_review', 'review_rejected'].includes(o.status);
      case 'add_evidence':
      case 'delete_evidence':
        return role === 'registrar' && o.created_by === this.user.id && o.status !== 'archived';
      default:
        return false;
    }
  }

  actionDisabledHint(action: string) {
    if (!this.detail || !this.user) return '';
    const o = this.detail.order;
    const role = this.user.role;
    if (action === 'audit_approve' || action === 'audit_reject') {
      if (role !== 'auditor') return '仅审核主管可办理';
      if (o.status !== 'pending_audit') return `当前状态为【${this.statusLabels[o.status][0]}】，不可审核`;
    }
    if (action === 'review_approve' || action === 'review_reject') {
      if (role !== 'reviewer') return '仅复核负责人可办理';
      if (!['pending_review', 'review_rejected'].includes(o.status)) return `当前状态为【${this.statusLabels[o.status][0]}】，不可复核`;
    }
    if (action === 'submit') {
      if (role !== 'registrar') return '仅登记员可提交';
      if (!['draft', 'audit_rejected', 'review_rejected'].includes(o.status)) return '当前状态不可提交审核';
    }
    return '';
  }

  openActionDialog(dialog: string) {
    if (dialog === 'review_approve') this.actionForm.decision = 'approve';
    if (dialog === 'review_reject') this.actionForm.decision = 'reject';
    if (dialog === 'audit_approve') this.actionForm.decision = 'approve';
    if (dialog === 'audit_reject') this.actionForm.decision = 'reject';
    this.actionForm.comment = '';
    this.actionDialog = dialog;
  }

  closeDialog() { this.actionDialog = ''; this.evidenceDialog = false; }

  runSubmit() {
    if (!this.detail) return;
    this.submitting = true;
    this.orderService.submit(this.detail.order.id, {
      version: this.detail.order.version,
      comment: this.actionForm.comment
    }).subscribe({
      next: r => {
        this.submitting = false;
        if (r.code === 0) { this.detail = r.data; this.closeDialog(); this.flash('success', '已提交审核'); this.computeReviewChecklist(); }
        else this.flash('error', r.message);
      },
      error: e => { this.submitting = false; this.flash('error', e.error?.message || e.message); }
    });
  }

  runAudit() {
    if (!this.detail) return;
    const decision = this.actionDialog === 'audit_approve' ? 'approve' : 'reject';
    this.submitting = true;
    this.orderService.audit(this.detail.order.id, decision, {
      comment: this.actionForm.comment,
      version: this.detail.order.version
    }).subscribe({
      next: r => {
        this.submitting = false;
        if (r.code === 0) { this.detail = r.data; this.closeDialog(); this.flash('success', decision === 'approve' ? '审核通过' : '已驳回'); this.computeReviewChecklist(); }
        else this.flash('error', r.message);
      },
      error: e => { this.submitting = false; this.flash('error', e.error?.message || e.message); }
    });
  }

  runReview() {
    if (!this.detail) return;
    const decision = this.actionDialog === 'review_approve' ? 'approve' : 'reject';
    this.submitting = true;
    this.orderService.review(this.detail.order.id, decision, {
      comment: this.actionForm.comment,
      version: this.detail.order.version,
      actual_return_date: this.detail.order.actual_return_date || new Date().toISOString().slice(0, 10),
      loss_remark: this.detail.order.loss_remark
    }).subscribe({
      next: r => {
        this.submitting = false;
        if (r.code === 0) { this.detail = r.data; this.closeDialog(); this.flash('success', decision === 'approve' ? '复核通过，已归档' : '已驳回'); this.computeReviewChecklist(); }
        else this.flash('error', r.message + (r.failureReason ? '（' + r.failureReason + '）' : ''));
      },
      error: e => {
        this.submitting = false;
        let msg = e.error?.message || e.message;
        if (e.error?.failureReason) msg += `\n【原因】${e.error.failureReason}`;
        this.flash('error', msg);
      }
    });
  }

  runAction() {
    if (this.actionDialog.startsWith('submit')) this.runSubmit();
    else if (this.actionDialog.startsWith('audit')) this.runAudit();
    else if (this.actionDialog.startsWith('review')) this.runReview();
  }

  openEvidenceDialog() {
    this.evidenceForm = { type: 'borrow', description: '', file_name: '' };
    this.evidenceDialog = true;
  }

  uploadEvidence() {
    if (!this.detail || !this.evidenceForm.description.trim()) { alert('请填写证据描述'); return; }
    this.submitting = true;
    this.orderService.addEvidence(this.detail.order.id, this.evidenceForm).subscribe({
      next: r => {
        this.submitting = false;
        if (r.code === 0) { this.closeDialog(); this.loadDetail(); this.flash('success', '证据已上传'); }
        else this.flash('error', r.message);
      },
      error: e => { this.submitting = false; this.flash('error', e.error?.message || e.message); }
    });
  }

  deleteEvidence(id: number) {
    if (!confirm('确定删除该证据？')) return;
    this.orderService.deleteEvidence(id).subscribe({
      next: r => {
        if (r.code === 0) { this.loadDetail(); this.flash('success', '证据已删除'); }
        else this.flash('error', r.message);
      },
      error: e => this.flash('error', e.error?.message || e.message)
    });
  }

  flowStepStatus(step: any) {
    if (!this.detail) return 'pending';
    const o = this.detail.order;
    const order = ['draft', 'pending_audit', 'audit_decide', 'pending_review', 'review_decide', 'archived'];
    const idx = order.indexOf(step.key);
    const currentStatus = o.status;
    const currentIdx: number = (() => {
      switch (currentStatus) {
        case 'draft': return 0;
        case 'pending_audit': return 1;
        case 'audit_rejected': return 1;
        case 'pending_review': return 3;
        case 'review_rejected': return 3;
        case 'archived': return 5;
        default: return 0;
      }
    })();
    if (step.decider && step.key === 'audit_decide') {
      if (currentStatus === 'audit_rejected') return 'rejected';
      if (currentIdx >= 3) return 'done';
      if (currentIdx === 2) return 'current';
      return 'pending';
    }
    if (step.decider && step.key === 'review_decide') {
      if (currentStatus === 'review_rejected') return 'rejected';
      if (currentIdx >= 5) return 'done';
      if (currentIdx === 4) return 'current';
      if (currentIdx >= 3) return 'current';
      return 'pending';
    }
    if (idx < currentIdx) return 'done';
    if (idx === currentIdx) return 'current';
    return 'pending';
  }

  backToList() {
    this.router.navigate(['/queue'], { queryParams: { highlight: this.id } });
  }
}
