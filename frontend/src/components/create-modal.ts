import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { User } from '../types';
import { api } from '../api';

@customElement('create-modal')
export class CreateModal extends LitElement {
  static styles = css``;

  @property({ type: Object }) currentUser: User | null = null;
  @state() form = {
    batch_no: '',
    product_name: '',
    production_line: 'A线-热厨',
    sample_time: new Date().toISOString().slice(0, 16).replace('T', ' '),
    sample_temperature: 4.0,
    storage_location: '冷藏库A-01柜',
  };

  updateField(field: string, e: Event) {
    (this.form as any)[field] = (e.target as HTMLInputElement | HTMLSelectElement).value;
    this.requestUpdate();
  }

  async submit() {
    if (!this.currentUser) return;
    await api.createSample({ ...this.form, operator: this.currentUser.name });
    this.dispatchEvent(new CustomEvent('created'));
  }

  render() {
    return html`
      <div class="modal-mask" @click=${(e: Event) => { if ((e.target as HTMLElement).classList.contains('modal-mask')) this.dispatchEvent(new CustomEvent('close')); }}>
        <div class="modal">
          <div class="modal-header">
            新建留样记录
            <button class="modal-close" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row"><label>批次号</label><input .value=${this.form.batch_no} @input=${(e: Event) => this.updateField('batch_no', e)} placeholder="如 PC2024060101" /></div>
            <div class="form-row"><label>产品名称</label><input .value=${this.form.product_name} @input=${(e: Event) => this.updateField('product_name', e)} placeholder="如 红烧排骨套餐" /></div>
            <div class="form-row"><label>生产线</label>
              <select .value=${this.form.production_line} @change=${(e: Event) => this.updateField('production_line', e)}>
                <option>A线-热厨</option><option>B线-素炒</option><option>C线-汤品</option><option>D线-冷荤</option>
              </select>
            </div>
            <div class="form-row"><label>留样时间</label><input .value=${this.form.sample_time} @input=${(e: Event) => this.updateField('sample_time', e)} placeholder="YYYY-MM-DD HH:mm:ss" /></div>
            <div class="form-row"><label>留样温度(℃)</label><input type="number" step="0.1" .value=${String(this.form.sample_temperature)} @input=${(e: Event) => this.updateField('sample_temperature', e)} /></div>
            <div class="form-row"><label>存放位置</label><input .value=${this.form.storage_location} @input=${(e: Event) => this.updateField('storage_location', e)} /></div>
            <div class="form-row"><label>登记员</label><input .value=${this.currentUser?.name || ''} disabled /></div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>取消</button>
            <button class="btn btn-primary" @click=${this.submit}>创建</button>
          </div>
        </div>
      </div>
    `;
  }
}
