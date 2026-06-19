import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { SampleRecord, User, SampleEvidence } from '../types';
import { api } from '../api';

@customElement('submit-modal')
export class SubmitModal extends LitElement {
  static styles = css`
    .ev-list { display: grid; gap: 6px; }
    .ev-row { display: grid; grid-template-columns: 100px 1fr auto; gap: 8px; align-items: center; }
    .ev-row input { padding: 5px 8px; border: 1px solid var(--border); border-radius: 4px; font-size: 13px; width: 100%; }
    .mini-btn { padding: 3px 8px; font-size: 12px; border: 1px solid var(--border); border-radius: 4px; cursor: pointer; background: #fff; }
    .hint { font-size: 12px; color: var(--text-secondary); margin: 4px 0 10px; }
    .existing-ev { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
    .existing-tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: #f5f5f5; border: 1px solid var(--border); border-radius: 4px; font-size: 12px; color: var(--text-secondary); }
  `;

  @property({ type: Object }) record!: SampleRecord;
  @property({ type: Object }) currentUser: User | null = null;
  @property({ type: Array }) existingEvidences: SampleEvidence[] = [];
  @state() errors: string[] = [];
  @state() newEvidences: Omit<SampleEvidence, 'id' | 'sample_id' | 'uploaded_at'>[] = [];

  get isMissing() {
    return this.record.status === 'evidence_missing';
  }

  addEvidence() {
    this.newEvidences = [...this.newEvidences, { type: 'photo', name: '', url: '/mock/ev/new-' + Date.now() + '.jpg' }];
  }

  removeEvidence(i: number) {
    this.newEvidences = this.newEvidences.filter((_, idx) => idx !== i);
  }

  updateEv(i: number, field: string, val: string) {
    const arr = [...this.newEvidences];
    (arr[i] as any)[field] = val;
    this.newEvidences = arr;
  }

  async submit() {
    if (!this.currentUser) return;
    const emptyName = this.newEvidences.some(e => !e.name.trim());
    if (emptyName) {
      this.errors = ['证据文件名不能为空，请为每项证据填写文件名'];
      return;
    }
    const res = await api.submitForReview(
      this.record.id, this.currentUser.name, this.currentUser.role, this.record.version, this.newEvidences
    );
    if (!res.ok) {
      this.errors = (res.errors || []).map((e: any) => e.message);
      return;
    }
    this.dispatchEvent(new CustomEvent('submitted'));
  }

  render() {
    const existingCount = this.existingEvidences.length;
    const newValidCount = this.newEvidences.filter(e => e.name.trim()).length;
    const combinedTotal = existingCount + newValidCount;
    const typeIcon: Record<string, string> = { photo: '🖼️', temperature: '🌡️', document: '📄', video: '🎥', other: '📎' };

    return html`
      <div class="modal-mask" @click=${(e: Event) => { if ((e.target as HTMLElement).classList.contains('modal-mask')) this.dispatchEvent(new CustomEvent('close')); }}>
        <div class="modal">
          <div class="modal-header">
            ${this.isMissing ? '补正证据并重新提交' : '提交品控审核'}
            <button class="modal-close" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row"><label>记录编号</label><input .value=${this.record.record_no} disabled /></div>
            <div class="form-row"><label>产品名称</label><input .value=${this.record.product_name} disabled /></div>
            <div class="form-row"><label>提交人</label><input .value=${this.currentUser?.name || ''} disabled /></div>
            <div class="form-row"><label>当前版本</label><input .value=${'v' + this.record.version} disabled /></div>
            <div class="form-row"><label>当前状态</label><input .value=${this.record.status} disabled /></div>

            <div style="margin-top:12px">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">
                <strong>证据材料</strong>
                <button class="btn btn-sm" @click=${this.addEvidence}>+ 添加新证据</button>
              </div>

              ${existingCount > 0 ? html`
                <div style="margin-bottom:8px">
                  <div class="small muted" style="margin-bottom:4px">已有证据 (${existingCount} 项)：</div>
                  <div class="existing-ev">
                    ${this.existingEvidences.map(e => html`
                      <span class="existing-tag">${typeIcon[e.type] || '📎'} ${e.name}</span>
                    `)}
                  </div>
                </div>
              ` : ''}

              <div class="hint">
                ${this.isMissing
                  ? html`补正需补充至少 1 项新证据，补正后总数须大于原 ${this.record.evidence_count} 项。当前：已有 ${existingCount} 项 + 新增 ${newValidCount} 项 = ${combinedTotal} 项`
                  : html`首次提交至少需要 2 项证据（必须包含留样照片 + 温度记录）。当前：已有 ${existingCount} 项 + 新增 ${newValidCount} 项 = ${combinedTotal} 项`
                }
              </div>

              <div style="margin-bottom:4px; font-size:13px; font-weight:500">新增证据：</div>
              <div class="ev-list">
                ${this.newEvidences.map((ev, i) => html`
                  <div class="ev-row">
                    <select .value=${ev.type} @change=${(e: Event) => this.updateEv(i, 'type', (e.target as HTMLSelectElement).value)}>
                      <option value="photo">照片</option>
                      <option value="temperature">温度记录</option>
                      <option value="document">文档</option>
                      <option value="video">视频</option>
                    </select>
                    <input placeholder="文件名，如 留样复测照片.jpg" .value=${ev.name} @input=${(e: Event) => this.updateEv(i, 'name', (e.target as HTMLInputElement).value)} />
                    <button class="mini-btn" style="color:var(--danger)" @click=${() => this.removeEvidence(i)}>删除</button>
                  </div>
                `)}
                ${this.newEvidences.length === 0 ? html`<div class="hint">暂未添加新证据，点击上方「添加新证据」按钮</div>` : ''}
              </div>
            </div>

            ${this.errors.length > 0 ? html`
              <div style="margin-top:12px; padding:10px; background:#fff1f0; border:1px solid #ffa39e; border-radius:6px;">
                <div style="color: var(--danger); font-weight:600; margin-bottom:4px">提交失败</div>
                ${this.errors.map(m => html`<div class="error-text">• ${m}</div>`)}
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>取消</button>
            <button class="btn btn-primary" @click=${this.submit}>提交</button>
          </div>
        </div>
      </div>
    `;
  }
}
