import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TopicService, Topic } from '../../services/topic.service';

@Component({
  selector: 'app-topic-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>选题单列表</h2>
        <div class="actions">
          <button *ngIf="auth.hasRole(['registrar'])" class="btn-primary" (click)="showCreate = true">
            发起选题登记
          </button>
        </div>
      </div>

      <div class="filters">
        <div class="filter-item">
          <label>状态</label>
          <select [(ngModel)]="filters.status" (change)="load()" class="input">
            <option value="">全部</option>
            <option value="registered">已登记</option>
            <option value="reviewed">已审核</option>
            <option value="archived">已归档</option>
            <option value="rejected">已退回</option>
          </select>
        </div>
        <div class="filter-item">
          <label>异常类型</label>
          <select [(ngModel)]="filters.anomaly" (change)="load()" class="input">
            <option value="">全部</option>
            <option value="normal">正常</option>
            <option value="missing_material">缺材料</option>
            <option value="overdue">超时</option>
            <option value="rejected">退回</option>
          </select>
        </div>
        <div class="filter-item flex-1">
          <label>关键词</label>
          <input
            [(ngModel)]="filters.keyword"
            (keyup.enter)="load()"
            class="input"
            placeholder="选题单编号/标题/记者"
          />
        </div>
        <div class="filter-item">
          <button class="btn" (click)="load()">查询</button>
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>编号</th>
            <th>标题</th>
            <th>来源</th>
            <th>记者</th>
            <th>部门</th>
            <th>截止日期</th>
            <th>状态</th>
            <th>异常</th>
            <th>登记人</th>
            <th>登记时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let t of topics()">
            <td>{{ t.topic_no }}</td>
            <td>{{ t.title }}</td>
            <td>{{ t.source }}</td>
            <td>{{ t.reporter }}</td>
            <td>{{ t.department }}</td>
            <td>{{ t.deadline ? (t.deadline | slice : 0 : 10) : '-' }}</td>
            <td><span class="status status-{{ t.status }}">{{ statusLabel(t.status) }}</span></td>
            <td><span class="anomaly anomaly-{{ t.anomaly_tag || 'normal' }}">{{ anomalyLabel(t.anomaly_tag) }}</span></td>
            <td>{{ t.register_name }}</td>
            <td>{{ t.register_at | slice : 0 : 16 }}</td>
            <td>
              <a [routerLink]="['/topics', t.id]" class="link">详情/处理</a>
            </td>
          </tr>
          <tr *ngIf="topics().length === 0">
            <td colspan="11" class="empty">暂无数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div *ngIf="showCreate" class="modal-mask" (click.self)="showCreate = false">
      <div class="modal">
        <div class="modal-header">
          <h3>发起选题登记（选题登记员）</h3>
          <button (click)="showCreate = false" class="btn-link">关闭</button>
        </div>
        <div class="modal-body form">
          <div class="field">
            <label>选题单编号 *</label>
            <input [(ngModel)]="form.topic_no" class="input" placeholder="如 XT202506005" />
          </div>
          <div class="field">
            <label>标题 *</label>
            <input [(ngModel)]="form.title" class="input" />
          </div>
          <div class="row">
            <div class="field">
              <label>来源 *</label>
              <input [(ngModel)]="form.source" class="input" />
            </div>
            <div class="field">
              <label>记者 *</label>
              <input [(ngModel)]="form.reporter" class="input" />
            </div>
            <div class="field">
              <label>部门 *</label>
              <input [(ngModel)]="form.department" class="input" />
            </div>
          </div>
          <div class="field">
            <label>截止日期</label>
            <input type="date" [(ngModel)]="form.deadline" class="input" />
          </div>
          <div class="field">
            <label>内容</label>
            <textarea [(ngModel)]="form.content" class="input" rows="4"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <div class="error" *ngIf="createError">{{ createError }}</div>
          <button class="btn" (click)="showCreate = false">取消</button>
          <button class="btn-primary" (click)="submitCreate()">提交登记</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .page { display: flex; flex-direction: column; gap: 16px; }
      .page-header { display: flex; align-items: center; justify-content: space-between; }
      .page-header h2 { margin: 0; color: #1f3a68; }
      .actions { display: flex; gap: 8px; }
      .btn { padding: 6px 14px; border: 1px solid #cfd8e3; background: #fff; border-radius: 4px; cursor: pointer; }
      .btn-primary { padding: 6px 14px; background: #1f3a68; color: #fff; border: 0; border-radius: 4px; cursor: pointer; }
      .filters { display: flex; gap: 12px; padding: 14px; background: #fff; border-radius: 6px; align-items: end; }
      .filter-item { display: flex; flex-direction: column; gap: 4px; }
      .filter-item label { font-size: 12px; color: #666; }
      .filter-item.flex-1 { flex: 1; }
      .input { padding: 6px 10px; border: 1px solid #cfd8e3; border-radius: 4px; font-size: 14px; }
      .data-table { width: 100%; background: #fff; border-collapse: collapse; border-radius: 6px; overflow: hidden; font-size: 14px; }
      .data-table th { background: #eef2fb; padding: 10px; text-align: left; color: #445; font-weight: 600; }
      .data-table td { padding: 10px; border-top: 1px solid #eef0f5; }
      .data-table .empty { text-align: center; color: #999; padding: 40px 0; }
      .status, .anomaly { padding: 2px 8px; border-radius: 10px; font-size: 12px; }
      .status-registered { background: #e3f0ff; color: #1f5fb0; }
      .status-reviewed { background: #fff3d6; color: #a76b12; }
      .status-archived { background: #d8f3df; color: #1d7a38; }
      .status-rejected { background: #fde0dc; color: #a53225; }
      .anomaly-normal { background: #eef6ee; color: #1f7a3b; }
      .anomaly-missing_material { background: #fff4e0; color: #a56b10; }
      .anomaly-overdue { background: #ffe5e5; color: #a53225; }
      .anomaly-rejected { background: #fde0dc; color: #a53225; }
      .link { color: #1f5fb0; text-decoration: none; }
      .modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 100; }
      .modal { background: #fff; width: 620px; max-height: 90vh; overflow: auto; border-radius: 8px; }
      .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid #eee; }
      .modal-header h3 { margin: 0; color: #1f3a68; }
      .modal-body { padding: 20px; }
      .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid #eee; align-items: center; }
      .form { display: flex; flex-direction: column; gap: 12px; }
      .row { display: flex; gap: 12px; }
      .row .field { flex: 1; }
      .field { display: flex; flex-direction: column; gap: 4px; }
      .field label { font-size: 13px; color: #444; }
      .btn-link { background: none; border: 0; color: #666; cursor: pointer; }
      .error { color: #a53225; font-size: 13px; margin-right: auto; }
    `,
  ],
})
export class TopicListComponent implements OnInit {
  topics = signal<Topic[]>([]);
  filters = { status: '', anomaly: '', keyword: '' };
  showCreate = false;
  createError = '';
  form: any = {
    topic_no: '',
    title: '',
    source: '',
    reporter: '',
    department: '',
    deadline: '',
    content: '',
  };

  constructor(
    public auth: AuthService,
    private service: TopicService,
    private router: Router
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.service.listTopics(this.filters).subscribe((res) => {
      if (res.code === 0) this.topics.set(res.data || []);
    });
  }

  statusLabel(s?: string) {
    return (
      { registered: '已登记', reviewed: '已审核', archived: '已归档', rejected: '已退回' } as Record<
        string,
        string
      >
    )[s || ''] || s;
  }

  anomalyLabel(a?: string) {
    return (
      {
        normal: '正常',
        missing_material: '缺材料',
        overdue: '超时',
        rejected: '退回',
      } as Record<string, string>
    )[a || 'normal'] || '正常';
  }

  submitCreate() {
    this.createError = '';
    if (!this.form.topic_no || !this.form.title || !this.form.source || !this.form.reporter || !this.form.department) {
      this.createError = '请填写必填项';
      return;
    }
    const payload = { ...this.form };
    if (!payload.deadline) delete payload.deadline;
    this.service.createTopic(payload).subscribe((res) => {
      if (res.code === 0) {
        this.showCreate = false;
        this.form = { topic_no: '', title: '', source: '', reporter: '', department: '', deadline: '', content: '' };
        this.load();
        this.router.navigate(['/topics', res.data.id]);
      } else {
        this.createError = res.message || '提交失败';
      }
    });
  }
}
