import { Component, inject, signal, effect, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { RefreshService } from '../../core/refresh.service';
import {
  ActionType, ApiError, AuditLog, ROLE_LABELS, STATUS_LABELS, Task, TaskStatus,
  ACTION_LABELS,
} from '../../core/models';
import { StatusBadgeComponent } from '../../components/status-badge.component';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [StatusBadgeComponent, RouterLink],
  template: `
    <div class="container">
      <div style="margin-bottom:14px">
        <a routerLink="/" class="btn btn-ghost btn-sm">← 返回队列</a>
      </div>

      @if (loading()) {
        <div class="card"><div class="empty">加载中…</div></div>
      } @else {
        @if (task(); as t) {
          <div class="grid-2" style="grid-template-columns: 1fr 360px">
          <!-- 主区 -->
          <section style="display:flex;flex-direction:column;gap:16px">
            <!-- 任务概要 -->
            <div class="card">
              <div class="card-head" style="flex-wrap:wrap;gap:10px">
                <h3 style="font-family:var(--font-mono)">{{ t.taskNo }}</h3>
                <app-status-badge [status]="t.status" />
                <span class="ver-badge">v{{ t.version }}</span>
                @if (t.lastBatchNo) { <span class="muted tiny">最近批次 {{ t.lastBatchNo }}</span> }
                <div class="spacer" style="flex:1"></div>
                <span class="muted tiny">当前处理：{{ roleLabel(t.currentHandlerRole) }}</span>
              </div>
              <div class="card-body">
                <div class="kv" style="grid-template-columns:110px 1fr 110px 1fr">
                  <span class="k">保单号</span><span class="v mono">{{ t.policyNo }}</span>
                  <span class="k">客户名称</span><span class="v">{{ t.customerName }}</span>
                  <span class="k">产品</span><span class="v">{{ t.product }}</span>
                  <span class="k">续保类型</span><span class="v">{{ t.renewalType }}</span>
                  <span class="k">原保费</span><span class="v mono">¥{{ t.originalPremium }}</span>
                  <span class="k">新保费</span><span class="v mono">¥{{ t.newPremium }}</span>
                  <span class="k">登记人</span><span class="v">{{ t.submitterName }}</span>
                  <span class="k">更新时间</span><span class="v mono tiny">{{ t.updatedAt }}</span>
                </div>
              </div>
            </div>

            <!-- 办理操作区（角色受限） -->
            <div class="card">
              <div class="card-head"><h3>办理操作</h3><span class="muted tiny">仅当前角色可执行的环节会显示</span></div>
              <div class="card-body">
                @if (available().length === 0) {
                  <div class="alert alert-info">
                    <span class="ico">i</span>
                    <span>{{ noActionHint() }}</span>
                  </div>
                } @else {
                  <div class="chip-filter" style="margin-bottom:12px">
                    @for (a of available(); track a) {
                      <button [class.active]="pendingAction()===a" (click)="pickAction(a)">{{ actionLabel(a) }}</button>
                    }
                  </div>

                  @if (pendingAction(); as a) {
                    <div style="display:flex;flex-direction:column;gap:10px">
                      <div class="alert alert-info">
                        <span class="ico">i</span>
                        <span>
                          将以 <b>{{ roleLabel(curRole()) }}</b> 身份执行「{{ actionLabel(a) }}」，
                          基于版本 <b>v{{ t.version }}</b>（乐观锁）。
                          @if (a!=='reject') { 执行成功后任务流转至「{{ statusLabel(nextStatus(a)) }}」。 }
                        </span>
                      </div>
                      @if (actionErr()) {
                        <div class="alert alert-error"><span class="ico">!</span><span><span class="err-tag">{{ actionErr()?.code }}</span> {{ actionErr()?.message }}</span></div>
                      }
                      <div class="field">
                        <label>{{ a==='reject' ? '驳回原因' : actionLabel(a) + '证据 / 备注' }}</label>
                        <textarea [value]="actionInput()" (input)="actionInput.set($any($event.target).value)" placeholder="{{ placeholder(a) }}"></textarea>
                      </div>
                      <div>
                        <button class="btn btn-primary" (click)="runAction(a)" [disabled]="actionBusy() || (a!=='reject' && !actionInput().trim())">
                          @if (actionBusy()) { <span class="spin"></span> } 确认{{ actionLabel(a) }}
                        </button>
                      </div>
                    </div>
                  }
                }
              </div>
            </div>

            <!-- 流转历史 -->
            <div class="card">
              <div class="card-head"><h3>流转历史</h3></div>
              <div class="card-body">
                @if (logs().length === 0) {
                  <div class="empty">暂无流转记录。</div>
                } @else {
                  <table class="tbl">
                    <thead><tr><th>时间</th><th>动作</th><th>操作人</th><th>状态变化</th><th>详情</th></tr></thead>
                    <tbody>
                      @for (l of logs(); track l.id) {
                        <tr>
                          <td class="mono tiny">{{ l.createdAt }}</td>
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
          </section>

          <!-- 侧栏：证据时间线 -->
          <aside>
            <div class="card">
              <div class="card-head"><h3>证据链</h3></div>
              <div class="card-body">
                <div class="timeline">
                  <div class="tl-item" [class.done]="!!t.regEvidence">
                    <div class="tl-title">① 续保任务登记</div>
                    @if (t.regEvidence; as e) {
                      <div class="tl-content">{{ e.content }}</div>
                      <div class="evi-meta">{{ e.operator }} · {{ e.ts }}</div>
                    } @else { <div class="tl-content muted">尚未登记</div> }
                  </div>
                  <div class="tl-item" [class.done]="!!t.verifyEvidence">
                    <div class="tl-title">② 过程核验</div>
                    @if (t.verifyEvidence; as e) {
                      <div class="tl-content">{{ e.content }}</div>
                      <div class="evi-meta">{{ e.operator }} · {{ e.ts }}</div>
                    } @else { <div class="tl-content muted">尚未核验</div> }
                  </div>
                  <div class="tl-item" [class.done]="!!t.archiveEvidence">
                    <div class="tl-title">③ 复核归档</div>
                    @if (t.archiveEvidence; as e) {
                      <div class="tl-content">{{ e.content }}</div>
                      <div class="evi-meta">{{ e.operator }} · {{ e.ts }}</div>
                    } @else { <div class="tl-content muted">尚未归档</div> }
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
        } @else {
          <div class="card"><div class="empty">任务不存在或已删除。</div></div>
        }
      }
    </div>
  `,
})
export class TaskDetailComponent {
  private api = inject(ApiService);
  auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private refresh = inject(RefreshService);

  task = signal<Task | null>(null);
  logs = signal<AuditLog[]>([]);
  loading = signal(true);

  pendingAction = signal<ActionType | null>(null);
  actionInput = signal('');
  actionBusy = signal(false);
  actionErr = signal<ApiError | null>(null);

  private taskId = Number(this.route.snapshot.paramMap.get('id'));

  constructor() {
    effect(() => {
      this.auth.user();
      this.refresh.generation();
      untracked(() => this.load());
    });
  }

  curRole() { return this.auth.user()?.role ?? ''; }
  roleLabel = (r: string) => ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r;
  statusLabel = (s: string) => STATUS_LABELS[s as TaskStatus] ?? s;
  actionLabel = (a: string) => ACTION_LABELS[a as ActionType] ?? a;

  async load() {
    this.loading.set(true);
    try {
      const res = await this.api.getTask(this.taskId);
      this.task.set(res.task);
      this.logs.set(res.auditLogs);
      this.pendingAction.set(null);
      this.actionInput.set('');
      this.actionErr.set(null);
    } catch {
      this.task.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  available(): ActionType[] {
    const t = this.task();
    const role = this.curRole();
    if (!t) return [];
    const out: ActionType[] = [];
    if (role === 'customer_manager' && t.status === 'draft') out.push('submit');
    if (role === 'underwriting_specialist' && t.status === 'submitted') out.push('review', 'reject');
    if (role === 'business_owner' && t.status === 'reviewed') out.push('confirm', 'reject');
    if (role === 'business_owner' && t.status === 'confirmed') out.push('archive');
    return out;
  }

  noActionHint(): string {
    const t = this.task();
    if (!t) return '';
    const role = this.curRole();
    const nextRole = this.roleLabel(t.currentHandlerRole);
    if (t.status === 'archived') return '任务已归档，流程结束。';
    if (t.status === 'rejected') return '任务已驳回。客户经理可重新登记或调整后再次提交。';
    if (role !== t.currentHandlerRole) return `当前角色为「${this.roleLabel(role)}」，本环节应由「${nextRole}」处理，后一岗位无法替前一岗位补流程。`;
    return '当前无可执行操作。';
  }

  nextStatus(a: ActionType): TaskStatus {
    const m: Record<ActionType, TaskStatus> = {
      submit: 'submitted', review: 'reviewed', confirm: 'confirmed', archive: 'archived', reject: 'rejected',
    };
    return m[a];
  }

  placeholder(a: ActionType): string {
    const m: Record<ActionType, string> = {
      submit: '客户经理提交：已与客户确认续保方案、保费无异议。',
      review: '核保专员复核：核保要素齐备、费率合规。',
      confirm: '业务负责人确认：复核结论无误，同意放行。',
      archive: '业务负责人归档：续保保单已出单并归档。',
      reject: '驳回原因：请说明需补充的事项。',
    };
    return m[a];
  }

  pickAction(a: ActionType) {
    this.pendingAction.set(a);
    this.actionInput.set('');
    this.actionErr.set(null);
  }

  async runAction(a: ActionType) {
    const t = this.task();
    if (!t) return;
    this.actionBusy.set(true);
    this.actionErr.set(null);
    try {
      await this.api.transition(t.id, {
        action: a,
        version: t.version,
        evidence: a === 'reject' ? '' : this.actionInput(),
        reason: a === 'reject' ? this.actionInput() : undefined,
      });
      this.refresh.markDirty();
    } catch (e) {
      this.actionErr.set(e as ApiError);
    } finally {
      this.actionBusy.set(false);
    }
  }
}
