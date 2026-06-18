import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TopicService, Topic, Attachment, AuditLog } from '../../services/topic.service';

@Component({
  selector: 'app-topic-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="page" *ngIf="topic()">
      <div class="page-header">
        <h2>
          选题单：{{ topic().topic_no }}
          <span class="status status-{{ topic().status }}">{{ statusLabel(topic().status) }}</span>
          <span class="anomaly anomaly-{{ topic().anomaly_tag || 'normal' }}">
            {{ anomalyLabel(topic().anomaly_tag) }}
          </span>
          <span *ngIf="topic().created_from === 'offline'" class="badge-offline">离线回填</span>
        </h2>
        <a routerLink="/topics" class="link">返回列表</a>
      </div>

      <div class="grid">
        <div class="card">
          <h3>基础信息</h3>
          <div class="info-grid">
            <div><span>标题</span><b>{{ topic().title }}</b></div>
            <div><span>来源</span><b>{{ topic().source }}</b></div>
            <div><span>记者</span><b>{{ topic().reporter }}</b></div>
            <div><span>部门</span><b>{{ topic().department }}</b></div>
            <div><span>截止日期</span><b>{{ topic().deadline ? (topic().deadline | slice : 0 : 10) : '-' }}</b></div>
            <div><span>登记人</span><b>{{ topic().register_name }}</b></div>
            <div><span>登记时间</span><b>{{ topic().register_at | slice : 0 : 16 }}</b></div>
            <div *ngIf="topic().import_batch_id"><span>回填批次</span><b>{{ topic().import_batch_id | slice : 0 : 8 }}</b></div>
          </div>
          <div class="field-block">
            <label>选题内容</label>
            <div class="content-box">{{ topic().content || '（无）' }}</div>
          </div>
        </div>

        <div class="card">
          <h3>处理过程</h3>
          <div class="timeline">
            <div class="tl-item">
              <div class="tl-dot dot-registered"></div>
              <div>
                <div class="tl-title">选题登记员发起登记</div>
                <div class="tl-meta">{{ topic().register_name }} · {{ topic().register_at | slice : 0 : 16 }}</div>
              </div>
            </div>
            <div *ngIf="topic().reviewer_id" class="tl-item">
              <div class="tl-dot dot-{{ topic().review_result }}"></div>
              <div>
                <div class="tl-title">
                  选题审核主管{{ topic().review_result === 'approved' ? '审核通过' : '退回' }}
                </div>
                <div class="tl-meta">{{ topic().reviewer_name }} · {{ topic().review_at | slice : 0 : 16 }}</div>
                <div *ngIf="topic().review_comment" class="tl-detail">审核意见：{{ topic().review_comment }}</div>
                <div *ngIf="topic().reject_reason" class="tl-detail reject">退回原因：{{ topic().reject_reason }}</div>
              </div>
            </div>
            <div *ngIf="topic().archiver_id" class="tl-item">
              <div class="tl-dot dot-archived"></div>
              <div>
                <div class="tl-title">新闻采编中心复核归档</div>
                <div class="tl-meta">{{ topic().archiver_name }} · {{ topic().archive_at | slice : 0 : 16 }}</div>
                <div *ngIf="topic().archive_comment" class="tl-detail">复核备注：{{ topic().archive_comment }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="card-header">
            <h3>附件</h3>
            <button *ngIf="auth.hasRole(['registrar','reviewer','archiver'])" class="btn" (click)="showAttach = true">上传附件</button>
          </div>
          <table class="sub-table">
            <thead>
              <tr><th>文件名</th><th>类型</th><th>大小</th><th>上传人</th><th>上传时间</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let a of attachments()">
                <td>{{ a.filename }}</td>
                <td>{{ a.file_type || '-' }}</td>
                <td>{{ a.file_size ? (a.file_size/1024 | number : '1.0-0') + ' KB' : '-' }}</td>
                <td>{{ a.uploaded_by_name }}</td>
                <td>{{ a.uploaded_at | slice : 0 : 16 }}</td>
              </tr>
              <tr *ngIf="attachments().length === 0"><td colspan="5" class="empty">暂无附件</td></tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <h3>审计备注</h3>
          <table class="sub-table">
            <thead>
              <tr><th>时间</th><th>操作人</th><th>动作</th><th>状态</th><th>详情</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of audits()">
                <td>{{ log.created_at | slice : 0 : 16 }}</td>
                <td>{{ log.user_name }}</td>
                <td>{{ actionLabel(log.action) }}</td>
                <td>
                  <span *ngIf="log.old_status">{{ statusLabel(log.old_status) }}</span>
                  <span *ngIf="log.old_status && log.new_status"> → </span>
                  <span *ngIf="log.new_status">{{ statusLabel(log.new_status) }}</span>
                </td>
                <td>{{ log.detail || '-' }}</td>
              </tr>
              <tr *ngIf="audits().length === 0"><td colspan="5" class="empty">暂无记录</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card actions-card">
        <h3>业务处理</h3>
        <div *ngIf="!canDoAnything()" class="muted">当前角色/状态下无可执行操作</div>

        <ng-container *ngIf="topic().status === 'registered' && auth.hasRole(['reviewer'])">
          <div class="form-row">
            <label>审核结果：</label>
            <select [(ngModel)]="review.result" class="input">
              <option value="approved">通过</option>
              <option value="rejected">退回</option>
            </select>
          </div>
          <div class="form-row">
            <label>审核意见：</label>
            <textarea [(ngModel)]="review.comment" class="input" rows="2"></textarea>
          </div>
          <div class="form-row" *ngIf="review.result === 'rejected'">
            <label>退回原因 *：</label>
            <textarea [(ngModel)]="review.reject_reason" class="input" rows="2"></textarea>
          </div>
          <div class="form-row error" *ngIf="opError">{{ opError }}</div>
          <div class="form-row">
            <button class="btn-primary" (click)="submitReview()">提交审核（选题审核主管）</button>
          </div>
        </ng-container>

        <ng-container *ngIf="topic().status === 'reviewed' && auth.hasRole(['archiver'])">
          <div class="form-row">
            <label>复核备注：</label>
            <textarea [(ngModel)]="archive.comment" class="input" rows="2"></textarea>
          </div>
          <div class="form-row error" *ngIf="opError">{{ opError }}</div>
          <div class="form-row">
            <button class="btn-primary" (click)="submitArchive()">复核归档（新闻采编中心复核负责人）</button>
          </div>
        </ng-container>

        <ng-container *ngIf="topic().status === 'rejected' && auth.hasRole(['registrar'])">
          <div class="muted">当前选题单已被退回，可补正后重新提交。</div>
          <div class="form-row">
            <label>选题单编号 *</label>
            <input [(ngModel)]="rectify.topic_no" class="input" />
          </div>
          <div class="form-row">
            <label>标题 *</label>
            <input [(ngModel)]="rectify.title" class="input" />
          </div>
          <div class="form-row">
            <div class="field-inline">
              <label>来源 *</label><input [(ngModel)]="rectify.source" class="input" />
            </div>
            <div class="field-inline">
              <label>记者 *</label><input [(ngModel)]="rectify.reporter" class="input" />
            </div>
            <div class="field-inline">
              <label>部门 *</label><input [(ngModel)]="rectify.department" class="input" />
            </div>
          </div>
          <div class="form-row">
            <label>截止日期</label>
            <input type="date" [(ngModel)]="rectify.deadline" class="input" />
          </div>
          <div class="form-row">
            <label>内容</label>
            <textarea [(ngModel)]="rectify.content" class="input" rows="3"></textarea>
          </div>
          <div class="form-row error" *ngIf="opError">{{ opError }}</div>
          <div class="form-row">
            <button class="btn-primary" (click)="submitRectify()">补正并重新提交（选题登记员）</button>
          </div>
        </ng-container>
      </div>
    </div>

    <div *ngIf="showAttach" class="modal-mask" (click.self)="showAttach = false">
      <div class="modal">
        <div class="modal-header"><h3>上传附件</h3><button class="btn-link" (click)="showAttach = false">关闭</button></div>
        <div class="modal-body form">
          <div class="field">
            <label>文件名 *</label>
            <input [(ngModel)]="attachForm.filename" class="input" />
          </div>
          <div class="row">
            <div class="field">
              <label>类型</label>
              <input [(ngModel)]="attachForm.file_type" class="input" placeholder="如 application/pdf" />
            </div>
            <div class="field">
              <label>大小(字节)</label>
              <input type="number" [(ngModel)]="attachForm.file_size" class="input" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <div class="error" *ngIf="attachError">{{ attachError }}</div>
          <button class="btn" (click)="showAttach = false">取消</button>
          <button class="btn-primary" (click)="submitAttach()">上传</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .page { display: flex; flex-direction: column; gap: 16px; }
      .page-header { display: flex; align-items: center; justify-content: space-between; }
      .page-header h2 { margin: 0; display: flex; align-items: center; gap: 10px; color: #1f3a68; }
      .link { color: #1f5fb0; text-decoration: none; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
      .card { background: #fff; border-radius: 6px; padding: 18px; }
      .card h3 { margin: 0 0 12px; color: #1f3a68; font-size: 15px; }
      .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .card-header h3 { margin: 0; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
      .info-grid > div { display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
      .info-grid span { color: #888; }
      .info-grid b { color: #222; font-weight: 500; }
      .field-block { margin-top: 14px; display: flex; flex-direction: column; gap: 4px; }
      .field-block label { font-size: 13px; color: #888; }
      .content-box { background: #f7f9fc; padding: 10px 12px; border-radius: 4px; font-size: 13px; line-height: 1.7; min-height: 40px; }
      .timeline { display: flex; flex-direction: column; gap: 14px; }
      .tl-item { display: flex; gap: 12px; position: relative; }
      .tl-dot { width: 12px; height: 12px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
      .dot-registered { background: #1f6feb; }
      .dot-approved { background: #1d7a38; }
      .dot-rejected { background: #a53225; }
      .dot-archived { background: #6b3ea5; }
      .tl-title { font-weight: 600; font-size: 14px; color: #222; }
      .tl-meta { color: #888; font-size: 12px; margin-top: 2px; }
      .tl-detail { margin-top: 6px; background: #f7f9fc; padding: 6px 10px; border-radius: 4px; font-size: 13px; color: #444; }
      .tl-detail.reject { background: #fde0dc; color: #a53225; }
      .sub-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .sub-table th { background: #eef2fb; padding: 8px; text-align: left; color: #445; font-weight: 600; }
      .sub-table td { padding: 8px; border-top: 1px solid #eef0f5; }
      .sub-table .empty { text-align: center; color: #999; padding: 24px 0; }
      .actions-card { display: flex; flex-direction: column; gap: 10px; }
      .form-row { display: flex; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
      .form-row > label { width: 120px; color: #555; padding-top: 6px; font-size: 13px; flex-shrink: 0; }
      .form-row .input, .form-row textarea.input { flex: 1; min-width: 260px; }
      .field-inline { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 180px; }
      .field-inline label { font-size: 12px; color: #666; }
      .input { padding: 6px 10px; border: 1px solid #cfd8e3; border-radius: 4px; font-size: 14px; }
      .btn { padding: 6px 14px; border: 1px solid #cfd8e3; background: #fff; border-radius: 4px; cursor: pointer; }
      .btn-primary { padding: 8px 16px; background: #1f3a68; color: #fff; border: 0; border-radius: 4px; cursor: pointer; }
      .btn-link { background: none; border: 0; color: #666; cursor: pointer; }
      .muted { color: #888; font-size: 13px; }
      .error { color: #a53225; font-size: 13px; }
      .status, .anomaly, .badge-offline { padding: 2px 10px; border-radius: 10px; font-size: 12px; font-weight: normal; }
      .status-registered { background: #e3f0ff; color: #1f5fb0; }
      .status-reviewed { background: #fff3d6; color: #a76b12; }
      .status-archived { background: #d8f3df; color: #1d7a38; }
      .status-rejected { background: #fde0dc; color: #a53225; }
      .anomaly-normal { background: #eef6ee; color: #1f7a3b; }
      .anomaly-missing_material { background: #fff4e0; color: #a56b10; }
      .anomaly-overdue { background: #ffe5e5; color: #a53225; }
      .anomaly-rejected { background: #fde0dc; color: #a53225; }
      .badge-offline { background: #6b3ea5; color: #fff; }
      .modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 100; }
      .modal { background: #fff; width: 480px; border-radius: 8px; }
      .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid #eee; }
      .modal-header h3 { margin: 0; color: #1f3a68; }
      .modal-body { padding: 20px; }
      .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid #eee; align-items: center; }
      .form { display: flex; flex-direction: column; gap: 12px; }
      .row { display: flex; gap: 12px; }
      .row .field { flex: 1; display: flex; flex-direction: column; gap: 4px; }
      .field label { font-size: 13px; color: #444; }
    `,
  ],
})
export class TopicDetailComponent implements OnInit {
  topic = signal<Topic | null>(null);
  attachments = signal<Attachment[]>([]);
  audits = signal<AuditLog[]>([]);
  showAttach = false;
  attachForm: any = { filename: '', file_type: '', file_size: null };
  attachError = '';
  opError = '';
  review: any = { result: 'approved', comment: '', reject_reason: '' };
  archive: any = { comment: '' };
  rectify: any = { topic_no: '', title: '', source: '', reporter: '', department: '', deadline: '', content: '' };

  constructor(
    public auth: AuthService,
    private service: TopicService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.load(id);
  }

  load(id: string) {
    this.service.getTopic(id).subscribe((res) => {
      if (res.code === 0) {
        this.topic.set(res.data);
        const t = res.data;
        this.rectify = {
          topic_no: t.topic_no,
          title: t.title,
          source: t.source,
          reporter: t.reporter,
          department: t.department,
          deadline: t.deadline ? (t.deadline as string).slice(0, 10) : '',
          content: t.content || '',
        };
      }
    });
    this.service.listAttachments(id).subscribe((res) => {
      if (res.code === 0) this.attachments.set(res.data || []);
    });
    this.service.listAudit(id).subscribe((res) => {
      if (res.code === 0) this.audits.set(res.data || []);
    });
  }

  canDoAnything() {
    const t = this.topic();
    if (!t) return false;
    if (t.status === 'registered' && this.auth.hasRole(['reviewer'])) return true;
    if (t.status === 'reviewed' && this.auth.hasRole(['archiver'])) return true;
    if (t.status === 'rejected' && this.auth.hasRole(['registrar'])) return true;
    return false;
  }

  statusLabel(s?: string) {
    return ({ registered: '已登记', reviewed: '已审核', archived: '已归档', rejected: '已退回' } as Record<string, string>)[s || ''] || s;
  }
  anomalyLabel(a?: string) {
    return ({ normal: '正常', missing_material: '缺材料', overdue: '超时', rejected: '退回' } as Record<string, string>)[a || 'normal'] || '正常';
  }
  actionLabel(a?: string) {
    return (
      {
        create: '登记',
        approve: '审核通过',
        reject: '退回',
        archive: '复核归档',
        rectify: '补正重提',
        upload_attachment: '上传附件',
        import_create: '离线回填创建',
        import_conflict: '离线回填冲突',
        import_error: '离线回填失败',
      } as Record<string, string>
    )[a || ''] || a;
  }

  submitReview() {
    this.opError = '';
    if (this.review.result === 'rejected' && !this.review.reject_reason) {
      this.opError = '退回时必须填写退回原因';
      return;
    }
    this.service.reviewTopic(this.topic()!.id, this.review).subscribe((res) => {
      if (res.code === 0) {
        this.load(this.topic()!.id);
        this.review = { result: 'approved', comment: '', reject_reason: '' };
      } else {
        this.opError = res.message || '操作失败';
      }
    });
  }

  submitArchive() {
    this.opError = '';
    this.service.archiveTopic(this.topic()!.id, this.archive).subscribe((res) => {
      if (res.code === 0) {
        this.load(this.topic()!.id);
        this.archive = { comment: '' };
      } else {
        this.opError = res.message || '操作失败';
      }
    });
  }

  submitRectify() {
    this.opError = '';
    const payload = { ...this.rectify };
    if (!payload.deadline) delete payload.deadline;
    this.service.rectifyTopic(this.topic()!.id, payload).subscribe((res) => {
      if (res.code === 0) {
        this.load(this.topic()!.id);
      } else {
        this.opError = res.message || '操作失败';
      }
    });
  }

  submitAttach() {
    this.attachError = '';
    if (!this.attachForm.filename) {
      this.attachError = '请输入文件名';
      return;
    }
    this.service.addAttachment(this.topic()!.id, this.attachForm).subscribe((res) => {
      if (res.code === 0) {
        this.showAttach = false;
        this.attachForm = { filename: '', file_type: '', file_size: null };
        this.load(this.topic()!.id);
      } else {
        this.attachError = res.message || '上传失败';
      }
    });
  }
}
