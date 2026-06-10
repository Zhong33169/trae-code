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

interface OperationFailureDetail {
  error: string;
  current_version: number;
  current_handler: string;
  current_status: string;
  evidence_check?: string;
}

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
  lastFailure: OperationFailureDetail | null = null;

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
    if (r.includes('退回') || r.includes('拒绝') || r.includes('不通过') || r.includes('失败')) return 'danger';
    if (r.includes('通过') || r.includes('同意')) return 'success';
    if (r.includes('升级') || r.includes('风险')) return 'warning';
    return '';
  }

  hasLastOpinion(): boolean {
    return !!(this.order?.last_opinion || this.order?.last_result);
  }

  get canSubmitEvidence(): boolean {
    if (!this.order) return false;
    return this.order.evidence_submitted && this.getEvidenceList().length > 0;
  }

  get evidenceWarningMsg(): string {
    if (!this.order) return '';
    const warnings: string[] = [];
    if (!this.order.evidence_submitted) {
      warnings.push('证据标记未勾选(evidence_submitted=false)');
    }
    if (this.getEvidenceList().length === 0) {
      warnings.push('证据清单为空(evidence_list=[])');
    }
    return warnings.join('；');
  }

  get canResubmitEvidence(): boolean {
    return this.resubmitEvidenceChecked.length > 0;
  }

  get riskToLevelInvalid(): boolean {
    const to = this.riskForm.get('to_level')?.value;
    const from = this.riskForm.get('from_level')?.value;
    return to === from;
  }

  get failureHandlerName(): string {
    if (!this.lastFailure?.current_handler) return '-';
    const handler = this.lastFailure.current_handler as UserRole;
    return this.ROLE_NAMES[handler] || this.lastFailure.current_handler;
  }

  get failureStatusName(): string {
    if (!this.lastFailure?.current_status) return '-';
    const status = this.lastFailure.current_status as OrderStatus;
    return this.STATUS_NAMES[status] || this.lastFailure.current_status;
  }

  get failureVersionLabel(): string {
    if (this.lastFailure?.current_version == null) return '-';
    return 'v' + this.lastFailure.current_version;
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
    this.lastFailure = null;
    this.opinionForm.reset({
      opinion: '',
      result: '',
      risk_override: '',
      final_cost: null,
    });

    if (key === 'resubmit' && this.order) {
      const evList = this.order.evidence_list || '[]';
      try {
        const parsed = JSON.parse(evList);
        this.resubmitEvidenceChecked = Array.isArray(parsed) ? [...parsed] : [];
      } catch {
        this.resubmitEvidenceChecked = evList.split(',').filter(Boolean);
      }
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
    this.lastFailure = null;
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
    this.lastFailure = null;

    switch (this.activeAction) {
      case 'submit': {
        if (!this.canSubmitEvidence) {
          this.lastFailure = {
            error: this.evidenceWarningMsg || '证据不满足提交条件',
            current_version: this.order.version,
            current_handler: this.order.current_handler,
            current_status: this.order.status,
            evidence_check: this.evidenceWarningMsg,
          };
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
        if (!this.canResubmitEvidence) {
          this.lastFailure = {
            error: '请至少勾选一项证据资料(evidence_list不能为空)',
            current_version: this.order.version,
            current_handler: this.order.current_handler,
            current_status: this.order.status,
            evidence_check: 'evidence_list=[]',
          };
          return;
        }
        this.submitting = true;
        const val = this.rectifyForm.value;
        const payload: any = {
          version,
          opinion: val.opinion,
          evidence_submitted: true,
          evidence_list: JSON.stringify(this.resubmitEvidenceChecked),
        };
        if (val.customer_name) payload.customer_name = val.customer_name;
        if (val.phone) payload.phone = val.phone;
        if (val.vehicle_plate) payload.vehicle_plate = val.vehicle_plate;
        if (val.vehicle_model) payload.vehicle_model = val.vehicle_model;
        if (val.mileage != null) payload.mileage = val.mileage;
        if (val.problem_description) payload.problem_description = val.problem_description;
        if (val.repair_items) payload.repair_items = val.repair_items;
        if (val.estimated_cost != null) payload.estimated_cost = val.estimated_cost;
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
        if (this.riskToLevelInvalid) {
          this.lastFailure = {
            error: '目标风险等级不能与当前等级相同，请选择不同的等级',
            current_version: this.order.version,
            current_handler: this.order.current_handler,
            current_status: this.order.status,
          };
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
    this.lastFailure = null;
    this.resubmitEvidenceChecked = [];
    this.loadOrder(this.order.id);
  }

  private handleError(e: any): void {
    this.submitting = false;
    const errBody = e?.error;
    if (errBody && typeof errBody === 'object' && errBody.error) {
      this.lastFailure = {
        error: errBody.error,
        current_version: errBody.current_version ?? this.order.version,
        current_handler: errBody.current_handler ?? this.order.current_handler,
        current_status: errBody.current_status ?? this.order.status,
        evidence_check: errBody.evidence_check || '',
      };
    } else {
      this.lastFailure = {
        error: e?.message || '操作失败，请稍后再试',
        current_version: this.order.version,
        current_handler: this.order.current_handler,
        current_status: this.order.status,
      };
    }
  }

  formatDate(d: string): string {
    if (!d) return '-';
    return d.substring(0, 19).replace('T', ' ');
  }

  getEvidenceList(): string[] {
    const s = this.order?.evidence_list || '[]';
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed : s.split(',').filter(Boolean);
    } catch {
      return s.split(',').filter(Boolean);
    }
  }

  goBack(): void {
    this.router.navigate(['/orders']);
  }
}
