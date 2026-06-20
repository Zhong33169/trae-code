import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { Subject, takeUntil, filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { OrderService, WriteRequestMeta } from '../../services/order.service';
import { User, OrderDetail, Evidence, OperationLog } from '../../models/app.models';

const STATUS_META: Record<string, [string, string]> = {
  draft: ['草稿', 'tag-draft'],
  pending_audit: ['待审核', 'tag-pending_audit'],
  audit_rejected: ['审核驳回（待补正）', 'tag-audit_rejected'],
  pending_review: ['待复核归档', 'tag-pending_review'],
  review_rejected: ['复核驳回（待补正）', 'tag-review_rejected'],
  archived: ['已归档', 'tag-archived']
};

const EVIDENCE_META: Record<string, [string, string]> = {
  borrow: ['借用', 'tag-borrow'],
  return: ['归还验收', 'tag-return'],
  loss:   ['损耗确认', 'tag-loss']
};

const FLOW_STEPS = [
  { key: 'draft',         label: '创建草稿' },
  { key: 'pending_audit', label: '登记员提交' },
  { key: 'audit_decide',  label: '审核主管办理', decider: true },
  { key: 'pending_review',label: '审核通过待复核' },
  { key: 'review_decide', label: '复核负责人办理', decider: true },
  { key: 'archived',      label: '归档完成' }
];

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-detail.component.html',
  styleUrls: ['./order-detail.component.css']
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  user: User | null = null;
  detail: OrderDetail | null = null;
  loading = true;
  submitting = false;
  id = 0;

  tab = 'info';
  actionDialog = '';
  actionForm: any = { comment: '', decision: 'approve' };
  evidenceDialog = false;
  evidenceForm: any = { type: 'borrow', description: '', file_name: '' };

  msg: { type: 'success' | 'error' | 'warn' | 'info'; text: string } | null = null;

  // ===== 下沉计算字段 =====
  readonly flowSteps = FLOW_STEPS;
  reviewChecklist: { label: string; pass: boolean; detail?: string }[] = [];

  constructor(
    public auth: AuthService,
    private orderService: OrderService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  // ================= 生命周期与刷新联动 =================
  ngOnInit() {
    this.auth.user$.pipe(takeUntil(this.destroy$)).subscribe(u => {
      const prevRole = this.user?.role;
      this.user = u;
      // 角色切换：若当前详情对新角色不合适（如 auditor 正在看自己没法办的单），回队列
      if (prevRole && prevRole !== u?.role) {
        this.router.navigate(['/queue'], { replaceUrl: true, queryParams: { highlight: this.id } });
        return;
      }
      if (this.detail) this.refreshDetailIfNeeded();
    });

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(m => {
      const id = parseInt(m.get('id') || '0');
      if (id > 0) { this.id = id; this.loadDetail(); }
    });

    // 全局事件：detail 相关变更触发重加载
    this.orderService.refreshEvents$.pipe(
      takeUntil(this.destroy$),
      filter(ev => ev.kind === 'all' || (ev.kind === 'detail' && ev.orderId === this.id))
    ).subscribe(() => { if (this.id) this.loadDetail(); });
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  // ================= 数据加载 =================
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
  private refreshDetailIfNeeded() { if (this.id) this.loadDetail(); }

  // ================= UI 辅助（下沉）=================
  statusMeta(s: string): { label: string; css: string } {
    const m = STATUS_META[s];
    return { label: m?.[0] || s, css: m?.[1] || 'tag-draft' };
  }
  evidenceMeta(t: string): { label: string; css: string } {
    const m = EVIDENCE_META[t];
    return { label: m?.[0] || t, css: m?.[1] || '' };
  }
  formatDateTime(s?: string): string { return s ? s.slice(5, 16) : ''; }
  evidencesByType(t: 'borrow' | 'return' | 'loss'): Evidence[] {
    return (this.detail?.evidences || []).filter(e => e.type === t);
  }
  evidenceCount(t: 'borrow' | 'return' | 'loss'): number { return this.evidencesByType(t).length; }
  logsOrdered(): OperationLog[] {
    return [...(this.detail?.logs || [])].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }
  actionLabel(kind: string): string {
    const map: Record<string, string> = {
      create: '创建草稿', submit: '提交审核', audit_approve: '审核通过',
      audit_reject: '审核驳回', review_approve: '复核通过归档',
      review_reject: '复核驳回', review_fail: '复核校验未通过',
      add_evidence: '上传证据', delete_evidence: '删除证据'
    };
    return map[kind] || kind;
  }

  // ================= 下沉：流程步骤状态 =================
  flowStepStatus(stepKey: string, decider: boolean): 'done' | 'current' | 'pending' | 'rejected' {
    if (!this.detail) return 'pending';
    const currentStatus = this.detail.order.status;
    const currentIdx: number = (() => {
      switch (currentStatus) {
        case 'draft': return 0;
        case 'pending_audit':
        case 'audit_rejected': return 1;
        case 'pending_review':
        case 'review_rejected': return 3;
        case 'archived': return 5;
        default: return 0;
      }
    })();
    const idx = FLOW_STEPS.findIndex(s => s.key === stepKey);
    if (decider && stepKey === 'audit_decide') {
      if (currentStatus === 'audit_rejected') return 'rejected';
      if (currentIdx >= 3) return 'done';
      if (currentIdx === 1) return 'current';
      return 'pending';
    }
    if (decider && stepKey === 'review_decide') {
      if (currentStatus === 'review_rejected') return 'rejected';
      if (currentIdx >= 5) return 'done';
      if (currentIdx === 3) return 'current';
      return 'pending';
    }
    if (idx < currentIdx) return 'done';
    if (idx === currentIdx) return 'current';
    return 'pending';
  }

  // ================= 下沉：失败/提示框可见性 =================
  get showFailureBox(): boolean {
    return !!(this.detail?.order.last_failure_reason
      || (this.detail?.order.audit_comment && this.detail.order.status === 'audit_rejected')
      || (this.detail?.order.review_comment && ['review_rejected', 'pending_review'].includes(this.detail.order.status)));
  }
  get failureReasons(): { label: string; lines: string[] }[] {
    if (!this.detail) return [];
    const sections: { label: string; lines: string[] }[] = [];
    if (this.detail.order.audit_comment && this.detail.order.status === 'audit_rejected')
      sections.push({ label: '审核驳回意见', lines: this.detail.order.audit_comment.split(/[\n;；]/).map(s => s.trim()).filter(Boolean) });
    if (this.detail.order.review_comment && ['review_rejected'].includes(this.detail.order.status))
      sections.push({ label: '复核驳回意见', lines: this.detail.order.review_comment.split(/[\n;；]/).map(s => s.trim()).filter(Boolean) });
    if (this.detail.order.last_failure_reason) {
      // 后端 failureReason 使用 ；分隔的多条错误
      const lines = this.detail.order.last_failure_reason.split(/[；;]/).map(s => s.trim()).filter(Boolean);
      sections.push({ label: '最近一次复核失败原因（需补正）', lines });
    }
    return sections;
  }
  get showReviewChecklist(): boolean {
    if (!this.detail || !this.user) return false;
    const s = this.detail.order.status;
    return this.user.role === 'reviewer' && (s === 'pending_review' || s === 'review_rejected');
  }
  get checklistPassAll(): boolean {
    return this.reviewChecklist.length > 0 && this.reviewChecklist.every(x => x.pass);
  }
  get checklistHint(): string {
    if (this.checklistPassAll) return '当前复核清单全部满足，可以执行复核归档；下方仍会进行后端强校验。';
    return '清单存在未满足项，请先让登记员补正后再复核，避免被后端强拦截。';
  }

  // ================= 下沉：操作权限与提示 =================
  canDo(action: string): boolean {
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
  actionDisabledHint(action: string): string {
    if (!this.detail || !this.user) return '';
    const o = this.detail.order;
    const role = this.user.role;
    if (action === 'audit_approve' || action === 'audit_reject') {
      if (role !== 'auditor') return '仅审核主管可办理';
      if (o.status !== 'pending_audit') return `当前状态为【${this.statusMeta(o.status).label}】，不可审核`;
    }
    if (action === 'review_approve' || action === 'review_reject') {
      if (role !== 'reviewer') return '仅复核负责人可办理';
      if (!['pending_review', 'review_rejected'].includes(o.status)) return `当前状态为【${this.statusMeta(o.status).label}】，不可复核`;
    }
    if (action === 'submit') {
      if (role !== 'registrar') return '仅登记员可提交';
      if (!['draft', 'audit_rejected', 'review_rejected'].includes(o.status)) return '当前状态不可提交审核';
    }
    if (action === 'add_evidence') {
      if (role !== 'registrar' || o.created_by !== this.user.id) return '仅单据创建人（登记员）可上传证据';
      if (o.status === 'archived') return '单据已归档，不可修改证据';
    }
    return '';
  }

  // ================= 下沉：办理说明（角色/状态复合判断）=================
  get workingGuide(): { title: string; actions: string[] } {
    if (!this.detail || !this.user) return { title: '', actions: [] };
    const o = this.detail.order;
    const role = this.user.role;
    if (role === 'registrar') {
      if (o.status === 'draft') return { title: '📝 你的任务：补全信息并提交审核', actions: ['完善借用单字段', '上传设备借用证据（签收单）', '提交审核进入审核岗流程'] };
      if (o.status === 'audit_rejected') return { title: '❌ 审核被驳回，请根据下方"审核意见"修改后重新提交', actions: ['修改字段', '补传缺失证据', '再次提交审核'] };
      if (o.status === 'review_rejected') return { title: '⚠️ 复核被驳回，请根据下方失败原因补正', actions: ['补传归还/损耗证据', '完善损耗说明（≥10字，含数量）', '再次提交审核进入复核'] };
      if (o.status === 'pending_audit') return { title: '⏳ 等待审核主管审核，你无法推进流程', actions: ['可查看详情，或在队列中查看其他单据'] };
      if (o.status === 'pending_review') return { title: '⏳ 等待复核负责人归档，你无法推进流程', actions: ['若复核失败被退回，需在此补正'] };
      if (o.status === 'archived') return { title: '✅ 单据已归档，全流程完成', actions: ['仅查看'] };
    }
    if (role === 'auditor') {
      if (o.status === 'pending_audit') return { title: '🔎 你是审核主管，可在此办理审核', actions: ['检查借用证据与理由', '通过：流转至复核岗；或驳回：填写驳回理由返回登记员'] };
      return { title: `当前状态【${this.statusMeta(o.status).label}】，不在你的办理环节`, actions: ['请切换到审核待办队列查看待办'] };
    }
    if (role === 'reviewer') {
      if (o.status === 'pending_review' || o.status === 'review_rejected')
        return { title: '🗂 你是复核负责人，可在此执行复核归档', actions: [
          '核对下方"复核清单"',
          '检查：借用证据、归还验收证据（含数量）、损耗说明与损耗证据一致',
          '全部通过 → 归档；不满足 → 逐条说明原因后退回登记员'
        ]};
      return { title: `当前状态【${this.statusMeta(o.status).label}】，不在你的办理环节`, actions: ['请切换到复核待办队列查看待办'] };
    }
    return { title: '', actions: [] };
  }

  // ================= 复核清单 =================
  private computeReviewChecklist() {
    if (!this.detail) { this.reviewChecklist = []; return; }
    const o = this.detail.order;
    const evs = this.detail.evidences;
    const has = (t: string) => evs.some((e: any) => e.type === t);
    const any = (t: string, pred: (e: Evidence) => boolean) => evs.filter(e => e.type === t).some(pred);
    this.reviewChecklist = [
      { label: '① 设备借用证据（签收单）', pass: has('borrow'), detail: has('borrow') ? '已上传' : '缺少，需登记员补传借用签收凭证' },
      { label: '② 归还验收证据（含数量核对）', pass: has('return'), detail: has('return') ? '已上传，后端会校验描述中是否提及借出数量' : '缺少，需登记员补传归还验收清单' },
      { label: '③ 损耗说明与损耗证据一致性',
        pass: !o.loss_remark || (has('loss') && (o.loss_remark?.length || 0) >= 10 && /\d/.test(o.loss_remark || '')),
        detail: o.loss_remark
          ? (has('loss')
              ? (((o.loss_remark?.length || 0) >= 10 && /\d/.test(o.loss_remark || ''))
                  ? '已匹配（≥10字且含数量）'
                  : `损耗说明 ${o.loss_remark?.length || 0} 字${(/\d/.test(o.loss_remark || '') ? '' : '、未提及数量')}，需完善`)
              : '有损耗说明但未上传损耗确认凭证')
          : (has('loss') ? '有损耗证据但未填写损耗说明' : '一致') },
      { label: '④ 借用理由充分（≥5字）', pass: (o.borrow_reason?.length || 0) >= 5, detail: (o.borrow_reason?.length || 0) < 5 ? '理由过短' : '满足' }
    ];
  }

  // ================= 操作执行 =================
  flash(type: any, text: string) {
    this.msg = { type, text };
    setTimeout(() => { if (this.msg?.text === text) this.msg = null; }, 5000);
  }
  openActionDialog(dialog: string) {
    if (this.submitting) return;
    if (!this.canDo(dialog.replace(/_approve|_reject/, '')) && !this.canDo(dialog)) {
      // 通用的权限提示
      const hint = this.actionDisabledHint(dialog);
      if (hint) { alert(hint); return; }
    }
    if (dialog === 'review_approve') this.actionForm.decision = 'approve';
    if (dialog === 'review_reject') this.actionForm.decision = 'reject';
    if (dialog === 'audit_approve') this.actionForm.decision = 'approve';
    if (dialog === 'audit_reject') this.actionForm.decision = 'reject';
    this.actionForm.comment = '';
    this.actionDialog = dialog;
  }
  closeDialog() { if (this.submitting) return; this.actionDialog = ''; this.evidenceDialog = false; }

  runSubmit() {
    if (!this.detail || this.submitting) return;
    const reqMeta: WriteRequestMeta = {
      requestId: OrderService.newRequestId(),
      action: 'submit',
      sentAt: Date.now()
    };
    this.submitting = true;
    const finish = () => { this.submitting = false; };
    this.orderService.submit(
      this.detail.order.id,
      { version: this.detail.order.version, comment: this.actionForm.comment },
      reqMeta.requestId
    ).subscribe({
      next: r => {
        finish();
        if (r.code === 0) { this.detail = r.data; this.closeDialog(); this.flash('success', '已提交审核'); this.computeReviewChecklist(); }
        else this.flash('error', r.message);
      },
      error: e => { finish(); this.flash('error', e.error?.message || e.message); }
    });
  }
  runAudit() {
    if (!this.detail || this.submitting) return;
    const decision = this.actionDialog === 'audit_approve' ? 'approve' : 'reject';
    const reqMeta: WriteRequestMeta = {
      requestId: OrderService.newRequestId(),
      action: 'audit',
      sentAt: Date.now()
    };
    this.submitting = true;
    const finish = () => { this.submitting = false; };
    this.orderService.audit(
      this.detail.order.id, decision,
      { version: this.detail.order.version, comment: this.actionForm.comment },
      reqMeta.requestId
    ).subscribe({
      next: r => {
        finish();
        if (r.code === 0) { this.detail = r.data; this.closeDialog(); this.flash('success', decision === 'approve' ? '审核通过' : '已驳回'); this.computeReviewChecklist(); }
        else this.flash('error', r.message);
      },
      error: e => { finish(); this.flash('error', e.error?.message || e.message); }
    });
  }
  runReview() {
    if (!this.detail || this.submitting) return;
    const decision = this.actionDialog === 'review_approve' ? 'approve' : 'reject';
    const reqMeta: WriteRequestMeta = {
      requestId: OrderService.newRequestId(),
      action: 'review',
      sentAt: Date.now()
    };
    this.submitting = true;
    const finish = () => { this.submitting = false; };
    this.orderService.review(
      this.detail.order.id, decision,
      {
        version: this.detail.order.version,
        comment: this.actionForm.comment,
        actual_return_date: this.detail.order.actual_return_date || new Date().toISOString().slice(0, 10),
        loss_remark: this.detail.order.loss_remark
      },
      reqMeta.requestId
    ).subscribe({
      next: r => {
        finish();
        if (r.code === 0) { this.detail = r.data; this.closeDialog(); this.flash('success', decision === 'approve' ? '复核通过，已归档' : '已驳回'); this.computeReviewChecklist(); }
        else this.flash('error', r.message + (r.failureReason ? '（' + r.failureReason + '）' : ''));
      },
      error: e => {
        finish();
        let msg = e.error?.message || e.message;
        if (e.error?.failureReason) msg += `\n【原因】${e.error.failureReason}`;
        this.flash('error', msg);
      }
    });
  }
  runAction() {
    if (this.submitting) return;
    if (this.actionDialog.startsWith('submit')) this.runSubmit();
    else if (this.actionDialog.startsWith('audit')) this.runAudit();
    else if (this.actionDialog.startsWith('review')) this.runReview();
  }

  openEvidenceDialog() {
    if (this.submitting) return;
    if (!this.canDo('add_evidence')) {
      const hint = this.actionDisabledHint('add_evidence');
      if (hint) { alert(hint); return; }
    }
    this.evidenceForm = { type: 'borrow', description: '', file_name: '' };
    this.evidenceDialog = true;
  }
  evidenceFormValid(): boolean {
    return !!(this.evidenceForm.type && this.evidenceForm.description?.trim());
  }
  uploadingEvidence = false;
  uploadEvidence() {
    if (!this.detail || this.submitting || this.uploadingEvidence) return;
    if (!this.evidenceFormValid()) { alert('请完整选择证据类型并填写描述'); return; }
    const reqMeta: WriteRequestMeta = {
      requestId: OrderService.newRequestId(),
      action: 'addEvidence',
      sentAt: Date.now()
    };
    this.uploadingEvidence = true;
    this.submitting = true;
    const finish = () => { this.submitting = false; this.uploadingEvidence = false; };
    this.orderService.addEvidence(
      this.detail.order.id,
      { ...this.evidenceForm, version: this.detail.order.version },
      reqMeta.requestId
    ).subscribe({
      next: r => {
        finish();
        if (r.code === 0) { this.closeDialog(); this.loadDetail(); this.flash('success', '证据已上传'); }
        else this.flash('error', r.message);
      },
      error: e => { finish(); this.flash('error', e.error?.message || e.message); }
    });
  }
  deletingEvidence = false;
  deleteEvidence(id: number) {
    if (!this.detail || this.submitting || this.deletingEvidence) return;
    if (!this.canDo('delete_evidence')) {
      const hint = this.actionDisabledHint('delete_evidence');
      if (hint) { alert(hint); return; }
    }
    if (!confirm('确定删除该证据？删除后不可恢复。')) return;
    const reqMeta: WriteRequestMeta = {
      requestId: OrderService.newRequestId(),
      action: 'deleteEvidence',
      sentAt: Date.now()
    };
    this.deletingEvidence = true;
    this.submitting = true;
    const finish = () => { this.submitting = false; this.deletingEvidence = false; };
    this.orderService.deleteEvidence(
      id,
      { version: this.detail.order.version },
      reqMeta.requestId
    ).subscribe({
      next: r => {
        finish();
        if (r.code === 0) { this.loadDetail(); this.flash('success', '证据已删除'); }
        else this.flash('error', r.message);
      },
      error: e => { finish(); this.flash('error', e.error?.message || e.message); }
    });
  }

  // ================= 导航 =================
  backToList() {
    this.orderService.emit({ kind: 'queue' });
    this.router.navigate(['/queue'], { queryParams: { highlight: this.id } });
  }
  goQueue() {
    this.router.navigate(['/queue']);
  }
}
