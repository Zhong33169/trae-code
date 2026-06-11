import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CheckinService } from '../../services/checkin.service';
import { AuthService } from '../../services/auth.service';
import {
  CheckinRecord,
  STATUS_LABELS,
  STATUS_COLORS,
  SOURCE_LABELS,
  ROLE_LABELS,
  BatchHandleResponse,
  BatchResultItem,
} from '../../models';

@Component({
  selector: 'app-list',
  template: `
    <div class="page">
      <div class="page-header">
        <h2>值机记录管理</h2>
        <div class="header-actions">
          <button *ngIf="canInitiate" routerLink="/create" class="btn-primary">+ 新增登记</button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-item">
          <label>状态筛选</label>
          <select [(ngModel)]="filters.status" (change)="loadList()" class="filter-select">
            <option value="">全部状态</option>
            <option value="pending">待发起</option>
            <option value="processing">办理中</option>
            <option value="verified">已核验</option>
            <option value="archived">已归档</option>
            <option value="returned">已退回</option>
            <option value="rejected">已驳回</option>
          </select>
        </div>
        <div class="filter-item">
          <label>异常标记</label>
          <select [(ngModel)]="filters.is_abnormal" (change)="loadList()" class="filter-select">
            <option value="">全部</option>
            <option value="1">仅异常</option>
            <option value="0">仅正常</option>
          </select>
        </div>
        <div class="filter-item">
          <label>航班号</label>
          <input
            type="text"
            [(ngModel)]="filters.flight_no"
            (keyup.enter)="loadList()"
            placeholder="如 CA1234"
            class="filter-input"
          />
        </div>
        <div class="filter-item">
          <label>批次号</label>
          <input
            type="text"
            [(ngModel)]="filters.batch_no"
            (keyup.enter)="loadList()"
            placeholder="如 BATCH20250101001"
            class="filter-input"
          />
        </div>
        <div class="filter-item">
          <label>旅客/证件</label>
          <input
            type="text"
            [(ngModel)]="filters.search"
            (keyup.enter)="loadList()"
            placeholder="姓名或身份证号"
            class="filter-input"
          />
        </div>
        <div class="filter-item">
          <button (click)="loadList()" class="btn-secondary">查询</button>
          <button (click)="resetFilters()" class="btn-ghost">重置</button>
        </div>
      </div>

      <div *ngIf="canBatch" class="batch-bar">
        <span>已选 {{ selectedIds.length }} 条</span>
        <select [(ngModel)]="batchAction" class="filter-select">
          <option value="">选择批量操作</option>
          <option *ngIf="canHandle" value="verify">批量核验</option>
          <option *ngIf="canReview" value="archive">批量归档</option>
          <option value="return">批量退回</option>
        </select>
        <input
          *ngIf="batchAction === 'return'"
          type="text"
          [(ngModel)]="batchReturnReason"
          placeholder="退回原因"
          class="filter-input"
        />
        <input
          *ngIf="batchAction !== 'return'"
          type="text"
          [(ngModel)]="batchRemark"
          placeholder="备注（可选）"
          class="filter-input"
        />
        <button
          (click)="doBatch()"
          class="btn-primary"
          [disabled]="!batchAction || selectedIds.length === 0 || (batchAction === 'return' && !batchReturnReason)"
        >
          执行批量操作
        </button>
      </div>

      <div *ngIf="batchResult" class="batch-result">
        <h4>批量操作结果（成功 {{ batchResult.success }} / 失败 {{ batchResult.failed }} / 共 {{ batchResult.total }}）</h4>
        <ul class="result-list">
          <li *ngFor="let r of batchResult.results" [class.success]="r.success" [class.failed]="!r.success">
            记录 #{{ r.id }} - {{ r.success ? '✅' : '❌' }} {{ r.message }}
          </li>
        </ul>
        <button (click)="batchResult = null" class="btn-ghost">关闭</button>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th *ngIf="canBatch" style="width: 40px;">
                <input
                  type="checkbox"
                  [checked]="allSelected"
                  (change)="toggleAll()"
                />
              </th>
              <th>ID</th>
              <th>批次号</th>
              <th>航班号</th>
              <th>航班日期</th>
              <th>旅客姓名</th>
              <th>身份证号</th>
              <th>来源</th>
              <th>状态</th>
              <th>异常</th>
              <th>发起岗</th>
              <th>办理岗</th>
              <th>复核岗</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of records">
              <td *ngIf="canBatch">
                <input
                  type="checkbox"
                  [checked]="selectedIds.includes(r.id)"
                  (change)="toggleSelect(r.id)"
                  [disabled]="!canSelectRow(r)"
                />
              </td>
              <td>{{ r.id }}</td>
              <td class="mono">{{ r.batch_no }}</td>
              <td><b>{{ r.flight_no }}</b></td>
              <td>{{ r.flight_date }}</td>
              <td>{{ r.passenger_name }}</td>
              <td class="mono">{{ maskId(r.id_card_no) }}</td>
              <td>
                <span class="source-tag" [class.offline]="r.source === 'offline'" [class.online]="r.source === 'online'">
                  {{ SOURCE_LABELS[r.source] }}
                </span>
              </td>
              <td>
                <span class="status-tag" [style.background]="STATUS_COLORS[r.status]">
                  {{ STATUS_LABELS[r.status] }}
                </span>
              </td>
              <td>
                <span *ngIf="r.is_abnormal" class="abnormal-badge" title="{{ r.abnormal_reason }}">⚠️ 异常</span>
                <span *ngIf="r.is_overtime" class="overtime-badge">⏰ 超时</span>
                <span *ngIf="!r.material_complete" class="material-badge">📋 缺材料</span>
                <span *ngIf="!r.is_abnormal && !r.is_overtime && r.material_complete" class="ok-badge">✅</span>
              </td>
              <td>{{ r.initiator_name || '-' }}</td>
              <td>{{ r.handler_name || '-' }}</td>
              <td>{{ r.reviewer_name || '-' }}</td>
              <td class="actions">
                <button class="btn-link" (click)="goDetail(r.id)">详情</button>
                <ng-container [ngSwitch]="currentRole">
                  <ng-container *ngSwitchCase="'initiator'">
                    <button
                      *ngIf="r.status === 'pending'"
                      class="btn-link primary"
                      (click)="doAction(r, 'initiate')"
                    >发起</button>
                    <button
                      *ngIf="r.status === 'returned'"
                      class="btn-link primary"
                      (click)="goDetail(r.id)"
                    >重新处理</button>
                  </ng-container>
                  <ng-container *ngSwitchCase="'handler'">
                    <button
                      *ngIf="r.status === 'processing'"
                      class="btn-link primary"
                      (click)="doAction(r, 'verify')"
                    >核验</button>
                    <button
                      *ngIf="r.status === 'processing'"
                      class="btn-link danger"
                      (click)="returnRecord(r)"
                    >退回</button>
                  </ng-container>
                  <ng-container *ngSwitchCase="'reviewer'">
                    <button
                      *ngIf="r.status === 'verified'"
                      class="btn-link primary"
                      (click)="doAction(r, 'archive')"
                    >归档</button>
                    <button
                      *ngIf="r.status === 'verified' || r.status === 'processing'"
                      class="btn-link danger"
                      (click)="returnRecord(r)"
                    >退回</button>
                  </ng-container>
                  <ng-container *ngSwitchCase="'admin'">
                    <button
                      *ngIf="r.status === 'pending'"
                      class="btn-link primary"
                      (click)="doAction(r, 'initiate')"
                    >发起</button>
                    <button
                      *ngIf="r.status === 'processing'"
                      class="btn-link primary"
                      (click)="doAction(r, 'verify')"
                    >核验</button>
                    <button
                      *ngIf="r.status === 'verified'"
                      class="btn-link primary"
                      (click)="doAction(r, 'archive')"
                    >归档</button>
                    <button
                      *ngIf="r.status !== 'archived'"
                      class="btn-link danger"
                      (click)="returnRecord(r)"
                    >退回</button>
                  </ng-container>
                </ng-container>
              </td>
            </tr>
            <tr *ngIf="records.length === 0">
              <td [attr.colspan]="canBatch ? 14 : 13" class="empty">暂无数据</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="role-permissions">
        <h4>当前角色：<span class="role-highlight">{{ roleLabel }}</span>（可执行操作：{{ allowedActions.join('、') || '无' }}）</h4>
        <p class="hint">不同角色可见的操作按钮不同，后端同时做权限校验。切换账号可体验不同角色。</p>
      </div>
    </div>

    <div *ngIf="showReturnDialog" class="modal-mask" (click)="showReturnDialog = false">
      <div class="modal" (click)="$event.stopPropagation()">
        <h3>退回记录 #{{ returnTarget?.id }} - {{ returnTarget?.passenger_name }}</h3>
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
    .page-header { display: flex; justify-content: space-between; align-items: center; }
    .page-header h2 { font-size: 20px; color: #1e293b; }
    .btn-primary { background: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn-primary:hover { background: #2563eb; }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
    .btn-secondary { background: white; color: #334155; padding: 7px 14px; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .btn-secondary:hover { background: #f1f5f9; }
    .btn-ghost { background: transparent; color: #64748b; padding: 7px 14px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .btn-ghost:hover { background: #f1f5f9; }
    .btn-danger { background: #dc2626; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn-danger:hover { background: #b91c1c; }
    .btn-link { background: none; border: none; color: #3b82f6; cursor: pointer; padding: 4px 8px; font-size: 13px; }
    .btn-link:hover { text-decoration: underline; }
    .btn-link.primary { color: #059669; }
    .btn-link.danger { color: #dc2626; }
    .filter-bar {
      background: white; padding: 16px; border-radius: 8px; display: flex; flex-wrap: wrap;
      gap: 12px; align-items: flex-end; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .filter-item { display: flex; flex-direction: column; gap: 4px; }
    .filter-item label { font-size: 12px; color: #64748b; }
    .filter-select, .filter-input {
      padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 5px; font-size: 13px; min-width: 140px;
    }
    .filter-input { min-width: 160px; }
    .batch-bar {
      background: #eff6ff; padding: 12px 16px; border-radius: 8px;
      display: flex; align-items: center; gap: 12px; border: 1px solid #bfdbfe;
    }
    .batch-result {
      background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;
    }
    .batch-result h4 { margin-bottom: 8px; color: #1e293b; }
    .result-list { list-style: none; padding: 0; margin: 0 0 12px; max-height: 200px; overflow-y: auto; }
    .result-list li { padding: 6px 10px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .result-list li.success { color: #059669; }
    .result-list li.failed { color: #dc2626; }
    .table-wrap { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .table th {
      background: #f8fafc; padding: 12px 10px; text-align: left; color: #475569;
      font-weight: 600; border-bottom: 1px solid #e2e8f0; white-space: nowrap;
    }
    .table td { padding: 10px; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
    .table tbody tr:hover { background: #f8fafc; }
    .mono { font-family: 'SF Mono', Monaco, monospace; font-size: 12px; color: #64748b; }
    .status-tag {
      display: inline-block; padding: 3px 10px; border-radius: 10px; color: white; font-size: 12px;
    }
    .source-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .source-tag.offline { background: #fef3c7; color: #92400e; }
    .source-tag.online { background: #dbeafe; color: #1e40af; }
    .abnormal-badge { color: #dc2626; font-weight: 600; font-size: 12px; }
    .overtime-badge { color: #f59e0b; font-size: 12px; margin-left: 4px; }
    .material-badge { color: #7c3aed; font-size: 12px; margin-left: 4px; }
    .ok-badge { font-size: 12px; }
    .actions { display: flex; gap: 4px; }
    .empty { text-align: center; padding: 40px; color: #94a3b8; }
    .role-permissions { background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .role-permissions h4 { margin: 0 0 4px; color: #334155; font-size: 14px; }
    .role-highlight { color: #3b82f6; }
    .hint { margin: 0; font-size: 12px; color: #64748b; }
    .modal-mask {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .modal {
      background: white; padding: 24px; border-radius: 10px; width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .modal h3 { margin: 0 0 16px; color: #1e293b; }
    .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .form-group label { font-size: 13px; color: #475569; }
    textarea { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 5px; font-family: inherit; font-size: 13px; resize: vertical; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
    `,
  ],
})
export class ListComponent implements OnInit {
  records: CheckinRecord[] = [];
  selectedIds: number[] = [];
  filters = { status: '', is_abnormal: '', flight_no: '', batch_no: '', search: '' };
  batchAction = '';
  batchRemark = '';
  batchReturnReason = '';
  batchResult: BatchHandleResponse | null = null;
  currentRole = '';
  allowedActions: string[] = [];

  showReturnDialog = false;
  returnTarget: CheckinRecord | null = null;
  returnReason = '';

  STATUS_LABELS = STATUS_LABELS;
  STATUS_COLORS = STATUS_COLORS;
  SOURCE_LABELS = SOURCE_LABELS;
  ROLE_LABELS = ROLE_LABELS;

  constructor(
    private service: CheckinService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentRole = this.auth.user?.role || '';
    this.loadList();
  }

  get roleLabel(): string {
    return this.currentRole ? ROLE_LABELS[this.currentRole] : '';
  }

  get canInitiate(): boolean {
    return this.auth.hasRole(['initiator', 'admin']);
  }

  get canHandle(): boolean {
    return this.auth.hasRole(['handler', 'admin']);
  }

  get canReview(): boolean {
    return this.auth.hasRole(['reviewer', 'admin']);
  }

  get canBatch(): boolean {
    return this.auth.hasRole(['handler', 'reviewer', 'admin']);
  }

  get allSelected(): boolean {
    return this.records.filter(r => this.canSelectRow(r)).length > 0
      && this.records.filter(r => this.canSelectRow(r)).every(r => this.selectedIds.includes(r.id));
  }

  canSelectRow(r: CheckinRecord): boolean {
    if (r.status === 'archived') return false;
    if (this.batchAction === 'verify') return r.status === 'processing';
    if (this.batchAction === 'archive') return r.status === 'verified';
    if (this.batchAction === 'return') return r.status !== 'archived';
    return r.status !== 'archived';
  }

  toggleSelect(id: number): void {
    const idx = this.selectedIds.indexOf(id);
    if (idx >= 0) this.selectedIds.splice(idx, 1);
    else this.selectedIds.push(id);
  }

  toggleAll(): void {
    if (this.allSelected) {
      this.selectedIds = [];
    } else {
      this.selectedIds = this.records.filter(r => this.canSelectRow(r)).map(r => r.id);
    }
  }

  resetFilters(): void {
    this.filters = { status: '', is_abnormal: '', flight_no: '', batch_no: '', search: '' };
    this.loadList();
  }

  loadList(): void {
    this.service.list(this.filters).subscribe({
      next: res => {
        this.records = res.records;
        this.allowedActions = res.allowed_actions || [];
        this.selectedIds = [];
      },
      error: err => {
        if (err.status === 401) {
          this.auth.logout();
          this.router.navigate(['/login']);
        }
      },
    });
  }

  maskId(id: string): string {
    if (!id || id.length < 8) return id;
    return id.substring(0, 4) + '********' + id.substring(id.length - 4);
  }

  goDetail(id: number): void {
    this.router.navigate(['/orders', id]);
  }

  doAction(r: CheckinRecord, action: string): void {
    const msg = action === 'initiate' ? '确认发起该值机记录？'
      : action === 'verify' ? '确认核验通过该值机记录？'
      : action === 'archive' ? '确认复核归档该值机记录？'
      : '确认执行该操作？';
    if (!confirm(msg)) return;

    this.service.handleAction(r.id, action, { remark: action }).subscribe({
      next: res => {
        if (res.consistency_issues?.length) {
          alert('操作成功，但检测到异常：\n' + res.consistency_issues.map((i: any) => i.message).join('\n'));
        } else {
          alert('操作成功');
        }
        this.loadList();
      },
      error: err => {
        const msg = err.error?.details || err.error?.error || '操作失败';
        alert(msg);
      },
    });
  }

  returnRecord(r: CheckinRecord): void {
    this.returnTarget = r;
    this.returnReason = r.return_reason || '';
    this.showReturnDialog = true;
  }

  confirmReturn(): void {
    if (!this.returnTarget || !this.returnReason) return;
    this.service.handleAction(this.returnTarget.id, 'return', { return_reason: this.returnReason }).subscribe({
      next: () => {
        alert('退回成功');
        this.showReturnDialog = false;
        this.loadList();
      },
      error: err => alert(err.error?.error || '退回失败'),
    });
  }

  doBatch(): void {
    if (!this.batchAction || this.selectedIds.length === 0) return;
    if (this.batchAction === 'return' && !this.batchReturnReason) return;

    const body: any = {
      ids: [...this.selectedIds],
      action: this.batchAction,
      remark: this.batchRemark,
    };
    if (this.batchAction === 'return') {
      body.return_reason = this.batchReturnReason;
    }

    this.service.batchHandle(body).subscribe({
      next: res => {
        this.batchResult = res;
        this.batchAction = '';
        this.batchRemark = '';
        this.batchReturnReason = '';
        this.loadList();
      },
      error: err => alert(err.error?.error || '批量操作失败'),
    });
  }
}
