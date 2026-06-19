import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { api } from './api';
import type {
  SampleRecord,
  SampleStatusKey,
  User,
  UserRole,
  SampleEvidence,
  SampleAppeal,
  OperationLog,
  TemperatureRecord,
} from './types';
import { STATUS_LABELS, STATUS_GROUP_LABELS, ROLE_LABELS } from './types';
import './components/sample-detail';
import './components/create-modal';
import './components/submit-modal';
import './components/qc-review-modal';
import './components/manager-review-modal';
import './components/appeal-modal';
import './components/appeal-review-modal';

@customElement('sample-app')
export class SampleApp extends LitElement {
  static styles = css`
    :host { display: block; min-height: 100vh; }
    .app-header {
      background: #fff;
      border-bottom: 1px solid var(--border);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 1px 2px rgba(0,0,0,.04);
    }
    .app-title { font-size: 17px; font-weight: 700; color: var(--text); }
    .app-subtitle { font-size: 12px; color: var(--text-secondary); }
    .role-switcher {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    select {
      padding: 5px 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      font-size: 13px;
      font-family: inherit;
    }
    .app-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px 24px 48px;
    }
    .stats-row {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    @media (max-width: 900px) {
      .stats-row { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 600px) {
      .stats-row { grid-template-columns: repeat(2, 1fr); }
    }
    .list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .empty {
      text-align: center;
      padding: 48px 16px;
      color: var(--text-secondary);
      font-size: 13px;
    }
  `;

  @state() users: User[] = [];
  @state() currentUser: User | null = null;
  @state() stats: Record<string, number> = { pending: 0, processing: 0, appeal: 0, completed: 0, rejected: 0, total: 0 };
  @state() activeTab: SampleStatusKey = 'pending';
  @state() samples: SampleRecord[] = [];
  @state() selectedId: string | null = null;
  @state() detail: {
    record: SampleRecord;
    evidences: SampleEvidence[];
    appeals: SampleAppeal[];
    logs: OperationLog[];
    temperatures: TemperatureRecord[];
  } | null = null;

  @state() showCreate = false;
  @state() showSubmit = false;
  @state() showQcReview = false;
  @state() showManagerReview = false;
  @state() showAppeal = false;
  @state() showAppealReview = false;

  async firstUpdated() {
    this.users = await api.users();
    this.currentUser = this.users.find(u => u.role === 'clerk') || null;
    await this.refresh();
  }

  async refresh() {
    this.stats = await api.stats();
    await this.loadList();
    if (this.selectedId) await this.loadDetail();
  }

  async loadList() {
    this.samples = await api.listSamples(this.activeTab);
  }

  async loadDetail() {
    if (!this.selectedId) return;
    this.detail = await api.getSample(this.selectedId);
  }

  handleRoleChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    this.currentUser = this.users.find(u => u.id === val) || null;
    this.loadList();
  }

  switchTab(tab: SampleStatusKey) {
    this.activeTab = tab;
    this.loadList();
  }

  openDetail(id: string) {
    this.selectedId = id;
    this.loadDetail();
  }

  closeDetail() {
    this.selectedId = null;
    this.detail = null;
  }

  renderStats() {
    const cards: { key: string; label: string; cls: string; num: number }[] = [
      { key: 'total', label: '总数', cls: 'gray', num: this.stats.total || 0 },
      { key: 'pending', label: STATUS_GROUP_LABELS.pending, cls: 'blue', num: this.stats.pending || 0 },
      { key: 'processing', label: STATUS_GROUP_LABELS.processing, cls: 'orange', num: this.stats.processing || 0 },
      { key: 'appeal', label: STATUS_GROUP_LABELS.appeal, cls: 'purple', num: this.stats.appeal || 0 },
      { key: 'completed', label: STATUS_GROUP_LABELS.completed, cls: 'green', num: this.stats.completed || 0 },
      { key: 'rejected', label: STATUS_GROUP_LABELS.rejected, cls: 'red', num: this.stats.rejected || 0 },
    ];
    return html`
      <div class="stats-row">
        ${cards.map(c => html`
          <div class="stat-card ${c.cls}">
            <span class="stat-num">${c.num}</span>
            <span class="stat-label">${c.label}</span>
          </div>
        `)}
      </div>
    `;
  }

  renderTabs() {
    const tabs: { key: SampleStatusKey; num: number }[] = [
      { key: 'pending', num: this.stats.pending || 0 },
      { key: 'processing', num: this.stats.processing || 0 },
      { key: 'appeal', num: this.stats.appeal || 0 },
      { key: 'completed', num: this.stats.completed || 0 },
      { key: 'rejected', num: this.stats.rejected || 0 },
    ];
    return html`
      <div class="tab-bar">
        ${tabs.map(t => html`
          <div
            class="tab-item ${this.activeTab === t.key ? 'active' : ''}"
            @click=${() => this.switchTab(t.key)}
          >
            ${STATUS_GROUP_LABELS[t.key]}
            <span class="tab-count">${t.num}</span>
          </div>
        `)}
        <div style="flex:1"></div>
        <div style="padding:8px 0">
          <button class="btn btn-primary btn-sm" @click=${() => { this.showCreate = true; }}>
            + 新建留样记录
          </button>
        </div>
      </div>
    `;
  }

  renderTable() {
    if (this.samples.length === 0) {
      return html`<div class="card empty">此队列为空</div>`;
    }
    return html`
      <div class="card" style="padding:0; overflow:hidden">
        <table class="table">
          <thead>
            <tr>
              <th>记录编号</th>
              <th>产品名称</th>
              <th>批次号</th>
              <th>生产线</th>
              <th>留样温度</th>
              <th>当前处理人</th>
              <th>状态</th>
              <th>更新时间</th>
              <th>版本</th>
            </tr>
          </thead>
          <tbody>
            ${this.samples.map(s => html`
              <tr @click=${() => this.openDetail(s.id)}>
                <td style="font-family: monospace">${s.record_no}</td>
                <td><strong>${s.product_name}</strong></td>
                <td style="font-family: monospace; color: var(--text-secondary)">${s.batch_no}</td>
                <td>${s.production_line}</td>
                <td>${s.sample_temperature.toFixed(1)}℃</td>
                <td>${s.current_handler} <span class="tag">${ROLE_LABELS[s.current_role]}</span></td>
                <td><span class="badge ${STATUS_LABELS[s.status].cls}">${STATUS_LABELS[s.status].label}</span></td>
                <td class="small muted">${s.updated_at.replace('T', ' ').slice(0, 16)}</td>
                <td class="small muted">v${s.version}</td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  onAction(action: string) {
    if (!this.currentUser) return;
    if (action === 'submit') this.showSubmit = true;
    else if (action === 'qc-review') this.showQcReview = true;
    else if (action === 'manager-review') this.showManagerReview = true;
    else if (action === 'appeal') this.showAppeal = true;
    else if (action === 'appeal-review') this.showAppealReview = true;
  }

  render() {
    return html`
      <header class="app-header">
        <div>
          <div class="app-title">🏭 中央厨房留样记录异常申诉系统</div>
          <div class="app-subtitle">食品留样 · 温度记录 · 异常处置 · 申诉复核同链路</div>
        </div>
        <div class="role-switcher">
          <span class="muted">当前身份：</span>
          <select .value=${this.currentUser?.id || ''} @change=${this.handleRoleChange}>
            ${this.users.map(u => html`
              <option .value=${u.id}>${u.name} (${ROLE_LABELS[u.role]})</option>
            `)}
          </select>
        </div>
      </header>

      <div class="app-content">
        ${this.renderStats()}
        ${this.renderTabs()}
        ${this.renderTable()}
      </div>

      ${this.selectedId && this.detail ? html`
        <sample-detail
          .record=${this.detail.record}
          .evidences=${this.detail.evidences}
          .appeals=${this.detail.appeals}
          .logs=${this.detail.logs}
          .temperatures=${this.detail.temperatures}
          .currentUser=${this.currentUser}
          @close=${this.closeDetail}
          @action=${(e: CustomEvent) => this.onAction(e.detail)}
        ></sample-detail>
      ` : ''}

      ${this.showCreate ? html`
        <create-modal
          .currentUser=${this.currentUser}
          @close=${() => { this.showCreate = false; }}
          @created=${async () => { this.showCreate = false; await this.refresh(); }}
        ></create-modal>
      ` : ''}

      ${this.showSubmit && this.detail ? html`
        <submit-modal
          .record=${this.detail.record}
          .currentUser=${this.currentUser}
          .existingEvidences=${this.detail.evidences}
          @close=${() => { this.showSubmit = false; }}
          @submitted=${async () => { this.showSubmit = false; await this.refresh(); }}
        ></submit-modal>
      ` : ''}

      ${this.showQcReview && this.detail ? html`
        <qc-review-modal
          .record=${this.detail.record}
          .currentUser=${this.currentUser}
          @close=${() => { this.showQcReview = false; }}
          @submitted=${async () => { this.showQcReview = false; await this.refresh(); }}
        ></qc-review-modal>
      ` : ''}

      ${this.showManagerReview && this.detail ? html`
        <manager-review-modal
          .record=${this.detail.record}
          .currentUser=${this.currentUser}
          @close=${() => { this.showManagerReview = false; }}
          @submitted=${async () => { this.showManagerReview = false; await this.refresh(); }}
        ></manager-review-modal>
      ` : ''}

      ${this.showAppeal && this.detail ? html`
        <appeal-modal
          .record=${this.detail.record}
          .currentUser=${this.currentUser}
          @close=${() => { this.showAppeal = false; }}
          @submitted=${async () => { this.showAppeal = false; await this.refresh(); }}
        ></appeal-modal>
      ` : ''}

      ${this.showAppealReview && this.detail ? html`
        <appeal-review-modal
          .record=${this.detail.record}
          .currentUser=${this.currentUser}
          @close=${() => { this.showAppealReview = false; }}
          @submitted=${async () => { this.showAppealReview = false; await this.refresh(); }}
        ></appeal-review-modal>
      ` : ''}
    `;
  }
}
