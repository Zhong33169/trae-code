import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CheckinService } from '../../services/checkin.service';
import { AuthService } from '../../services/auth.service';
import {
  CheckinRecord,
  ConsistencyIssue,
  Attachment,
  AuditLog,
  STATUS_LABELS,
  STATUS_COLORS,
  SOURCE_LABELS,
  ROLE_LABELS,
} from '../../models';

@Component({
  selector: 'app-detail',
  template: `
    <div class="page" *ngIf="record">
      <div class="page-header">
        <div>
          <button routerLink="/" class="btn-back">← 返回列表</button>
          <h2 style="margin-top: 12px;">值机记录详情 #{{ record.id }}</h2>
        </div>
        <div class="header-actions">
          <span class="status-tag" [style.background]="STATUS_COLORS[record.status]">
            {{ STATUS_LABELS[record.status] }}
          </span>
          <span class="source-tag" [class.offline]="record.source === 'offline'" [class.online]="record.source === 'online'">
            {{ SOURCE_LABELS[record.source] }}
          </span>
        </div>
      </div>

      <div *ngIf="consistencyIssues.length > 0" class="alert-danger">
        <h4>⚠️ 检测到数据一致性问题（系统已阻止归档）：</h4>
        <ul>
          <li *ngFor="let iss of consistencyIssues">
            <b>[{{ iss.type }}]</b> {{ iss.message }}
          </li>
        </ul>
      </div>

      <div class="layout">
        <div class="main-col">
          <div class="card">
            <h3 class="card-title">基本信息</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">批次号</span>
                <span class="value mono">{{ record.batch_no }}</span>
              </div>
              <div class="info-item">
                <span class="label">航班号</span>
                <span class="value"><b>{{ record.flight_no }}</b></span>
              </div>
              <div class="info-item">
                <span class="label">航班日期</span>
                <span class="value">{{ record.flight_date }}</span>
              </div>
              <div class="info-item">
                <span class="label">值机时间</span>
                <span class="value">{{ record.checkin_time || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">旅客姓名</span>
                <span class="value">{{ record.passenger_name }}</span>
              </div>
              <div class="info-item">
                <span class="label">身份证号</span>
                <span class="value mono">{{ record.id_card_no }}</span>
              </div>
              <div class="info-item">
                <span class="label">座位号</span>
                <span class="value">{{ record.seat_no || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">登机口</span>
                <span class="value">{{ record.boarding_gate || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">材料完整</span>
                <span class="value">{{ record.material_complete ? '✅ 是' : '❌ 否' }}</span>
              </div>
              <div class="info-item">
                <span class="label">超时</span>
                <span class="value">{{ record.is_overtime ? '⏰ 是' : '否' }}</span>
              </div>
              <div class="info-item">
                <span class="label">异常标记</span>
                <span class="value">{{ record.is_abnormal ? '⚠️ 是' : '否' }}</span>
              </div>
            </div>
            <div *ngIf="record.abnormal_reason" class="info-block">
              <span class="label">异常说明</span>
              <p class="value-block">{{ record.abnormal_reason }}</p>
            </div>
          </div>

          <div class="card">
            <h3 class="card-title">附件管理</h3>
            <div class="upload-area">
              <input type="file" #fileInput (change)="onFileUpload($event)" style="display: none;" />
              <button (click)="fileInput.click()" class="btn-secondary">📎 上传附件</button>
              <span class="hint">支持 PDF、JPG、PNG 等格式</span>
            </div>
            <div *ngIf="attachments.length === 0" class="empty-text">暂无附件</div>
            <div class="attach-list">
              <div *ngFor="let a of attachments" class="attach-item">
                <span class="attach-icon">📄</span>
                <span class="attach-name">{{ a.file_name }}</span>
                <span class="attach-meta">{{ a.file_type }} · {{ formatSize(a.file_size) }} · {{ a.uploader_name }} · {{ a.uploaded_at?.substring(0, 16) }}</span>
                <button class="btn-link danger" (click)="deleteAttachment(a.id)">删除</button>
              </div>
            </div>
          </div>

          <div class="card">
            <h3 class="card-title">处理流程</h3>
            <div class="timeline">
              <div class="tl-item">
                <div class="tl-dot" [class.done]="record.initiated_at"></div>
                <div class="tl-content">
                  <div class="tl-title">发起登记 <span class="role-label initiator">发起岗</span></div>
                  <div class="tl-meta" *ngIf="record.initiated_at">
                    {{ record.initiator_name }} · {{ record.initiated_at?.substring(0, 16) }}
                  </div>
                  <div class="tl-meta pending" *ngIf="!record.initiated_at">待发起</div>
                </div>
              </div>
              <div class="tl-item">
                <div class="tl-dot" [class.done]="record.handled_at"></div>
                <div class="tl-content">
                  <div class="tl-title">过程核验 <span class="role-label handler">办理岗</span></div>
                  <div class="tl-meta" *ngIf="record.handled_at">
                    {{ record.handler_name }} · {{ record.handled_at?.substring(0, 16) }}
                  </div>
                  <div class="tl-meta pending" *ngIf="!record.handled_at">待办理</div>
                  <div *ngIf="record.result" class="tl-result">
                    <b>处理结果：</b>{{ record.result }}
                  </div>
                </div>
              </div>
              <div class="tl-item">
                <div class="tl-dot" [class.done]="record.reviewed_at" [class.returned]="record.status === 'returned'"></div>
                <div class="tl-content">
                  <div class="tl-title">复核归档 <span class="role-label reviewer">复核岗</span></div>
                  <div class="tl-meta" *ngIf="record.reviewed_at">
                    {{ record.reviewer_name }} · {{ record.reviewed_at?.substring(0, 16) }}
                  </div>
                  <div class="tl-meta pending" *ngIf="!record.reviewed_at && record.status !== 'returned'">待复核</div>
                  <div *ngIf="record.audit_remark" class="tl-result">
                    <b>审计备注：</b>{{ record.audit_remark }}
                  </div>
                </div>
              </div>
            </div>

            <div *ngIf="record.return_reason" class="return-box">
              <h4>🔴 退回原因</h4>
              <p>{{ record.return_reason }}</p>
            </div>
          </div>

          <div class="card">
            <h3 class="card-title">审计日志</h3>
            <div *ngIf="auditLogs.length === 0" class="empty-text">暂无日志</div>
            <table class="mini-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>操作人</th>
                  <th>动作</th>
                  <th>状态变更</th>
                  <th>详情</th>
                  <th>失败原因</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let log of auditLogs">
                  <td class="mono small">{{ log.created_at?.substring(0, 16) }}</td>
                  <td>{{ log.user_name }}</td>
                  <td><span class="action-tag">{{ log.action }}</span></td>
                  <td>
                    <span *ngIf="log.old_status" class="status-tag small" [style.background]="STATUS_COLORS[log.old_status]">
                      {{ STATUS_LABELS[log.old_status] }}
                    </span>
                    <span *ngIf="log.old_status"> → </span>
                    <span *ngIf="log.new_status" class="status-tag small" [style.background]="STATUS_COLORS[log.new_status]">
                      {{ STATUS_LABELS[log.new_status] }}
                    </span>
                    <span *ngIf="!log.old_status && !log.new_status">-</span>
                  </td>
                  <td class="small">{{ log.detail || '-' }}</td>
                  <td class="failure" *ngIf="log.failure_reason">{{ log.failure_reason }}</td>
                  <td *ngIf="!log.failure_reason" class="small">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="side-col">
          <div class="card sticky">
            <h3 class="card-title">快捷操作</h3>
            <div class="side-hint">
              当前角色：<b>{{ roleLabel }}</b><br />
              可执行操作：{{ allowedActions.join('、') || '无' }}
            </div>

            <div class="action-group" *ngIf="canInitiate && record.status === 'pending'">
              <button class="btn-full primary" (click)="doAction('initiate')">🚀 发起登记</button>
            </div>

            <div class="action-group" *ngIf="canHandle && record.status === 'processing'">
              <div class="form-group">
                <label>处理结果 *</label>
                <textarea [(ngModel)]="handleResult" rows="3" placeholder="请填写核验结果..."></textarea>
              </div>
              <button class="btn-full primary" (click)="doAction('verify')">✅ 核验通过</button>
              <button class="btn-full danger-outline" (click)="showReturnDialog = true">🔴 退回</button>
            </div>

            <div class="action-group" *ngIf="canReview && record.status === 'verified'">
              <div class="form-group">
                <label>审计备注</label>
                <textarea [(ngModel)]="auditRemark" rows="3" placeholder="复核审计备注..."></textarea>
              </div>
              <button class="btn-full primary" (click)="doAction('archive')" [disabled]="consistencyIssues.length > 0">📦 复核归档</button>
              <div *ngIf="consistencyIssues.length > 0" class="warning-text">
                ⚠️ 存在一致性问题，无法归档
              </div>
              <button class="btn-full danger-outline" (click)="showReturnDialog = true">🔴 退回修改</button>
            </div>

            <div class="action-group" *ngIf="record.status === 'returned' && canInitiate">
              <button class="btn-full primary" (click)="doAction('initiate')">🔄 重新发起</button>
            </div>

            <div class="action-group" *ngIf="currentRole === 'admin'">
              <div class="divider">管理员调试操作</div>
              <button *ngIf="record.status === 'pending'" class="btn-full secondary" (click)="doAction('initiate')">发起</button>
              <button *ngIf="record.status === 'processing'" class="btn-full secondary" (click)="doAction('verify')">核验</button>
              <button *ngIf="record.status === 'verified'" class="btn-full secondary" (click)="doAction('archive')">归档</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div *ngIf="showReturnDialog" class="modal-mask" (click)="showReturnDialog = false">
      <div class="modal" (click)="$event.stopPropagation()">
        <h3>退回记录</h3>
        <p class="modal-hint">退回后，该记录将标记为异常，并要求发起岗重新处理。</p>
        <div class="form-group">
          <label>退回原因 *</label>
          <textarea [(ngModel)]="returnReason" rows="4" placeholder="请详细说明退回原因..."></textarea>
        </div>
        <div class="modal-actions">
          <button (click)="showReturnDialog = false" class="btn-ghost">取消</button>
          <button (click)="confirmReturn()" class="btn-danger" [disabled]="!returnReason">确认退回</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
    .page { display: flex; flex-direction: column; gap: 16px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .page-header h2 { font-size: 20px; color: #1e293b; }
    .btn-back { background: transparent; border: none; color: #3b82f6; cursor: pointer; font-size: 13px; padding: 4px 0; }
    .btn-back:hover { text-decoration: underline; }
    .header-actions { display: flex; gap: 8px; align-items: center; }
    .btn-primary { background: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn-primary:hover { background: #2563eb; }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
    .btn-secondary { background: white; color: #334155; padding: 7px 14px; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .btn-secondary:hover { background: #f1f5f9; }
    .btn-ghost { background: transparent; color: #64748b; padding: 7px 14px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .btn-ghost:hover { background: #f1f5f9; }
    .btn-danger { background: #dc2626; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn-danger:hover { background: #b91c1c; }
    .btn-link { background: none; border: none; color: #3b82f6; cursor: pointer; padding: 4px; font-size: 13px; }
    .btn-link.danger { color: #dc2626; }
    .btn-full { width: 100%; padding: 10px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; margin-bottom: 8px; }
    .btn-full.primary { background: #3b82f6; color: white; }
    .btn-full.primary:hover { background: #2563eb; }
    .btn-full.primary:disabled { background: #94a3b8; cursor: not-allowed; }
    .btn-full.secondary { background: white; color: #334155; border: 1px solid #cbd5e1; }
    .btn-full.secondary:hover { background: #f1f5f9; }
    .btn-full.danger-outline { background: white; color: #dc2626; border: 1px solid #fecaca; }
    .btn-full.danger-outline:hover { background: #fef2f2; }
    .status-tag { display: inline-block; padding: 3px 10px; border-radius: 10px; color: white; font-size: 12px; }
    .status-tag.small { padding: 2px 8px; font-size: 11px; }
    .source-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .source-tag.offline { background: #fef3c7; color: #92400e; }
    .source-tag.online { background: #dbeafe; color: #1e40af; }
    .alert-danger { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 18px; color: #991b1b; }
    .alert-danger h4 { margin: 0 0 6px; }
    .alert-danger ul { margin: 0; padding-left: 20px; }
    .alert-danger li { font-size: 13px; line-height: 1.6; }
    .layout { display: grid; grid-template-columns: 1fr 320px; gap: 16px; }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
    .card { background: white; border-radius: 8px; padding: 18px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 16px; }
    .card-title { margin: 0 0 14px; font-size: 15px; color: #1e293b; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    @media (max-width: 768px) { .info-grid { grid-template-columns: repeat(2, 1fr); } }
    .info-item { display: flex; flex-direction: column; gap: 3px; }
    .info-item .label { font-size: 12px; color: #64748b; }
    .info-item .value { font-size: 14px; color: #1e293b; }
    .mono { font-family: 'SF Mono', Monaco, monospace; font-size: 12px; color: #64748b; }
    .info-block { margin-top: 14px; }
    .info-block .label { font-size: 12px; color: #64748b; display: block; margin-bottom: 4px; }
    .value-block { margin: 0; padding: 10px; background: #f8fafc; border-radius: 5px; font-size: 13px; line-height: 1.6; }
    .upload-area { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .hint { font-size: 12px; color: #94a3b8; }
    .empty-text { color: #94a3b8; font-size: 13px; padding: 12px 0; }
    .attach-list { display: flex; flex-direction: column; gap: 8px; }
    .attach-item {
      display: flex; align-items: center; gap: 10px; padding: 8px 10px;
      background: #f8fafc; border-radius: 5px; font-size: 13px;
    }
    .attach-icon { font-size: 16px; }
    .attach-name { flex: 1; }
    .attach-meta { font-size: 12px; color: #94a3b8; }
    .timeline { padding: 8px 0; }
    .tl-item { display: flex; gap: 14px; position: relative; padding-bottom: 20px; }
    .tl-item:not(:last-child)::before {
      content: ''; position: absolute; left: 6px; top: 16px; bottom: 0;
      width: 2px; background: #e2e8f0;
    }
    .tl-dot {
      width: 14px; height: 14px; border-radius: 50%; background: #e2e8f0; flex-shrink: 0;
      margin-top: 3px; border: 2px solid white; box-shadow: 0 0 0 1px #cbd5e1;
    }
    .tl-dot.done { background: #10b981; box-shadow: 0 0 0 1px #10b981; }
    .tl-dot.returned { background: #dc2626; box-shadow: 0 0 0 1px #dc2626; }
    .tl-content { flex: 1; }
    .tl-title { font-size: 14px; color: #1e293b; font-weight: 500; }
    .role-label {
      display: inline-block; padding: 1px 8px; border-radius: 3px; font-size: 11px; margin-left: 6px; font-weight: 400;
    }
    .role-label.initiator { background: #dbeafe; color: #1e40af; }
    .role-label.handler { background: #fef3c7; color: #92400e; }
    .role-label.reviewer { background: #dcfce7; color: #166534; }
    .tl-meta { font-size: 12px; color: #64748b; margin-top: 3px; }
    .tl-meta.pending { color: #94a3b8; font-style: italic; }
    .tl-result { margin-top: 8px; padding: 8px 10px; background: #f0fdf4; border-left: 3px solid #10b981; font-size: 13px; border-radius: 0 4px 4px 0; }
    .return-box { margin-top: 14px; padding: 12px 14px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 0 6px 6px 0; }
    .return-box h4 { margin: 0 0 6px; color: #991b1b; font-size: 14px; }
    .return-box p { margin: 0; font-size: 13px; color: #7f1d1d; line-height: 1.6; }
    .mini-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .mini-table th { background: #f8fafc; padding: 8px 6px; text-align: left; color: #475569; border-bottom: 1px solid #e2e8f0; }
    .mini-table td { padding: 7px 6px; border-bottom: 1px solid #f1f5f9; }
    .mini-table .small { font-size: 11px; }
    .mini-table .failure { color: #dc2626; font-size: 11px; max-width: 200px; word-break: break-all; }
    .action-tag { background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 3px; font-size: 11px; }
    .side-col .sticky { position: sticky; top: 20px; }
    .side-hint { font-size: 12px; color: #64748b; line-height: 1.8; padding: 10px; background: #f8fafc; border-radius: 5px; margin-bottom: 14px; }
    .action-group { margin-top: 12px; }
    .form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; }
    .form-group label { font-size: 12px; color: #475569; }
    textarea, input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 5px; font-family: inherit; font-size: 13px; }
    .divider { border-top: 1px dashed #e2e8f0; padding-top: 12px; margin-top: 12px; font-size: 12px; color: #94a3b8; margin-bottom: 8px; }
    .warning-text { color: #dc2626; font-size: 12px; margin-bottom: 8px; }
    .modal-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: white; padding: 24px; border-radius: 10px; width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .modal h3 { margin: 0 0 6px; color: #1e293b; }
    .modal-hint { margin: 0 0 14px; font-size: 13px; color: #64748b; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    `,
  ],
})
export class DetailComponent implements OnInit {
  record!: CheckinRecord;
  consistencyIssues: ConsistencyIssue[] = [];
  attachments: Attachment[] = [];
  auditLogs: AuditLog[] = [];
  validTransitions: string[] = [];
  allowedActions: string[] = [];
  currentRole = '';

  handleResult = '';
  auditRemark = '';
  returnReason = '';
  showReturnDialog = false;

  STATUS_LABELS = STATUS_LABELS;
  STATUS_COLORS = STATUS_COLORS;
  SOURCE_LABELS = SOURCE_LABELS;
  ROLE_LABELS = ROLE_LABELS;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: CheckinService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.currentRole = this.auth.user?.role || '';
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loadDetail(id);
  }

  get roleLabel(): string {
    return this.currentRole ? ROLE_LABELS[this.currentRole] : '';
  }

  get canInitiate(): boolean {
    return this.allowedActions.includes('initiate');
  }

  get canHandle(): boolean {
    return this.allowedActions.includes('handle') || this.allowedActions.includes('verify');
  }

  get canReview(): boolean {
    return this.allowedActions.includes('review') || this.allowedActions.includes('archive');
  }

  loadDetail(id: number): void {
    this.service.get(id).subscribe({
      next: res => {
        this.record = res.record;
        this.consistencyIssues = res.consistency_issues || [];
        this.validTransitions = res.valid_transitions || [];
        this.allowedActions = res.allowed_actions || [];
        this.attachments = res.record.attachments || [];
        this.auditLogs = res.record.audit_logs || [];
        this.handleResult = this.record.result || '';
        this.auditRemark = this.record.audit_remark || '';
        this.returnReason = this.record.return_reason || '';
      },
      error: err => {
        if (err.status === 404) {
          alert('记录不存在');
          this.router.navigate(['/']);
        } else if (err.status === 401) {
          this.auth.logout();
          this.router.navigate(['/login']);
        }
      },
    });
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  }

  onFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.service.uploadAttachment(this.record.id, file).subscribe({
      next: () => {
        input.value = '';
        this.loadDetail(this.record.id);
      },
      error: err => alert(err.error?.error || '上传失败'),
    });
  }

  deleteAttachment(id: number): void {
    if (!confirm('确定删除该附件？')) return;
    this.service.deleteAttachment(id).subscribe({
      next: () => this.loadDetail(this.record.id),
      error: err => alert(err.error?.error || '删除失败'),
    });
  }

  doAction(action: string): void {
    if (action === 'verify' && !this.handleResult.trim()) {
      alert('请填写处理结果');
      return;
    }
    const msg = action === 'initiate' ? '确认发起该值机记录？'
      : action === 'verify' ? '确认核验通过该值机记录？'
      : action === 'archive' ? '确认复核归档该值机记录？'
      : '确认执行该操作？';
    if (!confirm(msg)) return;

    const body: any = {};
    if (action === 'verify') body.result = this.handleResult;
    if (action === 'archive') body.audit_remark = this.auditRemark;
    if (action === 'initiate') body.remark = '从详情页发起';

    this.service.handleAction(this.record.id, action, body).subscribe({
      next: res => {
        if (res.consistency_issues?.length) {
          alert('操作成功，但检测到异常：\n' + res.consistency_issues.map((i: any) => i.message).join('\n'));
        } else {
          alert('操作成功');
        }
        this.loadDetail(this.record.id);
      },
      error: err => {
        const msg = err.error?.details || err.error?.error || '操作失败';
        if (err.error?.consistency_issues) {
          alert(msg + '\n\n详细问题：\n' + err.error.consistency_issues.map((i: ConsistencyIssue) => '• ' + i.message).join('\n'));
        } else {
          alert(msg);
        }
      },
    });
  }

  confirmReturn(): void {
    if (!this.returnReason) return;
    this.service.handleAction(this.record.id, 'return', { return_reason: this.returnReason }).subscribe({
      next: () => {
        alert('退回成功');
        this.showReturnDialog = false;
        this.loadDetail(this.record.id);
      },
      error: err => alert(err.error?.error || '退回失败'),
    });
  }
}
