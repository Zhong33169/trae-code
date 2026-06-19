import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import {
  ReleaseApplication, ReleaseStatus, StatusLabels,
  RollbackPlan, PostLaunchReview, ShiftHandover, Shift, ShiftLabels,
  OperationLog
} from '../../models/release.model';
import { Role, User } from '../../models/auth.model';

@Component({
  selector: 'app-release-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-header">
      <div style="display: flex; align-items: center; gap: 12px;">
        <button class="btn-default" routerLink="/releases">← 返回列表</button>
        <h1 class="page-title">发布申请详情</h1>
        <span *ngIf="application" class="status-tag status-{{ application.status }}">{{ getStatusLabel(application.status) }}</span>
      </div>
      <div class="toolbar">
        <button *ngIf="canEdit" class="btn-primary" [routerLink]="['/releases', id, 'edit']">编辑</button>
        <button *ngIf="canSubmitReview" class="btn-success" (click)="submitReview()">提交审核</button>
        <button *ngIf="canReviewApprove" class="btn-success" (click)="showReviewModal('approve')">审核通过</button>
        <button *ngIf="canReviewReject" class="btn-danger" (click)="showReviewModal('reject')">审核驳回</button>
        <button *ngIf="canSubmitRecheck" class="btn-warning" (click)="submitRecheck()">提交复核</button>
        <button *ngIf="canRecheckApprove" class="btn-success" (click)="showRecheckModal('approve')">复核通过</button>
        <button *ngIf="canRecheckReject" class="btn-danger" (click)="showRecheckModal('reject')">复核驳回</button>
        <button *ngIf="canPublish" class="btn-success" (click)="publish()" [disabled]="!publishReady">发布</button>
        <button *ngIf="canRollback" class="btn-danger" (click)="showRollbackModal()">回滚</button>
        <button *ngIf="canArchive" class="btn-default" (click)="archive()">归档</button>
      </div>
    </div>

    <div *ngIf="loading" class="loading">加载中...</div>

    <div *ngIf="!loading && application">
      <div *ngIf="canPublish && !publishReady" class="card" style="border-left: 4px solid #faad14; margin-bottom: 16px;">
        <h4 style="color: #d48806; margin-bottom: 8px;">发布就绪条件</h4>
        <div style="font-size: 14px; line-height: 2;">
          <div>
            <span style="color: {{ rollbackPlan?.is_approved ? '#52c41a' : '#ff4d4f' }}">{{ rollbackPlan?.is_approved ? '✓' : '✗' }}</span>
            回滚预案已审核通过
            <span *ngIf="!rollbackPlan" style="color: #999; margin-left: 4px;">（尚未创建）</span>
            <span *ngIf="rollbackPlan && !rollbackPlan.is_approved" style="color: #999; margin-left: 4px;">（待审核）</span>
          </div>
          <div>
            <span style="color: {{ hasConfirmedHandover && allHandoversConfirmed ? '#52c41a' : '#ff4d4f' }}">{{ hasConfirmedHandover && allHandoversConfirmed ? '✓' : '✗' }}</span>
            至少一条已确认的换班交接
            <span *ngIf="handovers.length === 0" style="color: #ff4d4f; margin-left: 4px;">（请先发起并完成交接）</span>
            <span *ngIf="handovers.length > 0 && !hasConfirmedHandover" style="color: #ff4d4f; margin-left: 4px;">（尚无已确认交接）</span>
            <span *ngIf="handovers.length > 0 && hasConfirmedHandover && !allHandoversConfirmed" style="color: #999; margin-left: 4px;">（{{ unconfirmedHandoverCount }} 条待确认）</span>
          </div>
        </div>
      </div>

      <div class="tabs">
        <div class="tab-item" [class.active]="activeTab === 'info'" (click)="activeTab = 'info'">基本信息</div>
        <div class="tab-item" [class.active]="activeTab === 'rollback'" (click)="activeTab = 'rollback'">回滚预案
          <span *ngIf="rollbackPlan" class="badge" style="background: {{ rollbackPlan.is_approved ? '#52c41a' : '#faad14' }}">{{ rollbackPlan.is_approved ? '已审核' : '待审核' }}</span>
        </div>
        <div class="tab-item" [class.active]="activeTab === 'review'" (click)="activeTab = 'review'">上线复盘
          <span *ngIf="postLaunchReview?.reviewed_at" class="badge" style="background: #722ed1;">已完成</span>
          <span *ngIf="postLaunchReview && !postLaunchReview.reviewed_at" class="badge" style="background: #faad14;">进行中</span>
        </div>
        <div class="tab-item" [class.active]="activeTab === 'handover'" (click)="activeTab = 'handover'">换班交接
          <span *ngIf="confirmedHandoverCount > 0" class="badge" style="background: #52c41a;">{{ confirmedHandoverCount }}</span>
          <span *ngIf="unconfirmedHandoverCount > 0" class="badge" style="background: #ff4d4f;">{{ unconfirmedHandoverCount }}</span>
        </div>
        <div class="tab-item" [class.active]="activeTab === 'logs'" (click)="activeTab = 'logs'">操作记录</div>
      </div>

      <div *ngIf="activeTab === 'info'" class="card">
        <div class="detail-item">
          <span class="detail-label">申请标题</span>
          <span class="detail-value">{{ application.title }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">项目名称</span>
          <span class="detail-value">{{ application.project_name }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">版本号</span>
          <span class="detail-value">{{ application.version }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">影响范围</span>
          <span class="detail-value">{{ application.impact_scope || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">计划发布时间</span>
          <span class="detail-value">{{ application.planned_release_time ? formatDate(application.planned_release_time) : '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">创建人</span>
          <span class="detail-value">{{ application.creator?.full_name || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">审核人</span>
          <span class="detail-value">{{ application.reviewer?.full_name || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">复核人</span>
          <span class="detail-value">{{ application.rechecker?.full_name || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">创建时间</span>
          <span class="detail-value">{{ formatDate(application.created_at) }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">更新时间</span>
          <span class="detail-value">{{ formatDate(application.updated_at) }}</span>
        </div>
        <div class="detail-item" *ngIf="application.description">
          <span class="detail-label">申请描述</span>
          <span class="detail-value">{{ application.description }}</span>
        </div>
        <div class="detail-item" *ngIf="application.release_content">
          <span class="detail-label">发布内容</span>
          <span class="detail-value" style="white-space: pre-wrap;">{{ application.release_content }}</span>
        </div>
        <div class="detail-item" *ngIf="application.review_comment">
          <span class="detail-label">审核意见</span>
          <span class="detail-value">{{ application.review_comment }}</span>
        </div>
        <div class="detail-item" *ngIf="application.recheck_comment">
          <span class="detail-label">复核意见</span>
          <span class="detail-value">{{ application.recheck_comment }}</span>
        </div>
      </div>

      <div *ngIf="activeTab === 'rollback'" class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="font-size: 16px;">回滚预案</h3>
          <div>
            <button *ngIf="canCreateRollbackPlan" class="btn-primary" (click)="showRollbackPlanForm()">创建预案</button>
            <button *ngIf="canEditRollbackPlan" class="btn-default" (click)="showRollbackPlanForm()">编辑</button>
            <button *ngIf="canApproveRollbackPlan" class="btn-success" (click)="approveRollbackPlan()">审核通过</button>
            <span *ngIf="rollbackPlan?.is_approved && isSupervisor" style="font-size: 12px; color: #52c41a; margin-left: 8px;">（已审核，不可修改）</span>
            <span *ngIf="!canCreateRollbackPlan && !rollbackPlan && !canEditRollbackPlan && !canApproveRollbackPlan" style="font-size: 12px; color: #999; margin-left: 4px;">（当前状态或岗位不允许操作）</span>
          </div>
        </div>

        <div *ngIf="rollbackPlanLoading" class="loading">加载中...</div>
        <div *ngIf="!rollbackPlanLoading && !rollbackPlan" class="empty">暂无回滚预案<span *ngIf="isRegistrar">，请先创建</span></div>

        <div *ngIf="rollbackPlan && !rollbackPlanLoading">
          <div style="margin-bottom: 12px;">
            <span class="status-tag" [class.status-published]="rollbackPlan.is_approved" [class.status-draft]="!rollbackPlan.is_approved">
              {{ rollbackPlan.is_approved ? '已审核' : '待审核' }}
            </span>
            <span *ngIf="rollbackPlan.approved_by" style="margin-left: 8px; font-size: 12px; color: #999;">
              审核时间: {{ formatDate(rollbackPlan.approved_at!) }}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">触发条件</span>
            <span class="detail-value" style="white-space: pre-wrap;">{{ rollbackPlan.trigger_condition }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">回滚步骤</span>
            <span class="detail-value" style="white-space: pre-wrap;">{{ rollbackPlan.rollback_steps }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">回滚负责人</span>
            <span class="detail-value">{{ rollbackPlan.rollback_person || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">预计时长</span>
            <span class="detail-value">{{ rollbackPlan.expected_duration || '-' }}</span>
          </div>
        </div>
      </div>

      <div *ngIf="activeTab === 'review'" class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="font-size: 16px;">上线复盘</h3>
          <div>
            <button *ngIf="!postLaunchReview && canCreateReview" class="btn-primary" (click)="showReviewForm()">创建复盘</button>
            <button *ngIf="postLaunchReview && canEditReview && !postLaunchReview.reviewed_at" class="btn-default" (click)="showReviewForm()">编辑</button>
            <button *ngIf="postLaunchReview && canCompleteReview && !postLaunchReview.reviewed_at" class="btn-success" (click)="completeReview()">完成复盘</button>
          </div>
        </div>

        <div *ngIf="reviewLoading" class="loading">加载中...</div>
        <div *ngIf="!reviewLoading && !postLaunchReview" class="empty">暂无上线复盘<span *ngIf="application?.status === ReleaseStatus.PUBLISHED && isReviewer">，请创建复盘</span></div>

        <div *ngIf="postLaunchReview && !reviewLoading">
          <div style="margin-bottom: 12px;">
            <span *ngIf="postLaunchReview.reviewed_at" class="status-tag status-reviewed_post_launch">已完成</span>
            <span *ngIf="!postLaunchReview.reviewed_at" class="status-tag status-pending_review">进行中</span>
            <span *ngIf="postLaunchReview.reviewed_at" style="margin-left: 8px; font-size: 12px; color: #999;">
              完成时间: {{ formatDate(postLaunchReview.reviewed_at) }}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">发布结果</span>
            <span class="detail-value">
              <span *ngIf="postLaunchReview.release_result === 'success'" style="color: #52c41a;">成功</span>
              <span *ngIf="postLaunchReview.release_result === 'partial'" style="color: #faad14;">部分成功</span>
              <span *ngIf="postLaunchReview.release_result === 'failed'" style="color: #ff4d4f;">失败</span>
              <span *ngIf="!postLaunchReview.release_result">-</span>
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">复盘内容</span>
            <span class="detail-value" style="white-space: pre-wrap;">{{ postLaunchReview.review_content || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">发现问题</span>
            <span class="detail-value" style="white-space: pre-wrap;">{{ postLaunchReview.issues_found || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">改进措施</span>
            <span class="detail-value" style="white-space: pre-wrap;">{{ postLaunchReview.improvement_measures || '-' }}</span>
          </div>
        </div>
      </div>

      <div *ngIf="activeTab === 'handover'" class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h3 style="font-size: 16px;">换班交接记录</h3>
          <button *ngIf="canCreateHandover" class="btn-primary" (click)="showHandoverForm()">发起交接</button>
        </div>
        <div *ngIf="canPublish && !hasConfirmedHandover" style="background: #fff7e6; border: 1px solid #ffd591; color: #d48806; padding: 8px 12px; border-radius: 4px; font-size: 13px; margin-bottom: 16px;">
          ⚠️ 发布前必须至少有一条已确认的换班交接，交接是发布就绪的必经证据链
        </div>

        <div *ngIf="handoverLoading" class="loading">加载中...</div>
        <div *ngIf="!handoverLoading && handovers.length === 0" class="empty">暂无交接记录</div>

        <div *ngFor="let h of handovers" class="handover-item">
          <div class="handover-header">
            <div>
              <span class="status-tag status-{{ h.shift }}">{{ getShiftLabel(h.shift) }}</span>
              <span style="margin-left: 8px; color: #333; font-weight: 500;">{{ h.from_user?.full_name }}</span>
              <span style="color: #999;"> → </span>
              <span style="color: #333; font-weight: 500;">{{ h.to_user?.full_name }}</span>
            </div>
            <div>
              <span class="handover-status" [class.handover-confirmed]="h.is_confirmed" [class.handover-pending]="!h.is_confirmed">
                {{ h.is_confirmed ? '已确认' : '待确认' }}
              </span>
              <button *ngIf="canConfirmHandover(h)" class="btn-success" style="padding: 2px 8px; font-size: 12px; margin-left: 8px;" (click)="confirmHandover(h.id)">确认</button>
            </div>
          </div>
          <div style="font-size: 12px; color: #999; margin-bottom: 6px;">
            发起时间: {{ formatDate(h.created_at) }}
            <span *ngIf="h.confirmed_at"> | 确认时间: {{ formatDate(h.confirmed_at) }}</span>
          </div>
          <div style="font-size: 13px; color: #666; white-space: pre-wrap;">{{ h.handover_content || '无' }}</div>
        </div>
      </div>

      <div *ngIf="activeTab === 'logs'" class="card">
        <h3 style="font-size: 16px; margin-bottom: 16px;">操作记录</h3>
        <div *ngIf="logsLoading" class="loading">加载中...</div>
        <div *ngIf="!logsLoading && operationLogs.length === 0" class="empty">暂无操作记录</div>
        <div *ngFor="let log of operationLogs" class="log-item">
          <div class="log-time">{{ formatDate(log.created_at) }}</div>
          <div class="log-operator">
            {{ log.operator?.full_name || '系统' }}
            <span style="color: #1890ff; font-size: 12px; margin-left: 8px;">{{ getOperationLabel(log.operation_type) }}</span>
          </div>
          <div class="log-detail" *ngIf="log.operation_detail">{{ log.operation_detail }}</div>
          <div class="log-detail" *ngIf="log.old_status || log.new_status">
            状态: {{ getStatusLabel(log.old_status || '') }} → {{ getStatusLabel(log.new_status || '') }}
          </div>
        </div>
      </div>
    </div>

    <div *ngIf="showReviewDialog" class="modal-overlay" (click)="closeReviewModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <span class="modal-title">{{ reviewDialogTitle }}</span>
          <button class="modal-close" (click)="closeReviewModal()">×</button>
        </div>
        <div class="form-group">
          <label class="form-label">意见</label>
          <textarea class="form-textarea" [(ngModel)]="reviewComment" placeholder="请输入意见"></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn-default" (click)="closeReviewModal()">取消</button>
          <button class="btn-primary" (click)="doReviewAction()">确定</button>
        </div>
      </div>
    </div>

    <div *ngIf="showRollbackPlanDialog" class="modal-overlay" (click)="closeRollbackPlanForm()">
      <div class="modal-content" style="min-width: 500px;" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <span class="modal-title">{{ rollbackPlan ? '编辑回滚预案' : '创建回滚预案' }}</span>
          <button class="modal-close" (click)="closeRollbackPlanForm()">×</button>
        </div>
        <div class="form-group">
          <label class="form-label">触发条件 *</label>
          <textarea class="form-textarea" [(ngModel)]="rollbackPlanForm.trigger_condition" placeholder="请输入触发回滚的条件"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">回滚步骤 *</label>
          <textarea class="form-textarea" [(ngModel)]="rollbackPlanForm.rollback_steps" placeholder="请输入详细的回滚步骤" style="min-height: 120px;"></textarea>
        </div>
        <div style="display: flex; gap: 12px;">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">回滚负责人</label>
            <input type="text" class="form-input" [(ngModel)]="rollbackPlanForm.rollback_person" placeholder="请输入负责人">
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">预计时长</label>
            <input type="text" class="form-input" [(ngModel)]="rollbackPlanForm.expected_duration" placeholder="如：30分钟">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-default" (click)="closeRollbackPlanForm()">取消</button>
          <button class="btn-primary" (click)="saveRollbackPlan()">保存</button>
        </div>
      </div>
    </div>

    <div *ngIf="showReviewDialogPost" class="modal-overlay" (click)="closeReviewForm()">
      <div class="modal-content" style="min-width: 500px;" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <span class="modal-title">{{ postLaunchReview ? '编辑上线复盘' : '创建上线复盘' }}</span>
          <button class="modal-close" (click)="closeReviewForm()">×</button>
        </div>
        <div class="form-group">
          <label class="form-label">发布结果</label>
          <select class="form-select" [(ngModel)]="reviewForm.release_result">
            <option value="">请选择</option>
            <option value="success">成功</option>
            <option value="partial">部分成功</option>
            <option value="failed">失败</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">复盘内容</label>
          <textarea class="form-textarea" [(ngModel)]="reviewForm.review_content" placeholder="请输入复盘内容" style="min-height: 80px;"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">发现问题</label>
          <textarea class="form-textarea" [(ngModel)]="reviewForm.issues_found" placeholder="请输入发现的问题" style="min-height: 80px;"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">改进措施</label>
          <textarea class="form-textarea" [(ngModel)]="reviewForm.improvement_measures" placeholder="请输入改进措施" style="min-height: 80px;"></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn-default" (click)="closeReviewForm()">取消</button>
          <button class="btn-primary" (click)="saveReview()">保存</button>
        </div>
      </div>
    </div>

    <div *ngIf="showHandoverDialog" class="modal-overlay" (click)="closeHandoverForm()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <span class="modal-title">发起换班交接</span>
          <button class="modal-close" (click)="closeHandoverForm()">×</button>
        </div>
        <div class="form-group">
          <label class="form-label">交接班次</label>
          <select class="form-select" [(ngModel)]="handoverForm.shift">
            <option *ngFor="let s of shiftOptions" [value]="s.value">{{ s.label }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">接收人</label>
          <select class="form-select" [(ngModel)]="handoverForm.to_user_id">
            <option value="">请选择接收人</option>
            <option *ngFor="let u of users" [value]="u.id">{{ u.full_name }} ({{ getRoleLabel(u.role) }})</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">交接内容</label>
          <textarea class="form-textarea" [(ngModel)]="handoverForm.handover_content" placeholder="请输入交接内容"></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn-default" (click)="closeHandoverForm()">取消</button>
          <button class="btn-primary" (click)="createHandover()">提交</button>
        </div>
      </div>
    </div>

    <div *ngIf="showRollbackDialog" class="modal-overlay" (click)="closeRollbackModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <span class="modal-title">版本回滚</span>
          <button class="modal-close" (click)="closeRollbackModal()">×</button>
        </div>
        <p style="margin-bottom: 16px; color: #666;">确定要回滚此版本吗？此操作将变更发布申请状态。</p>
        <div class="form-group">
          <label class="form-label">回滚原因</label>
          <textarea class="form-textarea" [(ngModel)]="rollbackReason" placeholder="请输入回滚原因"></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn-default" (click)="closeRollbackModal()">取消</button>
          <button class="btn-danger" (click)="doRollback()">确认回滚</button>
        </div>
      </div>
    </div>
  `
})
export class ReleaseDetailComponent implements OnInit {
  id: number = 0;
  application: ReleaseApplication | null = null;
  loading = true;
  activeTab = 'info';
  ReleaseStatus = ReleaseStatus;

  rollbackPlan: RollbackPlan | null = null;
  rollbackPlanLoading = true;

  postLaunchReview: PostLaunchReview | null = null;
  reviewLoading = true;

  handovers: ShiftHandover[] = [];
  handoverLoading = true;

  operationLogs: OperationLog[] = [];
  logsLoading = true;

  users: User[] = [];

  showReviewDialog = false;
  reviewDialogTitle = '';
  reviewDialogType = '';
  reviewComment = '';

  showRollbackPlanDialog = false;
  rollbackPlanForm: any = {
    trigger_condition: '',
    rollback_steps: '',
    rollback_person: '',
    expected_duration: ''
  };

  showReviewDialogPost = false;
  reviewForm: any = {
    review_content: '',
    issues_found: '',
    improvement_measures: '',
    release_result: ''
  };

  showHandoverDialog = false;
  handoverForm: any = {
    to_user_id: null,
    shift: Shift.DAY,
    handover_content: ''
  };

  showRollbackDialog = false;
  rollbackReason = '';

  shiftOptions = Object.entries(ShiftLabels).map(([value, label]) => ({ value, label }));

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private authService: AuthService,
    private toastService: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.params['id']);
    this.loadDetail();
    this.loadUsers();
  }

  loadDetail(): void {
    this.loading = true;
    this.apiService.getReleaseApplication(this.id).subscribe({
      next: (data) => {
        this.application = data;
        this.loading = false;
        this.loadRollbackPlan();
        this.loadPostLaunchReview();
        this.loadHandovers();
        this.loadLogs();
      },
      error: (err) => {
        this.loading = false;
        this.toastService.error(err.error?.detail || '加载失败');
      }
    });
  }

  loadUsers(): void {
    this.apiService.getUsers().subscribe({
      next: (data) => {
        this.users = data;
      }
    });
  }

  loadRollbackPlan(): void {
    this.rollbackPlanLoading = true;
    this.apiService.getRollbackPlan(this.id).subscribe({
      next: (data) => {
        this.rollbackPlan = data;
        this.rollbackPlanLoading = false;
      },
      error: () => {
        this.rollbackPlan = null;
        this.rollbackPlanLoading = false;
      }
    });
  }

  loadPostLaunchReview(): void {
    this.reviewLoading = true;
    this.apiService.getPostLaunchReview(this.id).subscribe({
      next: (data) => {
        this.postLaunchReview = data;
        this.reviewLoading = false;
      },
      error: () => {
        this.postLaunchReview = null;
        this.reviewLoading = false;
      }
    });
  }

  loadHandovers(): void {
    this.handoverLoading = true;
    this.apiService.getShiftHandovers({ app_id: this.id }).subscribe({
      next: (data) => {
        this.handovers = data;
        this.handoverLoading = false;
      },
      error: () => {
        this.handovers = [];
        this.handoverLoading = false;
      }
    });
  }

  loadLogs(): void {
    this.logsLoading = true;
    this.apiService.getOperationLogs({ app_id: this.id, limit: 50 }).subscribe({
      next: (data) => {
        this.operationLogs = data.items || [];
        this.logsLoading = false;
      },
      error: () => {
        this.operationLogs = [];
        this.logsLoading = false;
      }
    });
  }

  refreshAll(): void {
    this.loadDetail();
  }

  get isRegistrar(): boolean {
    return this.authService.hasRole(Role.REGISTRAR);
  }

  get isSupervisor(): boolean {
    return this.authService.hasRole(Role.SUPERVISOR);
  }

  get isReviewer(): boolean {
    return this.authService.hasRole(Role.REVIEWER);
  }

  get isRegistrarOrSupervisor(): boolean {
    return this.authService.hasRole([Role.REGISTRAR, Role.SUPERVISOR]);
  }

  get isAnyRole(): boolean {
    return this.authService.hasRole([Role.REGISTRAR, Role.SUPERVISOR, Role.REVIEWER]);
  }

  get canCreateRollbackPlan(): boolean {
    if (!this.application) return false;
    if (!this.isRegistrarOrSupervisor) return false;
    if (this.rollbackPlan) return false;
    const allowed = [
      ReleaseStatus.DRAFT, ReleaseStatus.PENDING_REVIEW,
      ReleaseStatus.REVIEW_REJECTED, ReleaseStatus.RECHECK_REJECTED,
      ReleaseStatus.REVIEW_APPROVED, ReleaseStatus.PENDING_RECHECK,
      ReleaseStatus.RECHECK_APPROVED
    ];
    return allowed.includes(this.application.status);
  }

  get canEditRollbackPlan(): boolean {
    if (!this.rollbackPlan) return false;
    if (!this.isRegistrar) return false;
    return !this.rollbackPlan.is_approved;
  }

  get canApproveRollbackPlan(): boolean {
    if (!this.rollbackPlan) return false;
    if (!this.isSupervisor) return false;
    if (this.rollbackPlan.is_approved) return false;
    if (!this.application) return false;
    const blocked = [
      ReleaseStatus.PUBLISHED, ReleaseStatus.ROLLED_BACK,
      ReleaseStatus.REVIEWED_POST_LAUNCH, ReleaseStatus.ARCHIVED
    ];
    return !blocked.includes(this.application.status);
  }

  get canCreateHandover(): boolean {
    if (!this.application) return false;
    if (!this.isAnyRole) return false;
    return this.application.status !== ReleaseStatus.ARCHIVED;
  }

  get allHandoversConfirmed(): boolean {
    return this.handovers.every(h => h.is_confirmed);
  }

  get hasConfirmedHandover(): boolean {
    return this.handovers.some(h => h.is_confirmed);
  }

  get confirmedHandoverCount(): number {
    return this.handovers.filter(h => h.is_confirmed).length;
  }

  get unconfirmedHandoverCount(): number {
    return this.handovers.filter(h => !h.is_confirmed).length;
  }

  get publishReady(): boolean {
    if (!this.rollbackPlan || !this.rollbackPlan.is_approved) return false;
    if (!this.hasConfirmedHandover) return false;
    return this.allHandoversConfirmed;
  }

  get canEdit(): boolean {
    if (!this.application) return false;
    if (!this.authService.hasRole(Role.REGISTRAR)) return false;
    if (this.application.creator_id !== this.authService.currentUser?.id) return false;
    return [ReleaseStatus.DRAFT, ReleaseStatus.REVIEW_REJECTED, ReleaseStatus.RECHECK_REJECTED]
      .includes(this.application.status);
  }

  get canSubmitReview(): boolean {
    if (!this.application) return false;
    if (!this.authService.hasRole(Role.REGISTRAR)) return false;
    if (this.application.creator_id !== this.authService.currentUser?.id) return false;
    return [ReleaseStatus.DRAFT, ReleaseStatus.REVIEW_REJECTED, ReleaseStatus.RECHECK_REJECTED]
      .includes(this.application.status);
  }

  get canReviewApprove(): boolean {
    if (!this.application) return false;
    if (!this.authService.hasRole(Role.SUPERVISOR)) return false;
    return this.application.status === ReleaseStatus.PENDING_REVIEW;
  }

  get canReviewReject(): boolean {
    return this.canReviewApprove;
  }

  get canSubmitRecheck(): boolean {
    if (!this.application) return false;
    if (!this.authService.hasRole(Role.SUPERVISOR)) return false;
    return this.application.status === ReleaseStatus.REVIEW_APPROVED;
  }

  get canRecheckApprove(): boolean {
    if (!this.application) return false;
    if (!this.authService.hasRole(Role.REVIEWER)) return false;
    return this.application.status === ReleaseStatus.PENDING_RECHECK;
  }

  get canRecheckReject(): boolean {
    return this.canRecheckApprove;
  }

  get canPublish(): boolean {
    if (!this.application) return false;
    if (!this.authService.hasRole(Role.REVIEWER)) return false;
    return this.application.status === ReleaseStatus.RECHECK_APPROVED;
  }

  get canRollback(): boolean {
    if (!this.application) return false;
    if (!this.authService.hasRole(Role.REVIEWER)) return false;
    return [ReleaseStatus.PUBLISHED, ReleaseStatus.REVIEWED_POST_LAUNCH]
      .includes(this.application.status);
  }

  get canArchive(): boolean {
    if (!this.application) return false;
    if (!this.authService.hasRole(Role.REVIEWER)) return false;
    return [ReleaseStatus.REVIEWED_POST_LAUNCH, ReleaseStatus.ROLLED_BACK]
      .includes(this.application.status);
  }

  get canCreateReview(): boolean {
    if (!this.application) return false;
    if (!this.authService.hasRole(Role.REVIEWER)) return false;
    return this.application.status === ReleaseStatus.PUBLISHED;
  }

  get canEditReview(): boolean {
    if (!this.postLaunchReview) return false;
    if (!this.authService.hasRole(Role.REVIEWER)) return false;
    return !this.postLaunchReview.reviewed_at;
  }

  get canCompleteReview(): boolean {
    if (!this.postLaunchReview) return false;
    if (!this.authService.hasRole(Role.REVIEWER)) return false;
    return !this.postLaunchReview.reviewed_at;
  }

  canConfirmHandover(h: ShiftHandover): boolean {
    if (h.is_confirmed) return false;
    return h.to_user_id === this.authService.currentUser?.id;
  }

  getStatusLabel(status: string): string {
    return (StatusLabels as any)[status] || status;
  }

  getShiftLabel(shift: string): string {
    return (ShiftLabels as any)[shift] || shift;
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      'registrar': '发布登记员',
      'supervisor': '发布审核主管',
      'reviewer': '复核负责人'
    };
    return labels[role] || role;
  }

  getOperationLabel(type: string): string {
    const labels: Record<string, string> = {
      'create': '创建',
      'update': '更新',
      'submit_review': '提交审核',
      'review_approve': '审核通过',
      'review_reject': '审核驳回',
      'submit_recheck': '提交复核',
      'recheck_approve': '复核通过',
      'recheck_reject': '复核驳回',
      'publish': '发布',
      'rollback': '回滚',
      'archive': '归档',
      'create_rollback_plan': '创建回滚预案',
      'update_rollback_plan': '更新回滚预案',
      'approve_rollback_plan': '审核回滚预案',
      'create_post_launch_review': '创建上线复盘',
      'update_post_launch_review': '更新上线复盘',
      'complete_post_launch_review': '完成上线复盘',
      'create_handover': '发起交接',
      'confirm_handover': '确认交接'
    };
    return labels[type] || type;
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  }

  submitReview(): void {
    if (!confirm('确定提交审核？')) return;
    this.apiService.submitForReview(this.id).subscribe({
      next: () => {
        this.toastService.success('提交审核成功');
        this.refreshAll();
      },
      error: (err) => {
        this.toastService.error(err.error?.detail || '操作失败');
      }
    });
  }

  showReviewModal(type: string): void {
    this.reviewDialogType = type;
    this.reviewDialogTitle = type === 'approve' ? '审核通过' : '审核驳回';
    this.reviewComment = '';
    this.showReviewDialog = true;
  }

  closeReviewModal(): void {
    this.showReviewDialog = false;
  }

  doReviewAction(): void {
    if (this.reviewDialogType === 'approve') {
      this.apiService.reviewApprove(this.id, this.reviewComment).subscribe({
        next: () => {
          this.toastService.success('审核通过');
          this.closeReviewModal();
          this.refreshAll();
        },
        error: (err) => {
          this.toastService.error(err.error?.detail || '操作失败');
        }
      });
    } else {
      this.apiService.reviewReject(this.id, this.reviewComment).subscribe({
        next: () => {
          this.toastService.success('审核驳回');
          this.closeReviewModal();
          this.refreshAll();
        },
        error: (err) => {
          this.toastService.error(err.error?.detail || '操作失败');
        }
      });
    }
  }

  submitRecheck(): void {
    if (!confirm('确定提交复核？')) return;
    this.apiService.submitForRecheck(this.id).subscribe({
      next: () => {
        this.toastService.success('提交复核成功');
        this.refreshAll();
      },
      error: (err) => {
        this.toastService.error(err.error?.detail || '操作失败');
      }
    });
  }

  showRecheckModal(type: string): void {
    this.reviewDialogType = type === 'approve' ? 'recheck_approve' : 'recheck_reject';
    this.reviewDialogTitle = type === 'approve' ? '复核通过' : '复核驳回';
    this.reviewComment = '';
    this.showReviewDialog = true;
  }

  publish(): void {
    if (!this.publishReady) {
      const missing: string[] = [];
      if (!this.rollbackPlan) missing.push('回滚预案尚未创建');
      else if (!this.rollbackPlan.is_approved) missing.push('回滚预案尚未审核');
      if (!this.hasConfirmedHandover) missing.push('尚无已确认交接');
      else if (!this.allHandoversConfirmed) missing.push(`${this.unconfirmedHandoverCount} 条交接待确认`);
      this.toastService.warning(`发布条件未满足：${missing.join('、')}`);
      return;
    }
    if (!confirm('确定发布此版本？发布前请确认回滚预案已审核、交接已确认。')) return;
    this.apiService.publishRelease(this.id).subscribe({
      next: () => {
        this.toastService.success('发布成功');
        this.refreshAll();
      },
      error: (err) => {
        this.toastService.error(err.error?.detail || '发布失败');
      }
    });
  }

  showRollbackModal(): void {
    this.rollbackReason = '';
    this.showRollbackDialog = true;
  }

  closeRollbackModal(): void {
    this.showRollbackDialog = false;
  }

  doRollback(): void {
    this.apiService.rollbackRelease(this.id, this.rollbackReason).subscribe({
      next: () => {
        this.toastService.success('回滚成功');
        this.closeRollbackModal();
        this.refreshAll();
      },
      error: (err) => {
        this.toastService.error(err.error?.detail || '操作失败');
      }
    });
  }

  archive(): void {
    if (!confirm('确定归档此申请？')) return;
    this.apiService.archiveRelease(this.id).subscribe({
      next: () => {
        this.toastService.success('归档成功');
        this.refreshAll();
      },
      error: (err) => {
        this.toastService.error(err.error?.detail || '操作失败');
      }
    });
  }

  showRollbackPlanForm(): void {
    if (this.rollbackPlan) {
      this.rollbackPlanForm = { ...this.rollbackPlan };
    } else {
      this.rollbackPlanForm = {
        trigger_condition: '',
        rollback_steps: '',
        rollback_person: '',
        expected_duration: ''
      };
    }
    this.showRollbackPlanDialog = true;
  }

  closeRollbackPlanForm(): void {
    this.showRollbackPlanDialog = false;
  }

  saveRollbackPlan(): void {
    if (!this.rollbackPlanForm.trigger_condition || !this.rollbackPlanForm.rollback_steps) {
      this.toastService.warning('请填写触发条件和回滚步骤');
      return;
    }

    if (this.rollbackPlan) {
      this.apiService.updateRollbackPlan(this.rollbackPlan.id, this.rollbackPlanForm).subscribe({
        next: () => {
          this.toastService.success('更新成功');
          this.closeRollbackPlanForm();
          this.loadRollbackPlan();
          this.loadLogs();
        },
        error: (err) => {
          this.toastService.error(err.error?.detail || '保存失败');
        }
      });
    } else {
      this.apiService.createRollbackPlan({
        ...this.rollbackPlanForm,
        release_application_id: this.id
      }).subscribe({
        next: () => {
          this.toastService.success('创建成功');
          this.closeRollbackPlanForm();
          this.loadRollbackPlan();
          this.loadLogs();
        },
        error: (err) => {
          this.toastService.error(err.error?.detail || '创建失败');
        }
      });
    }
  }

  approveRollbackPlan(): void {
    if (!this.rollbackPlan) return;
    if (!confirm('确定审核通过此回滚预案？')) return;
    this.apiService.approveRollbackPlan(this.rollbackPlan.id).subscribe({
      next: () => {
        this.toastService.success('回滚预案审核通过');
        this.loadRollbackPlan();
        this.loadLogs();
      },
      error: (err) => {
        this.toastService.error(err.error?.detail || '操作失败');
      }
    });
  }

  showReviewForm(): void {
    if (this.postLaunchReview) {
      this.reviewForm = { ...this.postLaunchReview };
    } else {
      this.reviewForm = {
        review_content: '',
        issues_found: '',
        improvement_measures: '',
        release_result: ''
      };
    }
    this.showReviewDialogPost = true;
  }

  closeReviewForm(): void {
    this.showReviewDialogPost = false;
  }

  saveReview(): void {
    if (this.postLaunchReview) {
      this.apiService.updatePostLaunchReview(this.postLaunchReview.id, this.reviewForm).subscribe({
        next: () => {
          this.toastService.success('更新成功');
          this.closeReviewForm();
          this.loadPostLaunchReview();
          this.loadLogs();
        },
        error: (err) => {
          this.toastService.error(err.error?.detail || '保存失败');
        }
      });
    } else {
      this.apiService.createPostLaunchReview({
        ...this.reviewForm,
        release_application_id: this.id
      }).subscribe({
        next: () => {
          this.toastService.success('创建成功');
          this.closeReviewForm();
          this.loadPostLaunchReview();
          this.loadLogs();
        },
        error: (err) => {
          this.toastService.error(err.error?.detail || '创建失败');
        }
      });
    }
  }

  completeReview(): void {
    if (!this.postLaunchReview) return;
    if (!confirm('确定完成上线复盘？完成后发布状态将变更为已复盘。')) return;
    this.apiService.completePostLaunchReview(this.postLaunchReview.id).subscribe({
      next: () => {
        this.toastService.success('复盘完成');
        this.refreshAll();
      },
      error: (err) => {
        this.toastService.error(err.error?.detail || '操作失败');
      }
    });
  }

  showHandoverForm(): void {
    this.handoverForm = {
      to_user_id: null,
      shift: Shift.DAY,
      handover_content: ''
    };
    this.showHandoverDialog = true;
  }

  closeHandoverForm(): void {
    this.showHandoverDialog = false;
  }

  createHandover(): void {
    if (!this.handoverForm.to_user_id) {
      this.toastService.warning('请选择接收人');
      return;
    }
    this.apiService.createShiftHandover({
      release_application_id: this.id,
      to_user_id: this.handoverForm.to_user_id,
      shift: this.handoverForm.shift,
      handover_content: this.handoverForm.handover_content
    }).subscribe({
      next: () => {
        this.toastService.success('交接发起成功');
        this.closeHandoverForm();
        this.loadHandovers();
        this.loadLogs();
      },
      error: (err) => {
        this.toastService.error(err.error?.detail || '创建失败');
      }
    });
  }

  confirmHandover(handoverId: number): void {
    if (!confirm('确认接收此交接？')) return;
    this.apiService.confirmShiftHandover(handoverId).subscribe({
      next: () => {
        this.toastService.success('交接确认成功');
        this.loadHandovers();
        this.loadLogs();
      },
      error: (err) => {
        this.toastService.error(err.error?.detail || '操作失败');
      }
    });
  }
}
