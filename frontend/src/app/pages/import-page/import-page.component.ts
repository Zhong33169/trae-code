import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {
  TopicService,
  ImportBatch,
  ImportRecord,
  ImportTopicItem,
  ImportResult,
} from '../../services/topic.service';

@Component({
  selector: 'app-import-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>选题单离线台账回填</h2>
      </div>

      <div class="grid">
        <div class="card">
          <h3>导入配置</h3>
          <div class="form">
            <div class="field">
              <label>数据来源 *</label>
              <input [(ngModel)]="importForm.source" class="input" placeholder="如：2025年6月线下台账.xlsx / 历史系统迁移" />
            </div>
            <div class="field">
              <label>批次备注</label>
              <textarea [(ngModel)]="importForm.remark" class="input" rows="2" placeholder="可选，说明本次回填背景"></textarea>
            </div>
          </div>

          <h3 style="margin-top: 18px;">待导入选题单（一行一条，JSON 数组，可多条）</h3>
          <div class="muted" style="margin-bottom: 8px;">
            支持字段：topic_no(编号), title(标题), source(来源), reporter(记者), department(部门), deadline(YYYY-MM-DD), status(registered/reviewed/archived/rejected), content
          </div>
          <textarea
            [(ngModel)]="importJson"
            class="input code"
            rows="10"
            placeholder='[
  {"topic_no":"XT202506901","title":"线下台账示例选题","source":"线下台账","reporter":"王记者","department":"时政部","deadline":"2025-07-01","status":"registered"}
]'
          ></textarea>

          <div class="actions" style="margin-top: 12px;">
            <button class="btn" (click)="fillSample()">填充示例（含冲突和错误）</button>
            <button class="btn-primary" (click)="execute()" [disabled]="!auth.hasRole(['registrar']) || loading">
              {{ loading ? '处理中...' : '执行回填（选题登记员）' }}
            </button>
          </div>

          <div *ngIf="opError" class="error" style="margin-top: 8px;">{{ opError }}</div>

          <div *ngIf="lastResult()" class="result-box">
            <h4>本次导入结果</h4>
            <div class="result-stats">
              <span>批次号：{{ lastResult()!.batch_no }}</span>
              <span>总数：<b>{{ lastResult()!.total_count }}</b></span>
              <span class="ok">成功：<b>{{ lastResult()!.success_count }}</b></span>
              <span class="warn">冲突：<b>{{ lastResult()!.conflict_count }}</b></span>
              <span class="err">失败：<b>{{ lastResult()!.error_count }}</b></span>
            </div>
            <table class="sub-table" style="margin-top: 10px;">
              <thead>
                <tr><th>编号</th><th>状态</th><th>错误/说明</th><th>差异</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of lastResult()!.records">
                  <td>
                    <ng-container *ngIf="r.topic_id">
                      <a [routerLink]="['/topics', r.topic_id]" class="link">{{ r.topic_no }}</a>
                    </ng-container>
                    <ng-container *ngIf="!r.topic_id">{{ r.topic_no }}</ng-container>
                  </td>
                  <td>
                    <span class="istatus istatus-{{ r.status }}">
                      {{ r.status === 'success' ? '成功' : r.status === 'conflict' ? '冲突（未覆盖）' : '失败' }}
                    </span>
                  </td>
                  <td class="err-cell">{{ r.error_msg || '-' }}</td>
                  <td style="font-family: monospace; font-size: 12px; max-width: 260px;">
                    <div *ngIf="r.diff_json && r.diff_json !== '{}'" style="white-space: pre-wrap;">
                      {{ formatDiff(r.diff_json) }}
                    </div>
                    <span *ngIf="!r.diff_json || r.diff_json === '{}'" class="muted">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="muted" style="margin-top: 8px; font-size: 12px;">
              说明：冲突条目不会静默覆盖，会保留线上现状并记录差异，需人工确认后再处理。
            </div>
          </div>
        </div>

        <div class="card">
          <h3>历史导入批次</h3>
          <table class="sub-table">
            <thead>
              <tr>
                <th>批次号</th><th>来源</th><th>操作人</th><th>时间</th>
                <th>总数</th><th class="ok">成功</th><th class="warn">冲突</th><th class="err">失败</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let b of batches()">
                <td>{{ b.batch_no }}</td>
                <td>{{ b.source }}</td>
                <td>{{ b.operator_name }}</td>
                <td>{{ b.imported_at | slice : 0 : 16 }}</td>
                <td>{{ b.total_count }}</td>
                <td class="ok">{{ b.success_count }}</td>
                <td class="warn">{{ b.conflict_count }}</td>
                <td class="err">{{ b.error_count }}</td>
                <td><button class="btn-link" (click)="toggleBatch(b.id)">明细</button></td>
              </tr>
              <tr *ngIf="batches().length === 0"><td colspan="9" class="empty">暂无批次</td></tr>
            </tbody>
          </table>

          <div *ngIf="currentRecords().length > 0" style="margin-top: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h4 style="margin: 0;">批次明细：{{ expandedBatchId }}</h4>
              <div style="font-size: 12px; color: #666;">
                共 {{ currentRecords().length }} 条
              </div>
            </div>

            <div class="record-group" *ngIf="successRecords().length > 0">
              <div class="group-title group-title-success">
                <span class="dot dot-success"></span>
                成功导入 ({{ successRecords().length }})
              </div>
              <table class="sub-table">
                <thead><tr><th>选题编号</th><th>标题</th><th>关联选题</th></tr></thead>
                <tbody>
                  <tr *ngFor="let r of successRecords()">
                    <td>{{ r.topic_no }}</td>
                    <td>{{ r.title || '-' }}</td>
                    <td>
                      <a *ngIf="r.topic_id" [routerLink]="['/topics', r.topic_id]" class="link">查看选题</a>
                      <span *ngIf="!r.topic_id" class="muted">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="record-group" *ngIf="conflictRecords().length > 0">
              <div class="group-title group-title-conflict">
                <span class="dot dot-conflict"></span>
                冲突未覆盖 ({{ conflictRecords().length }})
              </div>
              <table class="sub-table">
                <thead><tr><th>选题编号</th><th>标题</th><th>冲突原因</th><th>字段差异</th></tr></thead>
                <tbody>
                  <tr *ngFor="let r of conflictRecords()">
                    <td>{{ r.topic_no }}</td>
                    <td>{{ r.title || '-' }}</td>
                    <td class="warn-cell">{{ r.error_msg || '-' }}</td>
                    <td style="font-family: monospace; font-size: 12px; max-width: 300px;">
                      <div *ngIf="r.diff_json && r.diff_json !== '{}'" style="white-space: pre-wrap;">
                        {{ formatDiff(r.diff_json) }}
                      </div>
                      <span *ngIf="!r.diff_json || r.diff_json === '{}'" class="muted">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="record-group" *ngIf="errorRecords().length > 0">
              <div class="group-title group-title-error">
                <span class="dot dot-error"></span>
                导入失败 ({{ errorRecords().length }})
              </div>
              <table class="sub-table">
                <thead><tr><th>选题编号</th><th>标题</th><th>失败原因</th></tr></thead>
                <tbody>
                  <tr *ngFor="let r of errorRecords()">
                    <td>{{ r.topic_no }}</td>
                    <td>{{ r.title || '-' }}</td>
                    <td class="err-cell">{{ r.error_msg || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .page { display: flex; flex-direction: column; gap: 16px; }
      .page-header h2 { margin: 0; color: #1f3a68; }
      .grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 16px; }
      @media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }
      .card { background: #fff; border-radius: 6px; padding: 18px; }
      .card h3 { margin: 0 0 12px; color: #1f3a68; font-size: 15px; }
      .form { display: flex; flex-direction: column; gap: 10px; }
      .field { display: flex; flex-direction: column; gap: 4px; }
      .field label { font-size: 13px; color: #444; }
      .input { padding: 6px 10px; border: 1px solid #cfd8e3; border-radius: 4px; font-size: 14px; }
      .input.code { font-family: Menlo, Consolas, monospace; font-size: 12.5px; line-height: 1.6; }
      .actions { display: flex; gap: 10px; }
      .btn { padding: 6px 14px; border: 1px solid #cfd8e3; background: #fff; border-radius: 4px; cursor: pointer; }
      .btn-primary { padding: 8px 16px; background: #1f3a68; color: #fff; border: 0; border-radius: 4px; cursor: pointer; }
      .btn-primary[disabled] { opacity: 0.6; }
      .btn-link { background: none; border: 0; color: #1f5fb0; cursor: pointer; text-decoration: underline; }
      .error { color: #a53225; font-size: 13px; }
      .muted { color: #888; font-size: 12px; }
      .result-box {
        margin-top: 18px; padding: 14px; background: #f7f9fc; border: 1px solid #dde4ef; border-radius: 6px;
      }
      .result-box h4 { margin: 0 0 10px; color: #1f3a68; }
      .result-stats { display: flex; gap: 18px; font-size: 13px; align-items: center; flex-wrap: wrap; }
      .result-stats b { font-size: 15px; }
      .ok { color: #1d7a38; }
      .warn { color: #a76b12; }
      .err { color: #a53225; }
      .err-cell { color: #a53225; }
      .istatus { padding: 2px 10px; border-radius: 10px; font-size: 12px; }
      .istatus-success { background: #d8f3df; color: #1d7a38; }
      .istatus-conflict { background: #fff3d6; color: #a76b12; }
      .istatus-error { background: #fde0dc; color: #a53225; }
      .sub-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .sub-table th { background: #eef2fb; padding: 8px; text-align: left; color: #445; font-weight: 600; }
      .sub-table td { padding: 8px; border-top: 1px solid #eef0f5; vertical-align: top; }
      .sub-table .empty { text-align: center; color: #999; padding: 24px 0; }
      .link { color: #1f5fb0; text-decoration: none; }
      .record-group { margin-bottom: 14px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
      .group-title {
        padding: 10px 14px; font-size: 13px; font-weight: 600;
        display: flex; align-items: center; gap: 8px;
      }
      .group-title-success { background: #d8f3df; color: #1d7a38; }
      .group-title-conflict { background: #fff3d6; color: #a76b12; }
      .group-title-error { background: #fde0dc; color: #a53225; }
      .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
      .dot-success { background: #1d7a38; }
      .dot-conflict { background: #a76b12; }
      .dot-error { background: #a53225; }
      .warn-cell { color: #a76b12; }
    `,
  ],
})
export class ImportPageComponent implements OnInit {
  batches = signal<ImportBatch[]>([]);
  currentRecords = signal<ImportRecord[]>([]);
  expandedBatchId = '';
  lastResult = signal<ImportResult | null>(null);
  loading = false;
  opError = '';

  successRecords = computed(() => this.currentRecords().filter(r => r.status === 'success'));
  conflictRecords = computed(() => this.currentRecords().filter(r => r.status === 'conflict'));
  errorRecords = computed(() => this.currentRecords().filter(r => r.status === 'error'));

  importForm = { source: '', remark: '' };
  importJson = '';

  constructor(public auth: AuthService, private service: TopicService) {}

  ngOnInit() {
    this.loadBatches();
  }

  loadBatches() {
    this.service.listBatches().subscribe((res) => {
      if (res.code === 0) this.batches.set(res.data || []);
    });
  }

  toggleBatch(id: string) {
    if (this.expandedBatchId === id) {
      this.expandedBatchId = '';
      this.currentRecords.set([]);
      return;
    }
    this.expandedBatchId = id;
    this.service.batchRecords(id).subscribe((res) => {
      if (res.code === 0) this.currentRecords.set(res.data || []);
    });
  }

  fillSample() {
    this.importForm.source = '2025年6月线下台账（演示）';
    this.importForm.remark = '用于验收演示：含成功、冲突、非法状态各一条';
    this.importJson = JSON.stringify(
      [
        {
          topic_no: 'XT202506910',
          title: '线下台账-基层党建专题',
          source: '2025年6月线下台账',
          reporter: '演示记者A',
          department: '时政部',
          deadline: '2025-07-05',
          status: 'registered',
          content: '演示：正常离线台账回填样例',
        },
        {
          topic_no: 'XT202506001',
          title: '关于加强基层宣传工作的专题报道（线下修改版）',
          source: '线下台账',
          reporter: '演示记者B',
          department: '时政部',
          deadline: '2025-07-15',
          status: 'reviewed',
          content: '演示：与线上 XT202506001 冲突，不会被覆盖',
        },
        {
          topic_no: 'XT202506911',
          title: '线下台账-非法状态样例',
          source: '2025年6月线下台账',
          reporter: '演示记者C',
          department: '社会部',
          status: 'done',
          content: '演示：非法状态值，会被拒绝导入',
        },
      ],
      null,
      2
    );
  }

  execute() {
    this.opError = '';
    this.lastResult.set(null);
    if (!this.importForm.source) {
      this.opError = '请填写数据来源';
      return;
    }
    let items: ImportTopicItem[] = [];
    try {
      items = JSON.parse(this.importJson || '[]');
    } catch (e: any) {
      this.opError = 'JSON 格式错误：' + e.message;
      return;
    }
    if (!items.length) {
      this.opError = '请至少填写一条待导入记录';
      return;
    }
    this.loading = true;
    this.service
      .executeImport({
        source: this.importForm.source,
        remark: this.importForm.remark,
        items,
      })
      .subscribe({
        next: (res) => {
          this.loading = false;
          if (res.code === 0) {
            this.lastResult.set(res.data);
            this.loadBatches();
          } else {
            this.opError = res.message || '导入失败';
          }
        },
        error: (e) => {
          this.loading = false;
          this.opError = '请求失败：' + (e.message || JSON.stringify(e));
        },
      });
  }

  formatDiff(json: string) {
    try {
      const obj = JSON.parse(json);
      const lines: string[] = [];
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        lines.push(`${k}: ${JSON.stringify(v.old)} → ${JSON.stringify(v.new)}`);
      }
      return lines.join('\n') || '-';
    } catch {
      return json;
    }
  }
}
