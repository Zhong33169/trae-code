import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import {
  TransportOrder, User, OrderStatus, EvidenceType, AuditLog,
  STATUS_LABELS, STATUS_COLORS, EVIDENCE_LABELS, ROLE_LABELS
} from '../../models';

const STATUS_OPTIONS: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'entrusted', label: '已委托' },
  { value: 'dispatched', label: '已调度' },
  { value: 'in_transit', label: '运输中' },
  { value: 'delivered', label: '已签收' },
  { value: 'reviewed', label: '已归档' },
  { value: 'rejected', label: '已驳回' },
];

const NEXT_STATUS_MAP: Record<string, { target: OrderStatus; label: string; requires?: EvidenceType[] }[]> = {
  'initiator:draft': [{ target: 'entrusted', label: '提交运输委托', requires: ['entrustment'] }],
  'initiator:rejected': [{ target: 'draft', label: '退回草稿修改' }],
  'handler:entrusted': [{ target: 'dispatched', label: '车辆调度确认', requires: ['dispatch'] }],
  'handler:dispatched': [{ target: 'in_transit', label: '发车启运' }],
  'handler:in_transit': [{ target: 'delivered', label: '签收回单', requires: ['receipt'] }],
  'handler:rejected': [{ target: 'entrusted', label: '重新提交委托' }],
  'reviewer:delivered': [{ target: 'reviewed', label: '复核归档' }],
  'reviewer:entrusted': [{ target: 'rejected', label: '驳回（需补充）' }],
  'reviewer:dispatched': [{ target: 'rejected', label: '驳回（需补充）' }],
  'reviewer:in_transit': [{ target: 'rejected', label: '驳回（需补充）' }],
  'reviewer:delivered_reject': [{ target: 'rejected', label: '驳回（需补充）' }],
};

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="order-page">
      <div class="page-header">
        <div class="title-group">
          <h2>📦 运输订单队列</h2>
          <span class="count-badge">共 {{ orders.length }} 条</span>
        </div>
        <div class="filters">
          <select [(ngModel)]="filterStatus" (change)="refreshOrders()" class="filter-input">
            <option *ngFor="let opt of STATUS_OPTIONS" [value]="opt.value">{{ opt.label }}</option>
          </select>
          <input
            [(ngModel)]="filterKeyword"
            (input)="refreshOrders()"
            placeholder="搜索订单号/客户/货物..."
            class="filter-input search-input"
          />
          <button (click)="showCreateModal = true" class="btn btn-primary" *ngIf="currentUser?.role === 'initiator'">
            + 新建订单
          </button>
          <button
            (click)="showBatchModal = true"
            class="btn btn-secondary"
            [disabled]="selectedOrderIds.length === 0"
          >
            📋 批量变更 ({{ selectedOrderIds.length }})
          </button>
        </div>
      </div>

      <div class="content-split">
        <div class="order-list-panel">
          <table class="order-table">
            <thead>
              <tr>
                <th style="width:40px;">
                  <input
                    type="checkbox"
                    [checked]="isAllSelected"
                    (change)="toggleSelectAll()"
                    [disabled]="!canBatchAny"
                  />
                </th>
                <th>订单号</th>
                <th>客户</th>
                <th>货物</th>
                <th>起运地</th>
                <th>目的地</th>
                <th>状态</th>
                <th>版本</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              <tr
                *ngFor="let order of orders"
                (click)="selectOrder(order)"
                [class.selected]="selectedOrder?.id === order.id"
                class="order-row"
              >
                <td (click)="$event.stopPropagation()">
                  <input
                    type="checkbox"
                    [checked]="selectedOrderIds.includes(order.id)"
                    (change)="toggleOrderSelection(order.id)"
                    [disabled]="!canBatchOrder(order)"
                  />
                </td>
                <td class="order-no">{{ order.order_no }}</td>
                <td>{{ order.customer }}</td>
                <td>{{ order.cargo_name }} ({{ order.cargo_weight }}t)</td>
                <td>{{ order.origin }}</td>
                <td>{{ order.destination }}</td>
                <td>
                  <span class="status-tag" [style.background]="STATUS_COLORS[order.status]">
                    {{ STATUS_LABELS[order.status] }}
                  </span>
                </td>
                <td class="version">v{{ order.version }}</td>
                <td class="time">{{ formatTime(order.updated_at) }}</td>
              </tr>
              <tr *ngIf="orders.length === 0">
                <td colspan="9" class="empty-row">暂无订单数据</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="detail-panel" *ngIf="selectedOrder">
          <div class="detail-header">
            <div>
              <h3>{{ selectedOrder.order_no }}</h3>
              <span class="status-tag" [style.background]="STATUS_COLORS[selectedOrder.status]">
                {{ STATUS_LABELS[selectedOrder.status] }}
              </span>
              <span class="version-tag">v{{ selectedOrder.version }}</span>
            </div>
            <button (click)="refreshOrders()" class="btn btn-ghost">🔄 刷新</button>
          </div>

          <div class="detail-section">
            <h4>📝 订单信息</h4>
            <div class="info-grid">
              <div class="info-item"><label>客户</label><span>{{ selectedOrder.customer }}</span></div>
              <div class="info-item"><label>货物</label><span>{{ selectedOrder.cargo_name }} ({{ selectedOrder.cargo_weight }}t)</span></div>
              <div class="info-item"><label>起运地</label><span>{{ selectedOrder.origin }}</span></div>
              <div class="info-item"><label>目的地</label><span>{{ selectedOrder.destination }}</span></div>
              <div class="info-item"><label>车牌号</label>
                <input *ngIf="canEditDispatch" [(ngModel)]="editForm.plate_number" class="inline-input" placeholder="未填写" />
                <span *ngIf="!canEditDispatch">{{ selectedOrder.plate_number || '—' }}</span>
              </div>
              <div class="info-item"><label>司机</label>
                <input *ngIf="canEditDispatch" [(ngModel)]="editForm.driver" class="inline-input" placeholder="未填写" />
                <span *ngIf="!canEditDispatch">{{ selectedOrder.driver || '—' }}</span>
              </div>
              <div class="info-item"><label>签收人</label>
                <input *ngIf="canEditReceipt" [(ngModel)]="editForm.receiver" class="inline-input" placeholder="未填写" />
                <span *ngIf="!canEditReceipt">{{ selectedOrder.receiver || '—' }}</span>
              </div>
              <div class="info-item"><label>签收时间</label><span>{{ selectedOrder.signed_at ? formatTime(selectedOrder.signed_at) : '—' }}</span></div>
            </div>
            <div *ngIf="canEditDispatch || canEditReceipt" class="action-row">
              <button (click)="saveOrderInfo()" class="btn btn-primary">💾 保存信息</button>
            </div>
            <div *ngIf="selectedOrder.rejected_reason" class="reject-reason">
              <strong>驳回原因：</strong>{{ selectedOrder.rejected_reason }}
            </div>
          </div>

          <div class="detail-section">
            <h4>📎 证据文件</h4>
            <div class="evidence-list">
              <div *ngFor="let ev of selectedOrder.evidences" class="evidence-item">
                <div class="evidence-icon">{{ getEvidenceIcon(ev.evidence_type) }}</div>
                <div class="evidence-info">
                  <div class="evidence-title">{{ EVIDENCE_LABELS[ev.evidence_type] }}</div>
                  <div class="evidence-file">{{ ev.file_name }}</div>
                  <div class="evidence-meta">
                    <span *ngIf="ev.remark">备注：{{ ev.remark }}</span>
                    <span>上传于 {{ formatTime(ev.uploaded_at) }}</span>
                  </div>
                </div>
              </div>
              <div *ngIf="selectedOrder.evidences.length === 0" class="empty-tip">暂无证据文件</div>
            </div>
            <div class="upload-section" *ngIf="canUploadEvidence">
              <select [(ngModel)]="newEvidence.evidence_type" class="filter-input">
                <option *ngFor="let et of availableEvidenceTypes" [value]="et.value">{{ et.label }}</option>
              </select>
              <input [(ngModel)]="newEvidence.file_name" placeholder="文件名（如 运输委托单_XX.pdf）" class="filter-input" />
              <input [(ngModel)]="newEvidence.file_ref" placeholder="文件标识/路径" class="filter-input" />
              <input [(ngModel)]="newEvidence.remark" placeholder="备注（可选）" class="filter-input" />
              <button (click)="uploadEvidence()" class="btn btn-primary">📤 上传证据</button>
            </div>
          </div>

          <div class="detail-section">
            <h4>⚙️ 流程办理</h4>
            <div class="transition-actions">
              <button
                *ngFor="let action of availableActions"
                (click)="executeTransition(action.target, action.label)"
                class="btn btn-action"
                [class.btn-warn]="action.target === 'rejected'"
              >
                {{ action.label }}
              </button>
              <div *ngIf="availableActions.length === 0" class="empty-tip">当前角色在该状态下无可执行操作</div>
            </div>
          </div>

          <div class="detail-section">
            <h4>📜 审计日志</h4>
            <div class="audit-list" *ngIf="auditLogs.length > 0">
              <div *ngFor="let log of auditLogs" class="audit-item">
                <span class="audit-time">{{ formatTime(log.created_at) }}</span>
                <span class="audit-user">{{ log.username }}</span>
                <span class="audit-action">{{ log.action }}</span>
                <span class="audit-status" *ngIf="log.old_status || log.new_status">
                  {{ log.old_status || '—' }} → {{ log.new_status || '—' }}
                </span>
                <span class="audit-detail">{{ log.detail }}</span>
              </div>
            </div>
            <div *ngIf="auditLogs.length === 0" class="empty-tip">暂无审计记录</div>
          </div>
        </div>

        <div class="detail-panel empty-panel" *ngIf="!selectedOrder">
          <div class="empty-hint">
            <div class="empty-icon">←</div>
            <p>请从左侧队列中选择一个订单查看详情并办理</p>
          </div>
        </div>
      </div>

      <!-- 新建订单弹窗 -->
      <div class="modal-overlay" *ngIf="showCreateModal" (click)="showCreateModal = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>📝 新建运输订单</h3>
          <div class="form-group">
            <label>客户名称</label>
            <input [(ngModel)]="createForm.customer" class="form-input" />
          </div>
          <div class="form-group">
            <label>货物名称</label>
            <input [(ngModel)]="createForm.cargo_name" class="form-input" />
          </div>
          <div class="form-group">
            <label>货物重量（吨）</label>
            <input type="number" step="0.1" [(ngModel)]="createForm.cargo_weight" class="form-input" />
          </div>
          <div class="form-group">
            <label>起运地</label>
            <input [(ngModel)]="createForm.origin" class="form-input" />
          </div>
          <div class="form-group">
            <label>目的地</label>
            <input [(ngModel)]="createForm.destination" class="form-input" />
          </div>
          <div class="modal-actions">
            <button (click)="showCreateModal = false" class="btn btn-ghost">取消</button>
            <button (click)="createOrder()" class="btn btn-primary">创建订单</button>
          </div>
        </div>
      </div>

      <!-- 批量变更弹窗 -->
      <div class="modal-overlay" *ngIf="showBatchModal" (click)="showBatchModal = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>📋 批量变更运输订单</h3>
          <p class="modal-desc">已选择 <strong>{{ selectedOrderIds.length }}</strong> 条订单，选择目标状态执行批量变更：</p>
          <div class="form-group">
            <label>目标状态</label>
            <select [(ngModel)]="batchForm.target_status" class="form-input">
              <option *ngFor="let opt of batchStatusOptions" [value]="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div class="selected-preview">
            <div *ngFor="let o of selectedOrdersPreview" class="preview-item">
              {{ o.order_no }} - {{ STATUS_LABELS[o.status] }}（客户：{{ o.customer }}）
            </div>
          </div>
          <div class="modal-actions">
            <button (click)="showBatchModal = false" class="btn btn-ghost">取消</button>
            <button (click)="createAndExecuteBatch()" class="btn btn-primary">创建批次并执行</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .order-page { display: flex; flex-direction: column; gap: 16px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; background: white; padding: 14px 20px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .title-group { display: flex; align-items: center; gap: 12px; }
    .title-group h2 { font-size: 18px; }
    .count-badge { background: #e0e7ff; color: #3730a3; padding: 3px 10px; border-radius: 12px; font-size: 12px; }
    .filters { display: flex; gap: 8px; align-items: center; }
    .filter-input { padding: 7px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white; }
    .search-input { min-width: 240px; }

    .btn { padding: 7px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: #2563eb; color: white; }
    .btn-primary:hover:not(:disabled) { background: #1d4ed8; }
    .btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
    .btn-secondary:hover:not(:disabled) { background: #e5e7eb; }
    .btn-ghost { background: transparent; color: #6b7280; }
    .btn-ghost:hover { background: #f3f4f6; }
    .btn-action { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 10px 18px; font-weight: 500; }
    .btn-action:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(16,185,129,0.3); }
    .btn-warn { background: linear-gradient(135deg, #f59e0b, #d97706); }
    .btn-warn:hover:not(:disabled) { box-shadow: 0 3px 8px rgba(245,158,11,0.3); }

    .content-split { display: grid; grid-template-columns: 1fr 520px; gap: 16px; }

    .order-list-panel { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); max-height: calc(100vh - 180px); overflow-y: auto; }
    .order-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .order-table thead { position: sticky; top: 0; background: #f9fafb; z-index: 1; }
    .order-table th, .order-table td { padding: 11px 14px; text-align: left; border-bottom: 1px solid #f3f4f6; }
    .order-table th { font-weight: 600; color: #374151; font-size: 12px; }
    .order-row { cursor: pointer; transition: background 0.15s; }
    .order-row:hover { background: #f9fafb; }
    .order-row.selected { background: #eff6ff; }
    .order-no { font-family: 'SF Mono', Menlo, monospace; font-weight: 500; color: #1e40af; }
    .version { color: #6b7280; font-family: 'SF Mono', Menlo, monospace; }
    .time { color: #6b7280; font-size: 12px; }
    .empty-row { text-align: center; padding: 40px !important; color: #9ca3af; }

    .status-tag { display: inline-block; padding: 2px 10px; border-radius: 10px; color: white; font-size: 11px; font-weight: 500; }

    .detail-panel { background: white; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); padding: 18px; max-height: calc(100vh - 180px); overflow-y: auto; }
    .empty-panel { display: flex; align-items: center; justify-content: center; }
    .empty-hint { text-align: center; color: #9ca3af; }
    .empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.4; }

    .detail-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; border-bottom: 1px solid #f3f4f6; margin-bottom: 14px; }
    .detail-header h3 { font-size: 16px; margin-bottom: 6px; }
    .detail-header .status-tag { margin-right: 8px; }
    .version-tag { background: #e5e7eb; color: #374151; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-family: monospace; }

    .detail-section { margin-bottom: 18px; }
    .detail-section h4 { font-size: 14px; color: #374151; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #eef2ff; }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
    .info-item label { display: block; font-size: 11px; color: #6b7280; margin-bottom: 2px; }
    .info-item span { font-size: 13px; color: #1f2937; }
    .inline-input { width: 100%; padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px; }
    .action-row { margin-top: 10px; }
    .reject-reason { margin-top: 10px; padding: 10px; background: #fef2f2; border-left: 3px solid #ef4444; border-radius: 4px; font-size: 13px; color: #991b1b; }

    .evidence-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .evidence-item { display: flex; gap: 10px; padding: 10px; background: #f9fafb; border-radius: 6px; border-left: 3px solid #2563eb; }
    .evidence-icon { font-size: 22px; }
    .evidence-title { font-weight: 500; font-size: 13px; }
    .evidence-file { font-size: 12px; color: #6b7280; }
    .evidence-meta { font-size: 11px; color: #9ca3af; margin-top: 2px; display: flex; gap: 12px; }
    .upload-section { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e5e7eb; }
    .upload-section .filter-input { flex: 1; min-width: 120px; }

    .transition-actions { display: flex; flex-wrap: wrap; gap: 8px; }

    .audit-list { display: flex; flex-direction: column; gap: 6px; }
    .audit-item { display: flex; flex-wrap: wrap; gap: 8px; padding: 7px 10px; background: #fafafa; border-radius: 5px; font-size: 12px; }
    .audit-time { color: #9ca3af; font-family: monospace; }
    .audit-user { font-weight: 500; color: #1e40af; }
    .audit-action { background: #eef2ff; color: #4338ca; padding: 1px 7px; border-radius: 4px; }
    .audit-status { color: #059669; }
    .audit-detail { color: #6b7280; flex: 1; }

    .empty-tip { color: #9ca3af; font-size: 13px; padding: 12px; text-align: center; background: #fafafa; border-radius: 6px; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 100; }
    .modal { background: white; border-radius: 12px; padding: 24px; width: 520px; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 50px rgba(0,0,0,0.2); }
    .modal h3 { margin-bottom: 6px; }
    .modal-desc { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
    .form-group { margin-bottom: 12px; }
    .form-group label { display: block; font-size: 13px; color: #374151; margin-bottom: 4px; }
    .form-input { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    .selected-preview { max-height: 200px; overflow-y: auto; background: #f9fafb; border-radius: 6px; padding: 8px; margin-bottom: 14px; }
    .preview-item { padding: 6px 8px; font-size: 12px; border-bottom: 1px solid #e5e7eb; }
    .preview-item:last-child { border-bottom: none; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
  `]
})
export class OrderListComponent implements OnInit {
  private api = inject(ApiService);

  STATUS_OPTIONS = STATUS_OPTIONS;
  STATUS_LABELS = STATUS_LABELS;
  STATUS_COLORS = STATUS_COLORS;
  EVIDENCE_LABELS = EVIDENCE_LABELS;
  ROLE_LABELS = ROLE_LABELS;

  orders: TransportOrder[] = [];
  selectedOrder: TransportOrder | null = null;
  currentUser: User | null = null;
  auditLogs: AuditLog[] = [];

  filterStatus: OrderStatus | '' = '';
  filterKeyword = '';

  selectedOrderIds: number[] = [];
  showCreateModal = false;
  showBatchModal = false;

  createForm = { customer: '', cargo_name: '', cargo_weight: 0, origin: '', destination: '' };
  editForm = { plate_number: '', driver: '', receiver: '' };
  newEvidence = { evidence_type: 'entrustment' as EvidenceType, file_name: '', file_ref: '', remark: '' };
  batchForm = { target_status: 'entrusted' as OrderStatus };

  availableEvidenceTypes: { value: EvidenceType; label: string }[] = [
    { value: 'entrustment', label: '运输委托单' },
    { value: 'dispatch', label: '车辆调度单' },
    { value: 'receipt', label: '签收回单' },
  ];

  batchStatusOptions: { value: OrderStatus; label: string }[] = [
    { value: 'entrusted', label: '提交运输委托' },
    { value: 'dispatched', label: '车辆调度确认' },
    { value: 'in_transit', label: '发车启运' },
    { value: 'delivered', label: '签收回单' },
    { value: 'reviewed', label: '复核归档' },
    { value: 'rejected', label: '驳回' },
  ];

  ngOnInit() {
    this.api.getCurrentUser().subscribe((u) => {
      this.currentUser = u;
      if (u) this.refreshOrders();
      else this.orders = [];
    });
  }

  get availableActions() {
    if (!this.currentUser || !this.selectedOrder) return [];
    const key = `${this.currentUser.role}:${this.selectedOrder.status}`;
    return NEXT_STATUS_MAP[key] || [];
  }

  get canEditDispatch() {
    if (!this.currentUser || !this.selectedOrder) return false;
    return (
      this.currentUser.role === 'handler' &&
      ['entrusted', 'dispatched', 'in_transit', 'rejected'].includes(this.selectedOrder.status)
    );
  }

  get canEditReceipt() {
    if (!this.currentUser || !this.selectedOrder) return false;
    return this.currentUser.role === 'handler' && ['in_transit', 'delivered'].includes(this.selectedOrder.status);
  }

  get canUploadEvidence() {
    if (!this.currentUser || !this.selectedOrder) return false;
    return this.selectedOrder.status !== 'reviewed';
  }

  get canBatchAny() {
    return this.orders.some((o) => this.canBatchOrder(o));
  }

  get isAllSelected() {
    const batchable = this.orders.filter((o) => this.canBatchOrder(o));
    return batchable.length > 0 && batchable.every((o) => this.selectedOrderIds.includes(o.id));
  }

  get selectedOrdersPreview() {
    return this.orders.filter((o) => this.selectedOrderIds.includes(o.id));
  }

  canBatchOrder(order: TransportOrder) {
    if (!this.currentUser) return false;
    const key = `${this.currentUser.role}:${order.status}`;
    return (NEXT_STATUS_MAP[key] || []).length > 0;
  }

  refreshOrders() {
    this.api.listOrders(this.filterStatus || undefined, this.filterKeyword || undefined).subscribe((orders) => {
      this.orders = orders;
      if (this.selectedOrder) {
        const updated = orders.find((o) => o.id === this.selectedOrder!.id);
        if (updated) this.selectOrder(updated);
      }
    });
  }

  selectOrder(order: TransportOrder) {
    this.selectedOrder = order;
    this.editForm = {
      plate_number: order.plate_number || '',
      driver: order.driver || '',
      receiver: order.receiver || '',
    };
    this.api.listAuditLogs(order.id).subscribe((logs) => {
      this.auditLogs = logs;
    });
  }

  toggleOrderSelection(id: number) {
    const idx = this.selectedOrderIds.indexOf(id);
    if (idx >= 0) this.selectedOrderIds.splice(idx, 1);
    else this.selectedOrderIds.push(id);
  }

  toggleSelectAll() {
    if (this.isAllSelected) {
      this.selectedOrderIds = [];
    } else {
      this.selectedOrderIds = this.orders.filter((o) => this.canBatchOrder(o)).map((o) => o.id);
    }
  }

  createOrder() {
    const data = { ...this.createForm };
    if (!data.customer || !data.cargo_name || !data.origin || !data.destination || data.cargo_weight <= 0) {
      alert('请填写完整的订单信息');
      return;
    }
    this.api.createOrder(data).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.createForm = { customer: '', cargo_name: '', cargo_weight: 0, origin: '', destination: '' };
        this.refreshOrders();
      },
      error: (e) => alert('创建失败：' + e.message),
    });
  }

  saveOrderInfo() {
    if (!this.selectedOrder) return;
    this.api.updateOrder(this.selectedOrder.id, this.editForm).subscribe({
      next: (o) => {
        this.selectOrder(o);
        this.refreshOrders();
      },
      error: (e) => alert('保存失败：' + e.message),
    });
  }

  uploadEvidence() {
    if (!this.selectedOrder) return;
    if (!this.newEvidence.file_name || !this.newEvidence.file_ref) {
      alert('请填写文件名和文件标识');
      return;
    }
    this.api.uploadEvidence(this.selectedOrder.id, this.newEvidence).subscribe({
      next: () => {
        this.newEvidence = { evidence_type: 'entrustment', file_name: '', file_ref: '', remark: '' };
        this.refreshOrders();
      },
      error: (e) => alert('上传失败：' + e.message),
    });
  }

  executeTransition(target: OrderStatus, actionLabel: string) {
    if (!this.selectedOrder) return;
    let remark: string | undefined;
    if (target === 'rejected') {
      const r = prompt(`请输入驳回原因：`);
      if (r === null) return;
      remark = r;
    }
    this.api
      .transitionOrder(this.selectedOrder.id, {
        target_status: target,
        expected_version: this.selectedOrder.version,
        remark,
      })
      .subscribe({
        next: (o) => {
          this.selectOrder(o);
          this.refreshOrders();
          this.selectedOrderIds = this.selectedOrderIds.filter((id) => id !== o.id);
        },
        error: (e) => alert(`${actionLabel}失败：` + e.message),
      });
  }

  createAndExecuteBatch() {
    if (this.selectedOrderIds.length === 0) return;
    this.api
      .createBatch({ order_ids: this.selectedOrderIds, target_status: this.batchForm.target_status })
      .subscribe({
        next: (batch) => {
          this.api.executeBatch(batch.id).subscribe({
            next: (finished) => {
              this.showBatchModal = false;
              this.selectedOrderIds = [];
              this.refreshOrders();
              const msg = `批次 ${finished.batch_no} 执行完成：\n成功 ${finished.success_count} 条\n失败 ${finished.failed_count} 条\n状态：${this.getBatchStatusLabel(finished.status)}`;
              if (finished.failed_count > 0) {
                const fails = finished.items.filter((i) => i.status === 'failed');
                const details = fails.map((f) => `  · ${f.order_no}: ${f.error_message}`).join('\n');
                alert(msg + '\n\n失败详情：\n' + details);
              } else {
                alert(msg);
              }
            },
            error: (e) => alert('批次执行失败：' + e.message),
          });
        },
        error: (e) => alert('创建批次失败：' + e.message),
      });
  }

  getBatchStatusLabel(s: string) {
    const map: Record<string, string> = {
      pending: '待执行', processing: '执行中', partial_success: '部分成功', all_success: '全部成功', all_failed: '全部失败',
    };
    return map[s] || s;
  }

  getEvidenceIcon(t: EvidenceType) {
    const map: Record<EvidenceType, string> = { entrustment: '📄', dispatch: '🚛', receipt: '✅' };
    return map[t];
  }

  formatTime(s: string) {
    if (!s) return '';
    const d = new Date(s);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}
