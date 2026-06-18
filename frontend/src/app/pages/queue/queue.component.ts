import { Component, inject, signal, effect, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import {
  ActionType, ApiError, AppUser, Task, TaskStatus, STATUS_FILTERS,
  ROLE_LABELS, ACTION_LABELS, actionRequiredRole,
} from '../../core/models';
import { StatusBadgeComponent } from '../../components/status-badge.component';
import { EvidenceCardComponent } from '../../components/evidence-card.component';

interface BatchResult { batchNo: string; total: number; success: number; failed: number; failedItems: { taskNo: string; reason: string }[]; batchId: number; }

const PRODUCTS = ['车险-商业险', '车险-交强险', '家财险', '意外健康险', '企业财产险', '责任险'];
const RENEWAL_TYPES = ['原险种续保', '降保额续保', '升保额续保', '转保'];

@Component({
  selector: 'app-queue',
  standalone: true,
  imports: [StatusBadgeComponent, EvidenceCardComponent, RouterLink],
  template: `
    <div class="container">
      <div class="grid-2">
        <!-- ============ 主区：任务队列 ============ -->
        <section>
          <div class="card" style="overflow:visible">
            <div class="card-head" style="flex-wrap:wrap;gap:14px">
              <h3>续保任务队列</h3>
              <span class="muted tiny">共 {{ total() }} 条</span>
              <div class="spacer" style="flex:1"></div>
              @if (canRegister()) {
                <button class="btn btn-sm" (click)="openCreate()">＋ 登记新任务</button>
              }
            </div>

            <div style="padding:12px 16px;border-bottom:1px solid var(--line-soft);display:flex;flex-wrap:wrap;gap:12px;align-items:center">
              <div class="chip-filter">
                <button [class.active]="statusFilter()===''" (click)="setStatus('')">全部</button>
                @for (f of statusFilters; track f.value) {
                  <button [class.active]="statusFilter()===f.value" (click)="setStatus(f.value)">{{ f.label }}</button>
                }
              </div>
              <div class="search-input" style="flex:1;min-width:200px">
                <input class="input" placeholder="按任务号 / 保单号 / 客户名 搜索" [value]="q()" (input)="onSearch($event)" />
              </div>
            </div>

            <div style="overflow:auto;max-height:calc(100vh - 230px)">
              @if (loading()) {
                <div class="empty">加载中…</div>
              } @else if (tasks().length === 0) {
                <div class="empty">没有符合条件的续保任务。</div>
              } @else {
                <table class="tbl">
                  <thead>
                    <tr>
                      <th style="width:34px"><input type="checkbox" [checked]="allChecked()" (change)="toggleAll($event)" /></th>
                      <th>任务号</th>
                      <th>保单号 / 客户</th>
                      <th>产品</th>
                      <th>续保类型</th>
                      <th>保费（原→新）</th>
                      <th>状态</th>
                      <th>当前处理</th>
                      <th>版本</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (t of tasks(); track t.id) {
                      <tr [class.is-active]="activeId()===t.id" [class.selected]="selected().has(t.id)" (click)="setActive(t)">
                        <td (click)="$event.stopPropagation()"><input type="checkbox" [checked]="selected().has(t.id)" (change)="toggleSelect(t.id)" /></td>
                        <td class="mono">{{ t.taskNo }}</td>
                        <td>
                          <div style="font-weight:600">{{ t.policyNo }}</div>
                          <div class="muted tiny">{{ t.customerName }}</div>
                        </td>
                        <td>{{ t.product }}</td>
                        <td>{{ t.renewalType }}</td>
                        <td class="mono">¥{{ t.originalPremium }} → ¥{{ t.newPremium }}</td>
                        <td><app-status-badge [status]="t.status" /></td>
                        <td>{{ roleLabel(t.currentHandlerRole) }}</td>
                        <td><span class="ver-badge">v{{ t.version }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </div>

          <!-- 批量操作条 -->
          @if (selected().size > 0) {
            <div class="batch-bar">
              <div class="sel">已选 <b>{{ selected().size }}</b> 项任务</div>
              <div class="acts">
                @for (a of batchActions(); track a) {
                  <button (click)="openBatch(a)">{{ actionLabel(a) }}（批量）</button>
                }
                @if (batchActions().length === 0) {
                  <button class="dis" title="当前角色无可执行的批量操作">当前角色无可批量执行的环节</button>
                }
              </div>
              <div class="spacer" style="flex:1"></div>
              <button (click)="clearSelection()" style="background:transparent;border:1px solid rgba(255,255,255,.2);color:#fff;padding:7px 13px;border-radius:8px;cursor:pointer">清空选择</button>
            </div>
          }
        </section>

        <!-- ============ 侧栏：关键证据 ============ -->
        <aside>
          @if (active(); as t) {
            <div class="card">
              <div class="card-head">
                <h3>关键证据</h3>
                <span class="ver-badge">{{ t.taskNo }}</span>
              </div>
              <div class="card-body" style="display:flex;flex-direction:column;gap:12px">
                <div class="kv">
                  <span class="k">保单号</span><span class="v mono">{{ t.policyNo }}</span>
                  <span class="k">客户</span><span class="v">{{ t.customerName }}</span>
                  <span class="k">状态</span><span class="v"><app-status-badge [status]="t.status" /></span>
                  <span class="k">当前处理</span><span class="v">{{ roleLabel(t.currentHandlerRole) }}</span>
                </div>

                <div>
                  <div class="section-title" style="margin-top:6px">证据链完整度 {{ completeness(t) }}</div>
                  <div class="countbar">
                    <div class="s" [style.width.%]="completenessPct(t)"></div>
                  </div>
                </div>

                <app-evidence-card title="① 续保任务登记" [evi]="t.regEvidence" hint="客户经理尚未提交登记证据。" />
                <app-evidence-card title="② 过程核验" [evi]="t.verifyEvidence" hint="核保专员尚未补充核验证据。" />
                <app-evidence-card title="③ 复核归档" [evi]="t.archiveEvidence" hint="业务负责人尚未补充归档证据。" />

                <a class="btn btn-primary" [routerLink]="['/tasks', t.id]" style="justify-content:center">进入办理 →</a>
              </div>
            </div>
          } @else {
            <div class="card">
              <div class="card-head"><h3>关键证据</h3></div>
              <div class="empty">点击左侧任意任务，查看「登记 / 过程核验 / 复核归档」三段证据。</div>
            </div>
          }
        </aside>
      </div>
    </div>

    <!-- ============ 批量操作确认弹窗 ============ -->
    @if (batchOpen()) {
      <div class="modal-back" (click)="closeBatch()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>批量{{ actionLabel(batchAction()!) }} · 确认</h3>
            <button class="x-btn" (click)="closeBatch()">×</button>
          </div>
          <div class="m-body">
            @if (batchErr()) {
              <div class="alert alert-error"><span class="ico">!</span><span><span class="err-tag">{{ batchErr()?.code }}</span> {{ batchErr()?.message }}</span></div>
            }
            <div class="alert alert-info">
              <span class="ico">i</span>
              <span>将对 <b>{{ selectedIds().length }}</b> 条任务执行「{{ actionLabel(batchAction()!) }}」；逐项校验，部分失败会留在结果中并可重试。</span>
            </div>
            <div class="field">
              <label>{{ actionLabel(batchAction()!) }}证据 / 备注（必填）</label>
              <textarea [value]="batchEvidence()" (input)="batchEvidence.set($any($event.target).value)" placeholder="{{ evidencePlaceholder(batchAction()!) }}"></textarea>
            </div>
            <div class="muted tiny">执行人：{{ curUser()?.displayName }}（{{ roleLabel(curUser()?.role) }}）</div>
          </div>
          <div class="m-foot">
            <button class="btn" (click)="closeBatch()">取消</button>
            <button class="btn btn-primary" (click)="runBatch()" [disabled]="batchBusy() || !batchEvidence().trim()">
              @if (batchBusy()) { <span class="spin"></span> } 执行批量
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ============ 批量结果弹窗 ============ -->
    @if (result(); as r) {
      <div class="modal-back" (click)="closeResult()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head">
            <h3>批量结果 · {{ r.batchNo }}</h3>
            <button class="x-btn" (click)="closeResult()">×</button>
          </div>
          <div class="m-body">
            <div class="kv">
              <span class="k">总数</span><span class="v mono">{{ r.total }}</span>
              <span class="k">成功</span><span class="v mono" style="color:var(--green)">{{ r.success }}</span>
              <span class="k">失败</span><span class="v mono" style="color:var(--red)">{{ r.failed }}</span>
            </div>
            <div class="countbar">
              <div class="s" [style.width.%]="pct(r.success, r.total)"></div>
              <div class="f" [style.width.%]="pct(r.failed, r.total)"></div>
            </div>

            @if (r.failedItems.length > 0) {
              <div>
                <div class="section-title" style="color:var(--red)">失败明细（可重试，失败项已留痕）</div>
                <table class="tbl">
                  <thead><tr><th>任务号</th><th>失败原因</th></tr></thead>
                  <tbody>
                    @for (it of r.failedItems; track it.taskNo) {
                      <tr class="row-failed"><td class="mono">{{ it.taskNo }}</td><td>{{ it.reason }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <div class="alert alert-success"><span class="ico">✓</span><span>全部成功。</span></div>
            }
          </div>
          <div class="m-foot">
            <a class="btn" [routerLink]="['/batches', r.batchId]">查看完整批次明细</a>
            <button class="btn btn-primary" (click)="closeResult()">完成</button>
          </div>
        </div>
      </div>
    }

    <!-- ============ 登记新任务弹窗 ============ -->
    @if (createOpen()) {
      <div class="modal-back" (click)="closeCreate()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="m-head"><h3>登记续保任务</h3><button class="x-btn" (click)="closeCreate()">×</button></div>
          <div class="m-body">
            @if (createErr()) {
              <div class="alert alert-error"><span class="ico">!</span><span><span class="err-tag">{{ createErr()?.code }}</span> {{ createErr()?.message }}</span></div>
            }
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="field"><label>任务号</label><input class="input mono" [value]="form.taskNo" (input)="form.taskNo=$any($event.target).value" placeholder="RT-2025-XXXX" /></div>
              <div class="field"><label>保单号</label><input class="input mono" [value]="form.policyNo" (input)="form.policyNo=$any($event.target).value" placeholder="PA-..." /></div>
              <div class="field"><label>客户名称</label><input class="input" [value]="form.customerName" (input)="form.customerName=$any($event.target).value" /></div>
              <div class="field"><label>产品</label>
                <select class="select" [value]="form.product" (change)="form.product=$any($event.target).value">
                  @for (p of products; track p) { <option [value]="p">{{ p }}</option> }
                </select>
              </div>
              <div class="field"><label>续保类型</label>
                <select class="select" [value]="form.renewalType" (change)="form.renewalType=$any($event.target).value">
                  @for (rt of renewalTypes; track rt) { <option [value]="rt">{{ rt }}</option> }
                </select>
              </div>
              <div class="field"><label>原保费</label><input class="input mono" type="number" [value]="form.originalPremium" (input)="form.originalPremium=+$any($event.target).value" /></div>
              <div class="field"><label>新保费</label><input class="input mono" type="number" [value]="form.newPremium" (input)="form.newPremium=+$any($event.target).value" /></div>
            </div>
            <div class="field"><label>登记证据 / 备注</label><textarea [value]="form.regEvidence" (input)="form.regEvidence=$any($event.target).value" placeholder="客户确认续保意愿、原保单到期日、核保基础资料等"></textarea></div>
          </div>
          <div class="m-foot">
            <button class="btn" (click)="closeCreate()">取消</button>
            <button class="btn btn-primary" (click)="submitCreate()" [disabled]="createBusy()">保存草稿</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class QueueComponent {
  private api = inject(ApiService);
  auth = inject(AuthService);

  statusFilters = STATUS_FILTERS;
  products = PRODUCTS;
  renewalTypes = RENEWAL_TYPES;

  tasks = signal<Task[]>([]);
  total = signal(0);
  loading = signal(false);

  statusFilter = signal<TaskStatus | ''>('');
  q = signal('');
  selected = signal<Set<number>>(new Set());
  activeId = signal<number | null>(null);

  private searchTimer: any = null;

  // batch modal
  batchOpen = signal(false);
  batchAction = signal<ActionType | null>(null);
  batchEvidence = signal('');
  batchBusy = signal(false);
  batchErr = signal<ApiError | null>(null);
  result = signal<BatchResult | null>(null);

  // create modal
  createOpen = signal(false);
  createBusy = signal(false);
  createErr = signal<ApiError | null>(null);
  form = { taskNo: '', policyNo: '', customerName: '', product: PRODUCTS[0], renewalType: RENEWAL_TYPES[0], originalPremium: 0, newPremium: 0, regEvidence: '' };

  constructor() {
    effect(() => {
      this.auth.user();
      untracked(() => this.reload());
    });
  }

  curUser(): AppUser | null { return this.auth.user(); }
  roleLabel = (r: string | undefined) => ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r ?? '';
  actionLabel = (a: ActionType) => ACTION_LABELS[a];

  canRegister(): boolean { return this.auth.user()?.role === 'customer_manager'; }

  active(): Task | null { return this.tasks().find(t => t.id === this.activeId()) ?? null; }

  allChecked(): boolean {
    const s = this.selected();
    return this.tasks().length > 0 && this.tasks().every(t => s.has(t.id));
  }

  toggleAll(ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    const s = new Set(checked ? this.tasks().map(t => t.id) : []);
    this.selected.set(s);
  }

  toggleSelect(id: number) {
    const s = new Set(this.selected());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.selected.set(s);
  }

  clearSelection() { this.selected.set(new Set()); }

  setActive(t: Task) { this.activeId.set(t.id); }

  setStatus(s: TaskStatus | '') { this.statusFilter.set(s); this.reload(); }

  onSearch(ev: Event) {
    const v = (ev.target as HTMLInputElement).value;
    this.q.set(v);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.reload(), 280);
  }

  async reload() {
    this.loading.set(true);
    try {
      const res = await this.api.listTasks({ status: this.statusFilter(), q: this.q(), size: 200 });
      this.tasks.set(res.items);
      this.total.set(res.total);
      if (this.activeId() && !res.items.some(t => t.id === this.activeId())) this.activeId.set(null);
    } catch {
      this.tasks.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  completeness(t: Task): string {
    const have = [!!t.regEvidence, !!t.verifyEvidence, !!t.archiveEvidence].filter(Boolean).length;
    return `${have}/3`;
  }
  completenessPct(t: Task): number {
    const have = [!!t.regEvidence, !!t.verifyEvidence, !!t.archiveEvidence].filter(Boolean).length;
    return (have / 3) * 100;
  }

  selectedIds(): number[] { return Array.from(this.selected()); }

  batchActions(): ActionType[] {
    const role = this.auth.user()?.role;
    const all: ActionType[] = ['submit', 'review', 'confirm', 'archive', 'reject'];
    return all.filter(a => role === actionRequiredRole(a));
  }

  openBatch(a: ActionType) {
    if (this.selected().size === 0) return;
    this.batchAction.set(a);
    this.batchEvidence.set(this.evidencePlaceholder(a));
    this.batchErr.set(null);
    this.batchOpen.set(true);
  }

  closeBatch() { this.batchOpen.set(false); }

  evidencePlaceholder(a: ActionType): string {
    const m: Record<ActionType, string> = {
      submit: '客户经理提交：已与客户确认续保方案、保费无异议。',
      review: '核保专员复核：核保要素齐备、费率合规、无异常。',
      confirm: '业务负责人确认：复核结论无误，同意放行归档。',
      archive: '业务负责人归档：续保保单已出单并归档。',
      reject: '驳回原因：请补充 XXX 后重新提交。',
    };
    return m[a];
  }

  async runBatch() {
    const action = this.batchAction()!;
    this.batchBusy.set(true);
    this.batchErr.set(null);
    try {
      const { batch, items } = await this.api.createBatch({ action, taskIds: this.selectedIds(), evidence: this.batchEvidence() });
      const failedItems = items.filter(i => i.status === 'failed').map(i => ({ taskNo: i.taskNo, reason: i.errorReason }));
      this.result.set({
        batchNo: batch.batchNo,
        total: batch.total,
        success: batch.successCount,
        failed: batch.failCount,
        failedItems,
        batchId: batch.id,
      });
      this.batchOpen.set(false);
      this.clearSelection();
      this.reload();
    } catch (e) {
      this.batchErr.set(e as ApiError);
    } finally {
      this.batchBusy.set(false);
    }
  }

  closeResult() { this.result.set(null); }

  pct(n: number, total: number): number { return total > 0 ? (n / total) * 100 : 0; }

  // ---- create ----
  openCreate() {
    this.form = { taskNo: 'RT-2025-' + Math.floor(1000 + Math.random() * 9000), policyNo: 'PA-' + Math.floor(10000 + Math.random() * 90000), customerName: '', product: PRODUCTS[0], renewalType: RENEWAL_TYPES[0], originalPremium: 1200, newPremium: 1380, regEvidence: '' };
    this.createErr.set(null);
    this.createOpen.set(true);
  }
  closeCreate() { this.createOpen.set(false); }

  async submitCreate() {
    this.createBusy.set(true);
    this.createErr.set(null);
    try {
      const t = await this.api.createTask(this.form);
      this.createOpen.set(false);
      await this.reload();
      this.activeId.set(t.id);
    } catch (e) {
      this.createErr.set(e as ApiError);
    } finally {
      this.createBusy.set(false);
    }
  }
}
