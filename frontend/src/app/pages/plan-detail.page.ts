import { Component, OnInit, DoCheck } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-plan-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="max-w-[1400px] mx-auto p-6">
      <div class="mb-5 flex items-center gap-3">
        <a routerLink="/queue" class="text-slate-500 hover:text-primary">← 返回队列</a>
        <span class="text-slate-300">|</span>
        <a *ngIf="nav.prev" [routerLink]="['/plan', nav.prev.id]" class="text-xs text-slate-500 hover:text-primary">
          ⬅ {{ nav.prev.plan_no }}
        </a>
        <a *ngIf="nav.next" [routerLink]="['/plan', nav.next.id]" class="text-xs text-slate-500 hover:text-primary">
          {{ nav.next.plan_no }} ➡
        </a>
      </div>

      <div *ngIf="plan" class="grid grid-cols-12 gap-6">
        <div class="col-span-8 space-y-6">
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div class="flex items-start justify-between mb-4">
              <div>
                <div class="text-xs font-mono text-slate-400 mb-1">{{ plan.plan_no }}</div>
                <h2 class="text-xl font-bold text-slate-800">{{ plan.title }}</h2>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-3 py-1 rounded-full text-sm font-medium" [ngClass]="statusBadge(plan.status)">{{ plan.status_label }}</span>
                <span class="px-2 py-1 rounded text-xs font-mono text-slate-500 bg-slate-100">v{{ plan.version }}</span>
              </div>
            </div>
            <div class="grid grid-cols-4 gap-4 text-sm">
              <div><div class="text-slate-400 text-xs">客户</div><div class="font-medium mt-1">{{ plan.customer_name }}</div></div>
              <div><div class="text-slate-400 text-xs">变更类型</div><div class="font-medium mt-1">{{ plan.change_type }}</div></div>
              <div><div class="text-slate-400 text-xs">计划上线日期</div><div class="font-medium mt-1">{{ plan.plan_date }}</div></div>
              <div><div class="text-slate-400 text-xs">风险等级</div><div class="mt-1"><span class="text-xs font-medium px-2 py-0.5 rounded" [ngClass]="riskBadge(plan.risk_level)">{{ riskLabel(plan.risk_level) }}</span></div></div>
            </div>
            <div class="mt-4">
              <div class="text-slate-400 text-xs mb-1">变更描述</div>
              <div class="text-sm text-slate-700 leading-relaxed p-3 bg-slate-50 rounded">{{ plan.description || '-' }}</div>
            </div>
            <div class="mt-4 text-xs text-slate-400">
              创建人：{{ plan.creator_name }} · 创建于 {{ plan.created_at }} · 更新于 {{ plan.updated_at }}
            </div>
          </div>

          <div *ngIf="plan.reject_reason" class="p-4 bg-red-50 border border-red-200 rounded-xl">
            <div class="font-semibold text-red-700 mb-1">⚠️ 驳回原因</div>
            <div class="text-sm text-red-600">{{ plan.reject_reason }}</div>
          </div>

          <div *ngIf="canEdit" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-slate-800">✏️ 编辑基本信息</h3>
              <button (click)="toggleEdit()" class="text-xs text-primary">{{ editMode ? '取消' : '编辑' }}</button>
            </div>
            <div *ngIf="!editMode" class="text-sm text-slate-500">仅草稿/驳回状态、创建人本人可编辑</div>
            <form *ngIf="editMode" class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-xs text-slate-600">客户名称</label>
                  <input [(ngModel)]="editForm.customer_name" name="ecn" class="w-full mt-1 px-3 py-2 border border-slate-200 rounded text-sm">
                </div>
                <div>
                  <label class="text-xs text-slate-600">计划上线日期</label>
                  <input type="date" [(ngModel)]="editForm.plan_date" name="epd" class="w-full mt-1 px-3 py-2 border border-slate-200 rounded text-sm">
                </div>
              </div>
              <div>
                <label class="text-xs text-slate-600">标题</label>
                <input [(ngModel)]="editForm.title" name="et" class="w-full mt-1 px-3 py-2 border border-slate-200 rounded text-sm">
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-xs text-slate-600">变更类型</label>
                  <select [(ngModel)]="editForm.change_type" name="ect" class="w-full mt-1 px-3 py-2 border border-slate-200 rounded text-sm bg-white">
                    <option *ngFor="let t of ['权限调整','系统升级','配置变更','集成对接','数据变更','参数调整','配置下发','系统切换','模型扩展','流程调整']" [value]="t">{{ t }}</option>
                  </select>
                </div>
                <div>
                  <label class="text-xs text-slate-600">风险等级</label>
                  <select [(ngModel)]="editForm.risk_level" name="erl" class="w-full mt-1 px-3 py-2 border border-slate-200 rounded text-sm bg-white">
                    <option value="LOW">低风险</option><option value="MEDIUM">中风险</option><option value="HIGH">高风险</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="text-xs text-slate-600">描述</label>
                <textarea [(ngModel)]="editForm.description" name="ed" rows="3" class="w-full mt-1 px-3 py-2 border border-slate-200 rounded text-sm"></textarea>
              </div>
              <div class="flex justify-end gap-2">
                <button type="button" (click)="saveEdit()" class="px-4 py-2 bg-primary text-white rounded text-sm">保存（版本号+1）</button>
              </div>
            </form>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 class="font-bold text-slate-800 mb-4">📎 证据文件（按角色分类上传）</h3>
            <div class="space-y-4">
              <div *ngFor="let eg of evidenceGroups" class="border border-slate-200 rounded-lg overflow-hidden">
                <div class="px-4 py-3 flex items-center justify-between" [ngClass]="eg.bg">
                  <div class="flex items-center gap-3">
                    <span>{{ eg.icon }}</span>
                    <div>
                      <div class="font-semibold text-sm">{{ eg.label }}</div>
                      <div class="text-xs opacity-70">上传角色：{{ eg.roleLabel }}</div>
                    </div>
                  </div>
                  <button *ngIf="eg.canUpload && plan.status !== 'COMPLETED'" (click)="openUpload(eg.type)"
                    class="px-3 py-1.5 bg-white/80 hover:bg-white rounded-md text-xs font-medium">
                    上传
                  </button>
                </div>
                <div class="p-3">
                  <div *ngIf="evidenceList(eg.type).length === 0" class="text-xs text-slate-400 py-3 text-center">暂无证据</div>
                  <div *ngFor="let e of evidenceList(eg.type)" class="p-3 bg-slate-50 rounded mb-1.5 last:mb-0 flex items-center justify-between">
                    <div>
                      <div class="text-sm text-slate-700">{{ eg.icon }} {{ e.name }}</div>
                      <div class="text-xs text-slate-400">{{ e.uploader_name }} · {{ e.uploaded_at }}</div>
                    </div>
                    <span class="text-xs text-success font-medium">✅</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 class="font-bold text-slate-800 mb-4">📝 流程轨迹</h3>
            <div class="space-y-3">
              <div *ngFor="let t of plan.transitions; let i = index" class="relative pl-8 pb-4 border-l-2 border-slate-200 last:border-0">
                <div class="absolute -left-2 top-0 w-4 h-4 rounded-full bg-white border-4 border-primary"></div>
                <div class="text-xs">
                  <span class="text-slate-400">{{ t.operated_at }}</span>
                  <span class="ml-2 font-semibold text-slate-700">{{ t.operator_name }}</span>
                  <span class="ml-2 text-slate-400">({{ roleLabel(t.operator_role) }})</span>
                  <span class="ml-2 px-2 py-0.5 rounded text-xs" [ngClass]="statusBadge(t.to_status)">{{ t.from_status }} → {{ t.to_status }}</span>
                </div>
                <div *ngIf="t.comment" class="mt-2 p-2 rounded text-xs text-slate-600 bg-slate-50">💬 {{ t.comment }}</div>
              </div>
              <div *ngIf="plan.transitions.length === 0" class="text-xs text-slate-400 py-4 text-center">暂无流转记录</div>
            </div>
          </div>
        </div>

        <div class="col-span-4 space-y-6">
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sticky top-6">
            <h3 class="font-bold text-slate-800 mb-4">🎬 办理操作</h3>

            <div *ngIf="available_actions.length === 0" class="text-sm text-slate-500 p-4 bg-slate-50 rounded">
              当前状态下无可用操作
            </div>

            <div class="space-y-3">
              <div *ngFor="let a of available_actions" class="border border-slate-200 rounded-lg p-3">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-semibold text-sm">{{ a.label }}</span>
                  <span *ngIf="!a.role_match" class="text-xs text-danger">角色不匹配</span>
                  <span *ngIf="a.role_match && a.missing_evidences?.length" class="text-xs text-warning">证据不足</span>
                  <span *ngIf="a.allowed" class="text-xs text-success">可执行</span>
                </div>
                <div *ngIf="a.reason" class="text-xs text-slate-500 mb-2">{{ a.reason }}</div>
                <div *ngIf="a.missing_evidences?.length" class="text-xs text-warning mb-2">
                  📎 缺少证据：{{ a.missing_labels?.join('、') }}
                </div>
                <textarea *ngIf="a.action === 'reject'" [(ngModel)]="comments[a.action]"
                  rows="2" placeholder="驳回原因（必填）"
                  class="w-full mb-2 px-2 py-1 border border-slate-200 rounded text-xs"></textarea>
                <button (click)="doAction(a)"
                  [disabled]="!a.allowed"
                  class="w-full py-2 rounded-md text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                  [ngClass]="btnClass(a.action)">
                  {{ a.label }}
                </button>
              </div>
            </div>

            <div class="mt-6 pt-4 border-t border-slate-100 space-y-2">
              <button [routerLink]="['/plan', plan.id, 'audit']" (click)="showAudit=!showAudit; $event.preventDefault()"
                class="w-full py-2 text-xs text-slate-500 hover:text-primary">
                🔍 查看审计日志
              </button>
            </div>

            <div *ngIf="showAudit" class="mt-4 pt-4 border-t border-slate-100">
              <div class="text-xs font-semibold text-slate-600 mb-2">审计日志</div>
              <div class="max-h-60 overflow-auto space-y-1.5">
                <div *ngFor="let a of auditLogs" class="text-xs p-2 bg-slate-50 rounded">
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-slate-700">{{ a.action }}</span>
                    <span class="text-slate-400">{{ a.created_at.slice(0, 19) }}</span>
                  </div>
                  <div *ngIf="a.detail" class="mt-1 text-slate-500 truncate">{{ a.detail }}</div>
                </div>
                <div *ngIf="!auditLogs.length" class="text-xs text-slate-400 text-center py-3">暂无</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="showUpload" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" (click)="showUpload = null">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" (click)="$event.stopPropagation()">
          <h3 class="text-lg font-bold mb-4">上传 {{ uploadTypeLabel }}</h3>
          <div class="space-y-3">
            <div>
              <label class="text-xs text-slate-600">文件名</label>
              <input [(ngModel)]="uploadForm.name" class="w-full mt-1 px-3 py-2 border border-slate-200 rounded text-sm">
            </div>
            <div>
              <label class="text-xs text-slate-600">证据链接/地址</label>
              <input [(ngModel)]="uploadForm.url" placeholder="/ev/xxx.pdf 或 https://..." class="w-full mt-1 px-3 py-2 border border-slate-200 rounded text-sm">
            </div>
            <div class="p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
              💡 演示环境：仅记录证据元数据，文件可填写任意地址。上传后计划单版本号 +1。
            </div>
          </div>
          <div class="mt-5 flex justify-end gap-2">
            <button (click)="showUpload = null" class="px-4 py-2 border border-slate-200 rounded text-sm">取消</button>
            <button (click)="submitUpload()" class="px-4 py-2 bg-primary text-white rounded text-sm">上传</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class PlanDetailPage implements OnInit, DoCheck {
  planId = 0;
  plan: any = null;
  available_actions: any[] = [];
  nav: any = { prev: null, next: null };
  currentUser: any = null;
  comments: any = {};
  editMode = false;
  editForm: any = {};
  showAudit = false;
  auditLogs: any[] = [];

  showUpload: string | null = null;
  uploadForm: any = { name: '', url: '' };

  constructor(private route: ActivatedRoute, private api: ApiService, private router: Router) {}

  get canEdit() {
    return this.plan && (this.plan.status === 'DRAFT' || this.plan.status === 'REJECTED')
      && this.plan.created_by === this.currentUser?.id;
  }

  evidenceGroups: any[] = [
    { type: 'REGISTRATION', label: '登记证据', role: 'CSM', roleLabel: '客户成功经理', icon: '📄', bg: 'bg-blue-50' },
    { type: 'VERIFICATION', label: '过程核验证据', role: 'DELIVERY', roleLabel: '交付顾问', icon: '🔍', bg: 'bg-purple-50' },
    { type: 'ARCHIVAL', label: '复核归档证据', role: 'DIRECTOR', roleLabel: '客户成功负责人', icon: '📦', bg: 'bg-orange-50' }
  ];

  ngOnInit() {
    try { this.currentUser = JSON.parse(localStorage.getItem('lp_user') || '{}'); } catch {}
    this.route.params.subscribe(async p => {
      this.planId = Number(p['id']);
      await this.load();
    });
    this.evidenceGroups.forEach(g => g.canUpload = g.role === this.currentUser?.role);
  }

  async load() {
    const d = await this.api.planDetail(this.planId);
    this.plan = d.plan;
    this.available_actions = d.available_actions;
    this.nav = d.nav;
    this.editForm = {
      customer_name: this.plan.customer_name,
      plan_date: this.plan.plan_date,
      title: this.plan.title,
      change_type: this.plan.change_type,
      risk_level: this.plan.risk_level,
      description: this.plan.description
    };
  }

  evidenceList(type: string) { return this.plan?.evidences?.filter((e: any) => e.evidence_type === type) || []; }

  riskLabel(v: string) { return ({ LOW: '低风险', MEDIUM: '中风险', HIGH: '高风险' } as any)[v]; }
  riskBadge(v: string) { return ({
    LOW: 'text-green-700 bg-green-50', MEDIUM: 'text-yellow-700 bg-yellow-50', HIGH: 'text-red-700 bg-red-50'
  } as any)[v]; }
  statusBadge(s: string) { return ({
    DRAFT: 'bg-slate-100 text-slate-700', PENDING_REVIEW: 'bg-blue-100 text-blue-700',
    PENDING_CONFIRM: 'bg-purple-100 text-purple-700', COMPLETED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700'
  } as any)[s]; }
  roleLabel(r: string) { return ({ CSM: '客户成功经理', DELIVERY: '交付顾问', DIRECTOR: '客户成功负责人' } as any)[r]; }
  evNames(arr: string[]) { return arr.map((t: string) => ({ REGISTRATION: '登记证据', VERIFICATION: '核验证据', ARCHIVAL: '归档证据' } as any)[t]); }
  get uploadTypeLabel() { return ({ REGISTRATION: '登记证据', VERIFICATION: '核验证据', ARCHIVAL: '归档证据' } as any)[this.showUpload || '']; }

  btnClass(action: string) {
    const c: any = {
      submit: 'bg-blue-600 hover:bg-blue-700 text-white',
      resubmit: 'bg-blue-600 hover:bg-blue-700 text-white',
      verify_pass: 'bg-green-600 hover:bg-green-700 text-white',
      confirm_pass: 'bg-green-600 hover:bg-green-700 text-white',
      reject: 'bg-red-600 hover:bg-red-700 text-white'
    };
    return c[action] || 'bg-slate-700 hover:bg-slate-800 text-white';
  }

  toggleEdit() { this.editMode = !this.editMode; }

  async saveEdit() {
    try {
      const res = await this.api.editPlan(this.planId, { ...this.editForm, version: this.plan.version });
      if (res.code === 0) {
        (window as any).showToast?.('success', '保存成功', `版本已更新至 v${res.data.version}`);
        await this.load();
        this.editMode = false;
      } else {
        (window as any).showToast?.(this.codeLevel(res.code), '保存失败', res.message);
      }
    } catch (e: any) {
      (window as any).showToast?.('error', '保存失败', e.error?.message || e.message);
    }
  }

  async doAction(a: any) {
    try {
      const res = await this.api.planAction(this.planId, {
        action: a.action,
        comment: this.comments[a.action] || '',
        version: this.plan.version
      });
      if (res.code === 0) {
        (window as any).showToast?.('success', a.label + '成功', res.message || '');
        await this.load();
        this.comments[a.action] = '';
      } else {
        (window as any).showToast?.(this.codeLevel(res.code), '操作失败', res.message);
      }
    } catch (e: any) {
      const msg = e.error?.message || e.message;
      const level = e.status === 409 ? 'warning' : 'error';
      (window as any).showToast?.(level, '操作失败', msg);
    }
  }

  openUpload(type: string) {
    this.showUpload = type;
    this.uploadForm = { name: type + '_' + Date.now() + '.pdf', url: '/ev/' + this.planId + '_' + type + '_' + Date.now() + '.pdf' };
  }

  async submitUpload() {
    try {
      const res = await this.api.uploadEvidence(this.planId, {
        evidence_type: this.showUpload,
        name: this.uploadForm.name,
        url: this.uploadForm.url,
        version: this.plan.version
      });
      if (res.code === 0) {
        (window as any).showToast?.('success', '上传成功', '计划单版本号已递增');
        await this.load();
        this.showUpload = null;
      } else {
        (window as any).showToast?.(this.codeLevel(res.code), '上传失败', res.message);
      }
    } catch (e: any) {
      (window as any).showToast?.('error', '上传失败', e.error?.message || e.message);
    }
  }

  async ngDoCheck() {
    if (this.showAudit && !this.auditLoaded) {
      this.auditLoaded = true;
      try { this.auditLogs = await this.api.planAudit(this.planId); } catch {}
    }
    if (!this.showAudit) this.auditLoaded = false;
  }
  auditLoaded = false;

  codeLevel(code: number | string) {
    if (String(code) === 'OLD_VERSION' || code === 409) return 'warning';
    if (String(code) === 'MISSING_EVIDENCE') return 'warning';
    return 'error';
  }
}
