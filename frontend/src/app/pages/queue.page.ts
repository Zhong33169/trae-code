import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="max-w-[1600px] mx-auto p-6">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-slate-800">上线计划单队列</h2>
          <p class="text-sm text-slate-500 mt-1">按角色显示需要处理的计划单</p>
        </div>
        <div class="flex items-center gap-3">
          <button *ngIf="isCSM" (click)="openCreate()" class="px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
            ➕ 新建计划单
          </button>
          <button (click)="reload()" class="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm">
            🔄 刷新
          </button>
        </div>
      </div>

      <div class="grid grid-cols-6 gap-3 mb-6">
        <div (click)="focusStatus(todo.status)" class="col-span-2 p-4 rounded-xl bg-gradient-to-br from-primary to-blue-500 text-white shadow-md cursor-pointer hover:shadow-lg transition">
          <div class="text-xs opacity-80">{{ todo.label }}</div>
          <div class="text-3xl font-bold mt-1">{{ todo.count }}</div>
        </div>
        <div *ngFor="let s of statGrid" (click)="focusStatus(s.status)"
          class="p-4 rounded-xl bg-white border border-slate-200 shadow-sm cursor-pointer hover:border-primary transition">
          <div class="text-xs text-slate-500">{{ s.label }}</div>
          <div class="text-2xl font-bold mt-1" [ngClass]="statusColor(s.status)">{{ s.count }}</div>
        </div>
        <div (click)="focusStatus('')" class="p-4 rounded-xl bg-white border border-slate-200 shadow-sm cursor-pointer hover:border-primary transition">
          <div class="text-xs text-slate-500">我的总数</div>
          <div class="text-2xl font-bold mt-1 text-slate-800">{{ stats.total }}</div>
        </div>
      </div>

      <div class="grid grid-cols-12 gap-6">
        <div class="col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="p-4 border-b border-slate-100 space-y-3">
            <div class="flex flex-wrap items-center gap-3">
              <div class="flex-1 min-w-[200px] relative">
                <input [(ngModel)]="filters.keyword" (keyup.enter)="reload()" placeholder="🔍 搜索计划单编号/标题/客户..."
                  class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              </div>
              <select [(ngModel)]="filters.status" (change)="reload()" class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="">全部状态</option>
                <option *ngFor="let s of statuses" [value]="s.value">{{ s.label }}</option>
              </select>
              <select [(ngModel)]="filters.risk_level" (change)="reload()" class="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="">全部风险</option>
                <option *ngFor="let r of risks" [value]="r.value">{{ r.label }}</option>
              </select>
              <button (click)="resetFilters()" class="px-3 py-2 text-xs text-slate-500 hover:text-primary">重置</button>
            </div>
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" [(ngModel)]="selectAll" (change)="toggleAll()" class="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary">
                <span class="text-slate-600">全选</span>
                <span *ngIf="selected.length" class="text-xs text-primary font-semibold">(已选 {{ selected.length }} 项)</span>
              </label>
              <div *ngIf="selected.length" class="flex items-center gap-2">
                <span class="text-xs text-slate-500">批量操作：</span>
                <button *ngFor="let a of batchActions" (click)="doBatch(a.action)"
                  class="px-3 py-1.5 text-xs rounded-md font-medium transition"
                  [ngClass]="a.cls">
                  {{ a.label }}
                </button>
              </div>
            </div>
          </div>

          <div class="overflow-auto max-h-[560px]">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 sticky top-0 z-10">
                <tr class="text-left text-slate-500 text-xs uppercase">
                  <th class="px-4 py-3 w-10"></th>
                  <th class="px-4 py-3">编号 / 标题</th>
                  <th class="px-4 py-3">客户</th>
                  <th class="px-4 py-3">类型/风险</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">证据</th>
                  <th class="px-4 py-3">创建人</th>
                  <th class="px-4 py-3">更新时间</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of list" (click)="selectDetail(p)"
                  class="border-t border-slate-100 hover:bg-blue-50/30 cursor-pointer transition"
                  [ngClass]="{'bg-blue-50/50': selectedId === p.id}">
                  <td class="px-4 py-3" (click)="$event.stopPropagation()">
                    <input type="checkbox" [checked]="isSelected(p.id)" (change)="toggleItem(p.id)"
                      class="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary">
                  </td>
                  <td class="px-4 py-3">
                    <div class="text-xs font-mono text-slate-400">{{ p.plan_no }}</div>
                    <div class="font-medium text-slate-800 line-clamp-1">{{ p.title }}</div>
                  </td>
                  <td class="px-4 py-3 text-slate-700">{{ p.customer_name }}</td>
                  <td class="px-4 py-3">
                    <span class="inline-block text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 mr-1">{{ p.change_type }}</span>
                    <span class="text-xs font-medium" [ngClass]="riskBadge(p.risk_level)">{{ riskLabel(p.risk_level) }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="inline-block text-xs px-2.5 py-1 rounded-full font-medium" [ngClass]="statusBadge(p.status)">{{ p.status_label }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1 items-center flex-wrap">
                      <span *ngIf="p.evidences.REGISTRATION" title="登记证据" class="text-sm">✅</span>
                      <span *ngIf="!p.evidences.REGISTRATION" title="缺登记证据" class="text-sm opacity-30">⬜</span>
                      <span *ngIf="p.evidences.VERIFICATION" title="核验证据" class="text-sm">🔍</span>
                      <span *ngIf="!p.evidences.VERIFICATION && (p.status==='PENDING_REVIEW'||p.status==='PENDING_CONFIRM'||p.status==='COMPLETED')" title="缺核验证据" class="text-sm opacity-30">⬜</span>
                      <span *ngIf="p.evidences.ARCHIVAL" title="归档证据" class="text-sm">📦</span>
                      <span *ngIf="!p.evidences.ARCHIVAL && (p.status==='PENDING_CONFIRM'||p.status==='COMPLETED')" title="缺归档证据" class="text-sm opacity-30">⬜</span>
                    </div>
                    <div *ngIf="p.missing_labels?.length" class="mt-1 flex flex-wrap gap-1">
                      <span *ngFor="let ml of p.missing_labels" class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">缺{{ ml }}</span>
                    </div>
                    <div *ngIf="p.uploadable_evidence?.length" class="mt-1">
                      <button (click)="quickUpload(p, $event)" class="text-[10px] px-2 py-0.5 rounded bg-primary text-white hover:bg-blue-700">📎 补传证据</button>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-slate-600 text-xs">{{ p.creator_name }}</td>
                  <td class="px-4 py-3 text-xs text-slate-400">{{ p.updated_at }}</td>
                </tr>
                <tr *ngIf="!list.length">
                  <td colspan="8" class="px-4 py-16 text-center text-slate-400 text-sm">暂无数据</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="p-3 border-t border-slate-100 flex items-center justify-between text-sm">
            <span class="text-slate-500">共 {{ data.total }} 条</span>
            <div class="flex items-center gap-1">
              <button (click)="goPage(data.page - 1)" [disabled]="data.page <= 1" class="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">上一页</button>
              <span class="px-3 py-1 text-slate-600">{{ data.page }} / {{ pages }}</span>
              <button (click)="goPage(data.page + 1)" [disabled]="data.page >= pages" class="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">下一页</button>
            </div>
          </div>
        </div>

        <div class="col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <div class="font-semibold text-slate-800">📎 证据速览</div>
            <button *ngIf="detail" [routerLink]="['/plan', detail.id]" class="text-xs px-2 py-1 bg-primary text-white rounded hover:bg-blue-700">
              进入办理 →
            </button>
          </div>
          <div *ngIf="!detail" class="p-12 text-center text-slate-400 text-sm">
            👈 选择左队列中一条计划单，此处显示关键证据
          </div>
          <div *ngIf="detail" class="p-4 space-y-4 max-h-[640px] overflow-auto">
            <div>
              <div class="text-xs font-mono text-slate-400">{{ detail.plan_no }}</div>
              <div class="font-semibold text-slate-800">{{ detail.title }}</div>
              <div class="text-xs text-slate-500 mt-1">{{ detail.customer_name }} · {{ detail.plan_date }}</div>
              <div class="mt-2 flex items-center gap-2">
                <span class="text-xs px-2 py-0.5 rounded-full font-medium" [ngClass]="statusBadge(detail.status)">{{ detail.status_label }}</span>
                <span class="text-xs px-2 py-0.5 rounded-full" [ngClass]="riskBadge(detail.risk_level)">{{ riskLabel(detail.risk_level) }}</span>
                <span class="text-xs text-slate-400">v{{ detail.version }}</span>
              </div>
            </div>

            <div *ngIf="detail.reject_reason" class="p-3 rounded-lg bg-red-50 border border-red-200">
              <div class="text-xs font-semibold text-red-700 mb-1">⚠️ 驳回原因</div>
              <div class="text-xs text-red-600">{{ detail.reject_reason }}</div>
            </div>

            <div>
              <div class="text-xs font-semibold text-slate-600 mb-2">登记证据 (CSM提交)</div>
              <div *ngIf="evList('REGISTRATION').length === 0" class="text-xs text-slate-400 p-3 bg-slate-50 rounded">暂无登记证据</div>
              <div *ngFor="let e of evList('REGISTRATION')" class="p-3 mb-1 bg-blue-50/50 rounded border border-blue-100 flex items-center justify-between">
                <div>
                  <div class="text-sm text-slate-700">📄 {{ e.name }}</div>
                  <div class="text-xs text-slate-400">{{ e.uploader_name }} · {{ e.uploaded_at }}</div>
                </div>
              </div>
            </div>

            <div>
              <div class="text-xs font-semibold text-slate-600 mb-2">核验证据 (交付顾问)</div>
              <div *ngIf="evList('VERIFICATION').length === 0" class="text-xs text-slate-400 p-3 bg-slate-50 rounded">暂无核验证据</div>
              <div *ngFor="let e of evList('VERIFICATION')" class="p-3 mb-1 bg-purple-50/50 rounded border border-purple-100 flex items-center justify-between">
                <div>
                  <div class="text-sm text-slate-700">🔍 {{ e.name }}</div>
                  <div class="text-xs text-slate-400">{{ e.uploader_name }} · {{ e.uploaded_at }}</div>
                </div>
              </div>
            </div>

            <div>
              <div class="text-xs font-semibold text-slate-600 mb-2">归档证据 (负责人)</div>
              <div *ngIf="evList('ARCHIVAL').length === 0" class="text-xs text-slate-400 p-3 bg-slate-50 rounded">暂无归档证据</div>
              <div *ngFor="let e of evList('ARCHIVAL')" class="p-3 mb-1 bg-orange-50/50 rounded border border-orange-100 flex items-center justify-between">
                <div>
                  <div class="text-sm text-slate-700">📦 {{ e.name }}</div>
                  <div class="text-xs text-slate-400">{{ e.uploader_name }} · {{ e.uploaded_at }}</div>
                </div>
              </div>
            </div>

            <div>
              <div class="text-xs font-semibold text-slate-600 mb-2">流程轨迹</div>
              <div class="space-y-2">
                <div *ngFor="let t of detail.transitions" class="relative pl-6 pb-2 border-l-2 border-slate-100 last:border-0">
                  <div class="absolute -left-2 top-0 w-3 h-3 rounded-full bg-white border-2 border-primary"></div>
                  <div class="text-xs">
                    <span class="text-slate-500">{{ t.operated_at }}</span>
                    <span class="ml-2 font-medium text-slate-700">{{ t.operator_name }}</span>
                    <span class="ml-2 px-1.5 py-0.5 rounded text-xs" [ngClass]="transitionBadge(t.to_status)">{{ t.from_status }}→{{ t.to_status }}</span>
                  </div>
                  <div *ngIf="t.comment" class="text-xs text-slate-500 mt-1">💬 {{ t.comment }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="showCreate" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" (click)="showCreate = false">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" (click)="$event.stopPropagation()">
          <h3 class="text-lg font-bold mb-4">新建上线计划单</h3>
          <form class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs text-slate-600">客户名称 *</label>
                <input [(ngModel)]="form.customer_name" name="cn" class="w-full mt-1 px-3 py-2 border border-slate-200 rounded text-sm">
              </div>
              <div>
                <label class="text-xs text-slate-600">计划上线日期 *</label>
                <input type="date" [(ngModel)]="form.plan_date" name="pd" class="w-full mt-1 px-3 py-2 border border-slate-200 rounded text-sm">
              </div>
            </div>
            <div>
              <label class="text-xs text-slate-600">标题 *</label>
              <input [(ngModel)]="form.title" name="t" class="w-full mt-1 px-3 py-2 border border-slate-200 rounded text-sm">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs text-slate-600">变更类型 *</label>
                <select [(ngModel)]="form.change_type" name="ct" class="w-full mt-1 px-3 py-2 border border-slate-200 rounded text-sm bg-white">
                  <option>权限调整</option><option>系统升级</option><option>配置变更</option>
                  <option>集成对接</option><option>数据变更</option><option>参数调整</option>
                  <option>配置下发</option><option>系统切换</option><option>模型扩展</option>
                  <option>流程调整</option>
                </select>
              </div>
              <div>
                <label class="text-xs text-slate-600">风险等级 *</label>
                <select [(ngModel)]="form.risk_level" name="rl" class="w-full mt-1 px-3 py-2 border border-slate-200 rounded text-sm bg-white">
                  <option value="LOW">低风险</option><option value="MEDIUM">中风险</option><option value="HIGH">高风险</option>
                </select>
              </div>
            </div>
            <div>
              <label class="text-xs text-slate-600">变更描述</label>
              <textarea [(ngModel)]="form.description" name="desc" rows="3" class="w-full mt-1 px-3 py-2 border border-slate-200 rounded text-sm"></textarea>
            </div>
          </form>
          <div class="mt-5 flex justify-end gap-3">
            <button (click)="showCreate = false" class="px-4 py-2 border border-slate-200 rounded-lg text-sm">取消</button>
            <button (click)="submitCreate()" class="px-4 py-2 bg-primary text-white rounded-lg text-sm">创建</button>
          </div>
        </div>
      </div>

      <div *ngIf="showBatch" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" (click)="showBatch = false">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6" (click)="$event.stopPropagation()">
          <h3 class="text-lg font-bold mb-2">批量 {{ batchOperation?.label }}</h3>
          <div class="text-sm text-slate-500 mb-4">批次号：{{ batchResult?.batch_no || '生成中...' }} ｜ 共 {{ selected.length }} 项</div>

          <div *ngIf="!batchResult" class="space-y-3">
            <div *ngIf="batchOperation?.needComment">
              <label class="text-xs text-slate-600">备注（驳回必填）</label>
              <textarea [(ngModel)]="batchComment" rows="2" class="w-full mt-1 px-3 py-2 border border-slate-200 rounded text-sm"></textarea>
            </div>
            <div class="p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
              ⚠️ 操作将严格按角色权限、证据完备性校验，不符合条件的项会失败并保留在结果中。
            </div>
          </div>

          <div *ngIf="batchResult" class="space-y-3">
            <div class="grid grid-cols-3 gap-3 text-center">
              <div class="p-3 bg-slate-50 rounded-lg"><div class="text-xs text-slate-500">总数</div><div class="text-2xl font-bold">{{ batchResult.total }}</div></div>
              <div class="p-3 bg-green-50 rounded-lg"><div class="text-xs text-success-600">成功</div><div class="text-2xl font-bold text-success">{{ batchResult.success_count }}</div></div>
              <div class="p-3 bg-red-50 rounded-lg"><div class="text-xs text-danger">失败</div><div class="text-2xl font-bold text-danger">{{ batchResult.failed_count }}</div></div>
            </div>
            <div class="max-h-64 overflow-auto border border-slate-200 rounded-lg">
              <table class="w-full text-xs">
                <thead class="bg-slate-50 sticky top-0"><tr class="text-slate-500">
                  <th class="px-3 py-2 text-left">结果</th>
                  <th class="px-3 py-2 text-left">编号/标题</th>
                  <th class="px-3 py-2 text-left">错误</th>
                </tr></thead>
                <tbody>
                  <tr *ngFor="let it of batchResult.items" class="border-t border-slate-100">
                    <td class="px-3 py-2">
                      <span *ngIf="it.result==='SUCCESS'" class="text-success">✅ 成功</span>
                      <span *ngIf="it.result==='FAILED'" class="text-danger">❌ 失败</span>
                    </td>
                    <td class="px-3 py-2">
                      <div class="font-mono text-slate-400">{{ it.plan_no }}</div>
                      <div>{{ it.title }}</div>
                    </td>
                    <td class="px-3 py-2 text-danger max-w-xs truncate">{{ it.error_message || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div *ngIf="batchResult.failed_count > 0" class="p-3 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
              💡 失败项已保留，请在办理后点击「批次中心」查看详细并支持重试。
            </div>
          </div>

          <div class="mt-5 flex justify-end gap-3">
            <button (click)="closeBatch()" class="px-4 py-2 border border-slate-200 rounded-lg text-sm">关闭</button>
            <button *ngIf="!batchResult" (click)="confirmBatch()" class="px-4 py-2 bg-primary text-white rounded-lg text-sm">执行</button>
          </div>
        </div>
      </div>

      <div *ngIf="showQuickUpload" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" (click)="showQuickUpload = false">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" (click)="$event.stopPropagation()">
          <h3 class="text-lg font-bold mb-2">📎 补传证据</h3>
          <div class="text-sm text-slate-500 mb-3">{{ quickUploadPlan?.plan_no }} - {{ quickUploadPlan?.title }}</div>
          <div *ngFor="let ev of quickUploadTypes" class="mb-3 p-3 rounded-lg border border-slate-200">
            <div class="font-medium text-sm mb-2">{{ ev.label }} ({{ ev.type }})</div>
            <div class="grid grid-cols-2 gap-2">
              <input [(ngModel)]="quickUploadForm[ev.type].name" placeholder="文件名" class="px-3 py-1.5 border border-slate-200 rounded text-sm">
              <input [(ngModel)]="quickUploadForm[ev.type].url" placeholder="文件路径" class="px-3 py-1.5 border border-slate-200 rounded text-sm">
            </div>
          </div>
          <div class="mt-4 flex justify-end gap-3">
            <button (click)="showQuickUpload = false" class="px-4 py-2 border border-slate-200 rounded-lg text-sm">取消</button>
            <button (click)="doQuickUpload()" class="px-4 py-2 bg-primary text-white rounded-lg text-sm">上传</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class QueuePage implements OnInit, OnDestroy {
  filters: any = { status: '', risk_level: '', keyword: '', page: 1, size: 15 };
  data: any = { list: [], total: 0, page: 1, size: 15 };
  list: any[] = [];
  stats: any = { by_status: [], total: 0, todo: { count: 0, label: '', status: '' } };
  todo: any = { count: 0, label: '', status: '' };
  statGrid: any[] = [];
  statuses = [
    { value: 'DRAFT', label: '草稿' }, { value: 'PENDING_REVIEW', label: '待核验' },
    { value: 'PENDING_CONFIRM', label: '待确认' }, { value: 'COMPLETED', label: '已完成' },
    { value: 'REJECTED', label: '已驳回' }
  ];
  risks = [{ value: 'LOW', label: '低风险' }, { value: 'MEDIUM', label: '中风险' }, { value: 'HIGH', label: '高风险' }];

  selected: any[] = [];
  selectedId: number = 0;
  detail: any = null;
  selectAll = false;

  currentUser: any = null;
  batchActions: any[] = [];
  batchOperation: any = null;
  showBatch = false;
  batchComment = '';
  batchResult: any = null;

  showCreate = false;
  form: any = { customer_name: '', plan_date: '', title: '', change_type: '配置变更', risk_level: 'MEDIUM', description: '' };

  showQuickUpload = false;
  quickUploadPlan: any = null;
  quickUploadTypes: any[] = [];
  quickUploadForm: any = {};

  timer: any;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit() {
    try { this.currentUser = JSON.parse(localStorage.getItem('lp_user') || '{}'); } catch {}
    this.calcBatchActions();
    this.reload();
    this.timer = setInterval(() => this.softReload(), 10000);
  }
  ngOnDestroy() { if (this.timer) clearInterval(this.timer); }

  get isCSM() { return this.currentUser?.role === 'CSM'; }
  get isDelivery() { return this.currentUser?.role === 'DELIVERY'; }
  get isDirector() { return this.currentUser?.role === 'DIRECTOR'; }

  calcBatchActions() {
    const actions: any[] = [];
    if (this.isCSM) actions.push({ action: 'submit', label: '批量提交核验', needComment: false, cls: 'bg-primary text-white hover:bg-blue-700' });
    if (this.isDelivery) {
      actions.push({ action: 'verify_pass', label: '批量核验通过', needComment: false, cls: 'bg-success text-white hover:bg-green-700' });
      actions.push({ action: 'reject', label: '批量驳回', needComment: true, cls: 'bg-danger text-white hover:bg-red-700' });
    }
    if (this.isDirector) {
      actions.push({ action: 'confirm_pass', label: '批量确认归档', needComment: false, cls: 'bg-success text-white hover:bg-green-700' });
      actions.push({ action: 'reject', label: '批量驳回', needComment: true, cls: 'bg-danger text-white hover:bg-red-700' });
    }
    this.batchActions = actions;
  }

  async reload() {
    this.filters.page = 1;
    this.softReload();
    this.stats = await this.api.stats();
    this.todo = this.stats.todo;
    this.statGrid = this.stats.by_status.filter((s: any) => s.status !== this.todo.status);
  }
  async softReload() {
    this.data = await this.api.queue(this.filters);
    this.list = this.data.list;
    if (this.detail) {
      const still = this.list.find((p: any) => p.id === this.detail.id);
      if (still) this.selectDetail(still, true);
    }
  }

  get pages() { return Math.max(1, Math.ceil(this.data.total / this.data.size)); }
  goPage(n: number) { this.filters.page = n; this.softReload(); }
  resetFilters() { this.filters = { status: '', risk_level: '', keyword: '', page: 1, size: 15 }; this.reload(); }
  focusStatus(s: string) { this.filters.status = s; this.reload(); }

  async selectDetail(p: any, skipId = false) {
    if (!skipId) this.selectedId = p.id;
    try {
      const d = await this.api.planDetail(p.id);
      this.detail = d.plan;
    } catch {}
  }

  evList(t: string) { return this.detail?.evidences?.filter((e: any) => e.evidence_type === t) || []; }

  riskLabel(v: string) { return ({ LOW: '低风险', MEDIUM: '中风险', HIGH: '高风险' } as any)[v]; }
  riskBadge(v: string) { return ({
    LOW: 'text-green-600 bg-green-50', MEDIUM: 'text-yellow-600 bg-yellow-50', HIGH: 'text-red-600 bg-red-50'
  } as any)[v]; }
  statusColor(s: string) { return ({
    DRAFT: 'text-slate-600', PENDING_REVIEW: 'text-blue-600', PENDING_CONFIRM: 'text-purple-600',
    COMPLETED: 'text-green-600', REJECTED: 'text-red-600'
  } as any)[s]; }
  statusBadge(s: string) { return ({
    DRAFT: 'bg-slate-100 text-slate-700',
    PENDING_REVIEW: 'bg-blue-100 text-blue-700',
    PENDING_CONFIRM: 'bg-purple-100 text-purple-700',
    COMPLETED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700'
  } as any)[s]; }
  transitionBadge(s: string) { return this.statusBadge(s); }

  isSelected(id: number) { return this.selected.includes(id); }
  toggleItem(id: number) {
    const i = this.selected.indexOf(id);
    if (i >= 0) this.selected.splice(i, 1); else this.selected.push(id);
    this.selectAll = this.selected.length === this.list.length && this.list.length > 0;
  }
  toggleAll() {
    if (this.selectAll) this.selected = [];
    else this.selected = this.list.map(p => p.id);
    this.selectAll = !this.selectAll;
  }

  doBatch(action: string) {
    this.batchOperation = this.batchActions.find((a: any) => a.action === action);
    this.showBatch = true; this.batchResult = null; this.batchComment = '';
  }
  async confirmBatch() {
    try {
      const plan_versions: any = {};
      this.selected.forEach(id => {
        const p = this.list.find((x: any) => x.id === id);
        if (p) plan_versions[id] = p.version;
      });
      const res = await this.api.batchAction({
        plan_ids: [...this.selected],
        action: this.batchOperation.action,
        comment: this.batchComment,
        plan_versions
      });
      if (res.code === 0) {
        this.batchResult = res.data;
        (window as any).showToast?.(res.data.failed_count > 0 ? 'warning' : 'success',
          `批次${res.data.batch_no}`, `成功${res.data.success_count}项，失败${res.data.failed_count}项`);
      } else {
        (window as any).showToast?.('error', '批量操作失败', res.message);
      }
    } catch (e: any) {
      (window as any).showToast?.('error', '批量操作失败', e.error?.message || e.message);
    }
  }
  closeBatch() {
    this.showBatch = false; this.selected = []; this.selectAll = false;
    this.reload();
  }

  openCreate() {
    this.form = { customer_name: '', plan_date: new Date().toISOString().slice(0, 10), title: '', change_type: '配置变更', risk_level: 'MEDIUM', description: '' };
    this.showCreate = true;
  }
  async submitCreate() {
    try {
      const res = await this.api.createPlan(this.form);
      if (res.code === 0) {
        (window as any).showToast?.('success', '创建成功', res.data.plan_no);
        this.showCreate = false; this.reload();
      } else {
        (window as any).showToast?.('error', '创建失败', res.message);
      }
    } catch (e: any) {
      (window as any).showToast?.('error', '创建失败', e.error?.message || e.message);
    }
  }

  quickUpload(p: any, event: Event) {
    event.stopPropagation();
    this.quickUploadPlan = p;
    const LABELS: any = { REGISTRATION: '登记证据', VERIFICATION: '过程核验证据', ARCHIVAL: '复核归档证据' };
    this.quickUploadTypes = (p.uploadable_evidence || []).map((t: string) => ({ type: t, label: LABELS[t] || t }));
    this.quickUploadForm = {};
    for (const ev of this.quickUploadTypes) {
      this.quickUploadForm[ev.type] = { name: '', url: '' };
    }
    this.showQuickUpload = true;
  }

  async doQuickUpload() {
    let uploaded = 0;
    for (const ev of this.quickUploadTypes) {
      const form = this.quickUploadForm[ev.type];
      if (form.name && form.url) {
        try {
          const res = await this.api.uploadEvidence(this.quickUploadPlan.id, {
            evidence_type: ev.type,
            name: form.name,
            url: form.url,
            version: this.quickUploadPlan.version,
            source: 'queue'
          });
          if (res.code === 0) uploaded++;
        } catch {}
      }
    }
    this.showQuickUpload = false;
    if (uploaded > 0) {
      (window as any).showToast?.('success', '补传成功', `已上传 ${uploaded} 份证据`);
      this.reload();
    } else {
      (window as any).showToast?.('warning', '未上传', '请填写文件名和路径');
    }
  }
}
