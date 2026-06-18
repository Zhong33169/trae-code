import { Component, inject, signal, effect, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import {
  ActionType, ApiError, AuditLog, Batch, BatchItem, ROLE_LABELS, ACTION_LABELS,
  STATUS_LABELS, TaskStatus, Task,
} from '../../core/models';
import { StatusBadgeComponent } from '../../components/status-badge.component';

@Component({
  selector: 'app-batch-detail',
  standalone: true,
  imports: [StatusBadgeComponent, RouterLink],
  template: `
    <div class="container">
      <div style="margin-bottom:14px;display:flex;align-items:center;gap:12px">
        <a routerLink="/batches" class="btn btn-ghost btn-sm">← 返回批次列表</a>
      </div>

      @if (loading()) {
        <div class="empty">加载中…</div>
      } @else {
        @if (batch(); as b) {
        <!-- 批次概要 -->
        <div class="card" style="margin-bottom:16px">
          <div class="card-head" style="flex-wrap:wrap;gap:10px">
            <h3 style="font-family:var(--font-mono)">{{ b.batchNo }}</h3>
            <span class="pill" [class]="b.failCount>0?'st-rejected':'st-confirmed'">
              {{ b.failCount>0 ? '部分失败' : '全部成功' }}
            </span>
            <div class="spacer" style="flex:1"></div>
            <span class="muted tiny">{{ actionLabel(b.action) }} · {{ b.operatorName }}（{{ roleLabel(b.operatorRole) }}）</span>
          </div>
          <div class="card-body">
            <div class="kv" style="grid-template-columns:100px 1fr 100px 1fr">
              <span class="k">批次号</span><span class="v mono">{{ b.batchNo }}</span>
              <span class="k">操作</span><span class="v">{{ actionLabel(b.action) }}</span>
              <span class="k">总数</span><span class="v mono">{{ b.total }}</span>
              <span class="k">成功</span><span class="v mono" style="color:var(--green)">{{ b.successCount }}</span>
              <span class="k">失败</span><span class="v mono" style="color:var(--red)">{{ b.failCount }}</span>
              <span class="k">创建时间</span><span class="v mono">{{ b.createdAt }}</span>
            </div>
            <div style="margin-top:10px;max-width:300px">
              <div class="countbar">
                <div class="s" [style.width.%]="b.total>0?(b.successCount/b.total*100):0"></div>
                <div class="f" [style.width.%]="b.total>0?(b.failCount/b.total*100):0"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 明细表 -->
        <div class="card" style="margin-bottom:16px">
          <div class="card-head">
            <h3>批次明细</h3>
            <span class="muted tiny">{{ items().length }} 项</span>
            <div class="spacer" style="flex:1"></div>
            @if (failedItems().length > 0) {
              <button class="btn btn-sm btn-danger" (click)="openRetry()">重试失败项（{{ failedItems().length }}）</button>
            }
          </div>
          <div style="overflow:auto">
            <table class="tbl">
              <thead>
                <tr>
                  <th>任务号</th>
                  <th>状态</th>
                  <th>错误原因</th>
                  <th>重试次数</th>
                  <th>处理时间</th>
                </tr>
              </thead>
              <tbody>
                @for (it of items(); track it.id) {
                  <tr [class.row-failed]="it.status==='failed'">
                    <td class="mono">{{ it.taskNo }}</td>
                    <td>
                      @if (it.status==='success') { <span class="pill st-confirmed"><span class="dot"></span>成功</span> }
                      @if (it.status==='failed') { <span class="pill st-rejected"><span class="dot"></span>失败</span> }
                    </td>
                    <td>
                      @if (it.errorReason) { <span class="err-tag">ERROR</span> {{ it.errorReason }} }
                      @else { <span class="muted">—</span> }
                    </td>
                    <td class="mono">{{ it.retryCount }}</td>
                    <td class="mono tiny">{{ it.processedAt }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- 批量审计日志 -->
        <div class="card">
          <div class="card-head"><h3>批量审计日志</h3></div>
          <div class="card-body">
            @if (auditLogs().length === 0) {
              <div class="empty">暂无审计记录。</div>
            } @else {
              <table class="tbl">
                <thead><tr><th>时间</th><th>任务号</th><th>动作</th><th>操作人</th><th>状态变化</th><th>详情</th></tr></thead>
                <tbody>
                  @for (l of auditLogs(); track l.id) {
                    <tr>
                      <td class="mono tiny">{{ l.createdAt }}</td>
                      <td class="mono">{{ l.taskNo }}</td>
                      <td>{{ actionLabel(l.action) }}</td>
                      <td>{{ l.operatorName }} <span class="muted tiny">({{ roleLabel(l.operatorRole) }})</span></td>
                      <td><span class="mono">{{ statusLabel(l.fromStatus) }}</span> → <span class="mono">{{ statusLabel(l.toStatus) }}</span></td>
                      <td class="sub">{{ l.detail }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
        } @else {
          <div class="empty">批次不存在。</div>
        }
      }

      <!-- 重试弹窗 -->
      @if (retryOpen()) {
        <div class="modal-back" (click)="closeRetry()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="m-head"><h3>重试失败项</h3><button class="x-btn" (click)="closeRetry()">×</button></div>
            <div class="m-body">
              @if (retryErr()) {
                <div class="alert alert-error"><span class="ico">!</span><span><span class="err-tag">{{ retryErr()?.code }}</span> {{ retryErr()?.message }}</span></div>
              }
              <div class="alert alert-info">
                <span class="ico">i</span>
                <span>将对 <b>{{ failedItems().length }}</b> 个失败项重新执行「{{ actionLabel(batch()?.action ?? '') }}」，逐项校验。</span>
              </div>
              <div class="field">
                <label>重试证据 / 备注（必填）</label>
                <textarea [value]="retryEvidence()" (input)="retryEvidence.set($any($event.target).value)" placeholder="补充重试说明或更正后的证据"></textarea>
              </div>
            </div>
            <div class="m-foot">
              <button class="btn" (click)="closeRetry()">取消</button>
              <button class="btn btn-primary" (click)="runRetry()" [disabled]="retryBusy() || !retryEvidence().trim()">
                @if (retryBusy()) { <span class="spin"></span> } 执行重试
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class BatchDetailComponent {
  private api = inject(ApiService);
  auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  batch = signal<Batch | null>(null);
  items = signal<BatchItem[]>([]);
  auditLogs = signal<AuditLog[]>([]);
  loading = signal(true);

  retryOpen = signal(false);
  retryEvidence = signal('');
  retryBusy = signal(false);
  retryErr = signal<ApiError | null>(null);

  private batchId = Number(this.route.snapshot.paramMap.get('id'));

  roleLabel = (r: string) => ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r;
  actionLabel = (a: string) => ACTION_LABELS[a as ActionType] ?? a;
  statusLabel = (s: string) => STATUS_LABELS[s as TaskStatus] ?? s;

  failedItems = () => this.items().filter(i => i.status === 'failed');

  constructor() {
    effect(() => {
      this.auth.user();
      untracked(() => this.load());
    });
  }

  async load() {
    this.loading.set(true);
    try {
      const res = await this.api.getBatch(this.batchId);
      this.batch.set(res.batch);
      this.items.set(res.items);
      this.auditLogs.set(res.auditLogs);
    } catch {
      this.batch.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  openRetry() {
    this.retryEvidence.set('');
    this.retryErr.set(null);
    this.retryOpen.set(true);
  }
  closeRetry() { this.retryOpen.set(false); }

  async runRetry() {
    this.retryBusy.set(true);
    this.retryErr.set(null);
    try {
      const failedIds = this.failedItems().map(i => i.id);
      const res = await this.api.retryBatch(this.batchId, { itemIds: failedIds, evidence: this.retryEvidence() });
      this.batch.set(res.batch);
      this.items.set(res.items);
      this.retryOpen.set(false);
    } catch (e) {
      this.retryErr.set(e as ApiError);
    } finally {
      this.retryBusy.set(false);
    }
  }
}
