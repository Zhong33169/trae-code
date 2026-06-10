import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  RepairOrder,
  OrderStatus,
  RiskLevel,
  OrderStage,
  STATUS_NAMES,
  STATUS_BADGE_CLASSES,
  RISK_NAMES,
  RISK_BADGE_CLASSES,
  STAGE_NAMES,
  ROLE_NAMES,
  EVIDENCE_OPTIONS,
  UserRole,
} from '../../models';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';

type ActionKey =
  | 'submit'
  | 'resubmit'
  | 'supervisor_approve'
  | 'supervisor_reject'
  | 'reviewer_approve'
  | 'reviewer_reject'
  | 'change_risk'
  | 'archive'
  | null;

@Component({
  selector: 'app-order-detail',
  templateUrl: './order-detail.component.html',
  styleUrls: ['./order-detail.component.css'],
})
export class OrderDetailComponent implements OnInit {
  order!: RepairOrder;
  loading = true;
  errorMsg = '';

  currentRole: UserRole = 'registrar';
  currentUserId = 1;

  activeAction: ActionKey = null;
  submitting = false;

  opinionForm: FormGroup;
  rectifyForm: FormGroup;
  riskForm: FormGroup;
  resubmitEvidenceChecked: string[] = [];

  readonly STATUS_NAMES = STATUS_NAMES;
  readonly STATUS_BADGE_CLASSES = STATUS_BADGE_CLASSES;
  readonly RISK_NAMES = RISK_NAMES;
  readonly RISK_BADGE_CLASSES = RISK_BADGE_CLASSES;
  readonly STAGE_NAMES = STAGE_NAMES;
  readonly ROLE_NAMES = ROLE_NAMES;
  readonly EVIDENCE_OPTIONS = EVIDENCE_OPTIONS;

  stages: { key: OrderStage; label: string; icon: string }[] = [
    { key: 'appointment', label: '预约阶段', icon: '📅' },
    { key: 'dispatch', label: '派单阶段', icon: '🔧' },
    { key: 'delivery', label: '交付阶段', icon: '🚗' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.opinionForm = this.fb.group({
      opinion: ['', [Validators.required]],
      result: [''],
      risk_override: [''],
      final_cost: [null],
    });

    this.rectifyForm = this.fb.group({
      customer_name: [''],
      phone: [''],
      vehicle_plate: [''],
      vehicle_model: [''],
      mileage: [null],
      problem_description: [''],
      repair_items: [''],
      estimated_cost: [null],
      opinion: ['', [Validators.required]],
    });

    this.riskForm = this.fb.group({
      from_level: [''],
      to_level: ['medium', [Validators.required]],
      reason: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.currentRole = this.authService.getCurrentUserRole();
    this.currentUserId = this.authService.getCurrentUserId();
    this.authService.currentUser$.subscribe((u) => {
      this.currentRole = u.role;
      this.currentUserId = u.id;
    });

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.router.navigate(['/orders']);
      return;
    }
    this.loadOrder(id);
  }

  loadOrder(id: number): void {
    this.loading = true;
    this.errorMsg = '';
    this.orderService.getOrder(id).subscribe({
      next: (o) => {
        this.order = o;
        this.loading = false;
      },
      error: (e) => {
        this.errorMsg = '加载工单失败：' + (e?.message || '请稍后再试');
        this.loading = false;
      },
    });
  }

  getStageStatus(key: OrderStage): 'done' | 'active' | '' {
    if (!this.order) return '';
    const order: OrderStage = this.order.stage;
    const idx = this.stages.findIndex((s) => s.key === order);
    const myIdx = this.stages.findIndex((s) => s.key === key);
    if (myIdx < idx) return 'done';
    if (myIdx === idx) return 'active';
    return '';
  }

  get lastOpinionClass(): string {
    if (!this.order || !this.order.last_result) return '';
    const r = this.order.last_result || '';
    if (r.includes('退回') || r.includes('拒绝') || r.includes('不通过')) return 'danger';
    if (r.includes('通过') || r.includes('同意')) return 'success';
    if (r.includes('升级') || r.includes('风险')) return 'warning';
    return '';
  }

  hasLastOpinion(): boolean {
    return !!(this.order?.last_opinion || this.order?.last_result);
  }

  get availableActions(): { key: ActionKey; label: string; cls: string }[] {
    if (!this.order) return [];
    const actions: { key: ActionKey; label: string; cls: string }[] = [];
    const s: OrderStatus = this.order.status;
    const isOwner = this.order.created_by_id === this.currentUserId;

    if (this.currentRole === 'registrar') {
      if (s === 'draft' && isOwner) {
        actions.push({ key: 'submit', label: '提交审批', cls: 'btn-primary' });
      }
      if (s === 'returned_to_registrar' && isOwner) {
        actions.push({ key: 'resubmit', label: '重新提交', cls: 'btn-primary' });
      }
    }

    if (this.currentRole === 'supervisor') {
      if (s === 'submitted' || s === 'resubmitted') {
        actions.push({ key: 'supervisor_approve', label: '通过', cls: 'btn-success' });
        actions.push({ key: 'supervisor_reject', label: '退回登记员', cls: 'btn-danger' });
        actions.push({ key: 'change_risk', label: '升级风险', cls: 'btn-warning' });
      }
      if (s === 'high_risk_escalated') {
        actions.push({ key: 'supervisor_approve', label: '审批通过', cls: 'btn-success' });
        actions.push({ key: 'supervisor_reject', label: '审批拒绝', cls: 'btn-danger' });
        actions.push({ key: 'change_risk', label: '调整风险', cls: 'btn-warning' });
      }
      if (s === 'reviewer_rejected') {
        actions.push({ key: 'supervisor_approve', label: '重做后再提交复核', cls: 'btn-success' });
        actions.push({ key: 'supervisor_reject', label: '退回登记员处理', cls: 'btn-danger' });
        actions.push({ key: 'change_risk', label: '调整风险', cls: 'btn-warning' });
      }
      if (s === 'supervisor_approved') {
        actions.push({ key: 'change_risk', label: '调整风险', cls: 'btn-warning' });
      }
    }

    if (this.currentRole === 'reviewer') {
      if (s === 'supervisor_approved' || s === 'high_risk_escalated') {
        actions.push({ key: 'reviewer_approve', label: '复核通过', cls: 'btn-success' });
        actions.push({ key: 'reviewer_reject', label: '复核拒绝', cls: 'btn-danger' });
      }
      if (s === 'reviewer_approved') {
        actions.push({ key: 'archive', label: '归档', cls: 'btn-primary' });
      }
    }

    // 风险调整入口严格按角色+状态控制：只有主管/复核员 + 非归档 + 当前是处理人才能显示
    const hasRiskAction = actions.some((a) => a.key === 'change_risk');
    if (!hasRiskAction && !['archived', 'draft'].includes(s)) {
      const canAdjustRisk =
        (this.currentRole === 'supervisor' && this.order.current_handler === 'supervisor') ||
        (this.currentRole === 'reviewer' && this.order.current_handler === 'reviewer');
      if (canAdjustRisk) {
        actions.push({ key: 'change_risk', label: '调整风险', cls: 'btn-warning' });
      }
    }

    return actions;
  }

  canEdit(): boolean {
    if (!this.order) return false;
    return (
      this.currentRole === 'registrar' &&
      this.order.created_by_id === this.currentUserId &&
      ['draft', 'returned_to_registrar'].includes(this.order.status)
    );
  }

  openAction(key: ActionKey): void {
    this.activeAction = key;
    this.opinionForm.reset({
      opinion: '',
      result: '',
      risk_override: '',
      final_cost: null,
    });

    if (key === 'resubmit' && this.order) {
      const evList = this.order.evidence_list || '';
      this.resubmitEvidenceChecked = evList.split(',').filter(Boolean);
      this.rectifyForm.reset({
        customer_name: this.order.customer_name || '',
        phone: this.order.phone || '',
        vehicle_plate: this.order.vehicle_plate || '',
        vehicle_model: this.order.vehicle_model || '',
        mileage: this.order.mileage || null,
        problem_description: this.order.problem_description || '',
        repair_items: this.order.repair_items || '',
        estimated_cost: this.order.estimated_cost || null,
        opinion: '',
      });
    }

    if (key === 'change_risk' && this.order) {
      this.riskForm.reset({
        from_level: this.order.risk_level,
        to_level: this.order.risk_level,
        reason: '',
      });
    }
  }

  cancelAction(): void {
    this.activeAction = null;
    this.resubmitEvidenceChecked = [];
  }

  toggleResubmitEvidence(item: string): void {
    const idx = this.resubmitEvidenceChecked.indexOf(item);
    if (idx >= 0) {
      this.resubmitEvidenceChecked.splice(idx, 1);
    } else {
      this.resubmitEvidenceChecked.push(item);
    }
  }

  hasResubmitEvidence(item: string): boolean {
    return this.resubmitEvidenceChecked.includes(item);
  }

  performAction(): void {
    const version = this.order?.version ?? 0;

    switch (this.activeAction) {
      case 'submit': {
        if (this.opinionForm.get('opinion')?.invalid) {
          this.opinionForm.markAllAsTouched();
          return;
        }
        this.submitting = true;
        this.orderService.submitOrder(this.order.id, { version }).subscribe({
          next: () => this.handleSuccess(),
          error: (e) => this.handleError(e),
        });
        break;
      }

      case 'resubmit': {
        if (this.rectifyForm.invalid) {
          this.rectifyForm.markAllAsTouched();
          return;
        }
        this.submitting = true;
        const val = this.rectifyForm.value;
        const payload: any = {
          version,
          opinion: val.opinion,
          evidence_submitted: true,
        };
        if (val.customer_name) payload.customer_name = val.customer_name;
        if (val.phone) payload.phone = val.phone;
        if (val.vehicle_plate) payload.vehicle_plate = val.vehicle_plate;
        if (val.vehicle_model) payload.vehicle_model = val.vehicle_model;
        if (val.mileage != null) payload.mileage = val.mileage;
        if (val.problem_description) payload.problem_description = val.problem_description;
        if (val.repair_items) payload.repair_items = val.repair_items;
        if (val.estimated_cost != null) payload.estimated_cost = val.estimated_cost;
        if (this.resubmitEvidenceChecked.length > 0) {
          payload.evidence_list = this.resubmitEvidenceChecked.join(',');
        }
        this.orderService.rectifyOrder(this.order.id, payload).subscribe({
          next: () => this.handleSuccess(),
          error: (e) => this.handleError(e),
        });
        break;
      }

      case 'supervisor_approve': {
        if (this.opinionForm.get('opinion')?.invalid) {
          this.opinionForm.markAllAsTouched();
          return;
        }
        this.submitting = true;
        const val = this.opinionForm.value;
        const payload: any = {
          version,
          action: 'approve' as const,
          opinion: val.opinion,
          result: val.result || '通过审批',
        };
        if (val.risk_override) {
          payload.risk_override = val.risk_override as RiskLevel;
        }
        this.orderService.supervisorReview(this.order.id, payload).subscribe({
          next: () => this.handleSuccess(),
          error: (e) => this.handleError(e),
        });
        break;
      }

      case 'supervisor_reject': {
        if (this.opinionForm.get('opinion')?.invalid) {
          this.opinionForm.markAllAsTouched();
          return;
        }
        this.submitting = true;
        const val = this.opinionForm.value;
        this.orderService.supervisorReview(this.order.id, {
          version,
          action: 'reject',
          opinion: val.opinion,
          result: val.result || '退回登记员修改',
        }).subscribe({
          next: () => this.handleSuccess(),
          error: (e) => this.handleError(e),
        });
        break;
      }

      case 'reviewer_approve': {
        if (this.opinionForm.get('opinion')?.invalid) {
          this.opinionForm.markAllAsTouched();
          return;
        }
        this.submitting = true;
        const val = this.opinionForm.value;
        const payload: any = {
          version,
          action: 'approve' as const,
          opinion: val.opinion,
          result: val.result || '复核通过',
        };
        if (val.final_cost != null) {
          payload.final_cost = val.final_cost;
        }
        this.orderService.reviewerReview(this.order.id, payload).subscribe({
          next: () => this.handleSuccess(),
          error: (e) => this.handleError(e),
        });
        break;
      }

      case 'reviewer_reject': {
        if (this.opinionForm.get('opinion')?.invalid) {
          this.opinionForm.markAllAsTouched();
          return;
        }
        this.submitting = true;
        const val = this.opinionForm.value;
        this.orderService.reviewerReview(this.order.id, {
          version,
          action: 'reject',
          opinion: val.opinion,
          result: val.result || '复核拒绝',
        }).subscribe({
          next: () => this.handleSuccess(),
          error: (e) => this.handleError(e),
        });
        break;
      }

      case 'change_risk': {
        if (this.riskForm.invalid) {
          this.riskForm.markAllAsTouched();
          return;
        }
        this.submitting = true;
        const val = this.riskForm.value;
        const from_level = (val.from_level || this.order.risk_level) as RiskLevel;
        const to_level = val.to_level as RiskLevel;

        if (
          this.currentRole === 'supervisor' &&
          from_level !== 'high' &&
          to_level === 'high' &&
          ['submitted', 'resubmitted'].includes(this.order.status)
        ) {
          this.orderService.supervisorReview(this.order.id, {
            version,
            action: 'escalate_risk',
            opinion: val.reason,
            result: `风险升级：${RISK_NAMES[from_level]} → ${RISK_NAMES[to_level]}`,
          }).subscribe({
            next: () => this.handleSuccess(),
            error: (e) => this.handleError(e),
          });
        } else {
          this.orderService.riskChange(this.order.id, {
            version,
            from_level,
            to_level,
            reason: val.reason,
          }).subscribe({
            next: () => this.handleSuccess(),
            error: (e) => this.handleError(e),
          });
        }
        break;
      }

      case 'archive': {
        this.submitting = true;
        this.orderService.reviewerReview(this.order.id, {
          version,
          action: 'approve',
          opinion: '归档工单',
          result: '归档',
        }).subscribe({
          next: () => this.handleSuccess(),
          error: (e) => this.handleError(e),
        });
        break;
      }
    }
  }

  private handleSuccess(): void {
    this.submitting = false;
    this.activeAction = null;
    this.resubmitEvidenceChecked = [];
    this.loadOrder(this.order.id);
  }

  private handleError(e: any): void {
    this.submitting = false;
    alert('操作失败：' + (e?.error?.message || e?.message || '请稍后再试'));
  }

  formatDate(d: string): string {
    if (!d) return '-';
    return d.substring(0, 19).replace('T', ' ');
  }

  getEvidenceList(): string[] {
    const s = this.order?.evidence_list || '';
    return s.split(',').filter(Boolean);
  }

  goBack(): void {
    this.router.navigate(['/orders']);
  }
}
