import { LitElement, html, css } from 'lit';
import { api, STATUS_LABELS } from '../api.js';

export class TicketCreate extends LitElement {
  static properties = {
    currentUser: { type: Object },
    form: { type: Object },
    errors: { type: Object },
  };

  static styles = css`
    :host { display: block; }
    .overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      z-index: 500; display: flex; align-items: center; justify-content: center;
    }
    .modal {
      background: white; border-radius: 12px; width: 90%; max-width: 600px;
      max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 30px rgba(0,0,0,0.2);
    }
    .modal-header {
      padding: 16px 24px; border-bottom: 1px solid #ebeef5;
      display: flex; align-items: center; justify-content: space-between;
    }
    .modal-header h2 { font-size: 16px; margin: 0; }
    .close-btn {
      background: none; border: none; font-size: 20px; cursor: pointer;
      color: #909399; padding: 4px 8px; border-radius: 4px;
    }
    .close-btn:hover { background: #f0f2f5; }
    .modal-body { padding: 20px 24px; }
    .form-row { margin-bottom: 16px; }
    .form-row label { display: block; font-size: 13px; color: #606266; margin-bottom: 4px; font-weight: 500; }
    .form-row label .required { color: #f56c6c; }
    .form-row input, .form-row select {
      width: 100%; padding: 8px 12px; border: 1px solid #dcdfe6; border-radius: 6px;
      font-size: 13px;
    }
    .form-row .error { color: #f56c6c; font-size: 12px; margin-top: 4px; }
    .form-actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 12px; border-top: 1px solid #ebeef5; }
    .btn {
      padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer;
      font-size: 13px; font-weight: 500; transition: all 0.2s;
    }
    .btn-primary { background: #1a5c2a; color: white; }
    .btn-primary:hover { background: #2d8a4e; }
    .btn-plain { background: #f0f2f5; color: #606266; border: 1px solid #dcdfe6; }
  `;

  constructor() {
    super();
    this.form = { pen_id: '', animal_type: '生猪', animal_count: '', inspector_name: '', inspection_date: '' };
    this.errors = {};
  }

  _validate() {
    const e = {};
    if (!this.form.pen_id) e.pen_id = '栏舍编号必填';
    if (!this.form.animal_type) e.animal_type = '动物类型必填';
    if (!this.form.animal_count || this.form.animal_count <= 0) e.animal_count = '数量必须大于0';
    if (!this.form.inspector_name) e.inspector_name = '巡检员姓名必填';
    if (!this.form.inspection_date) e.inspection_date = '巡检日期必填';
    this.errors = e;
    return Object.keys(e).length === 0;
  }

  async _submit() {
    if (!this._validate()) return;
    if (!this.currentUser) {
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: '请先登录', type: 'error' } }));
      return;
    }
    try {
      await api.createTicket({
        ...this.form,
        animal_count: parseInt(this.form.animal_count),
        created_by: this.currentUser.id,
      });
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: '创建成功', type: 'success' } }));
      this.dispatchEvent(new CustomEvent('created'));
    } catch (e) {
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: e.message, type: 'error' } }));
    }
  }

  render() {
    return html`
      <div class="overlay" @click=${(e) => { if (e.target === e.currentTarget) this.dispatchEvent(new CustomEvent('close')); }}>
        <div class="modal">
          <div class="modal-header">
            <h2>➕ 新建养殖巡检单</h2>
            <button class="close-btn" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <label>栏舍编号 <span class="required">*</span></label>
              <input type="text" placeholder="如: A1, B2"
                .value=${this.form.pen_id}
                @input=${(e) => { this.form.pen_id = e.target.value; }} />
              ${this.errors.pen_id ? html`<div class="error">${this.errors.pen_id}</div>` : ''}
            </div>
            <div class="form-row">
              <label>动物类型 <span class="required">*</span></label>
              <select .value=${this.form.animal_type} @change=${(e) => { this.form.animal_type = e.target.value; }}>
                <option value="生猪">生猪</option>
                <option value="肉牛">肉牛</option>
                <option value="山羊">山羊</option>
                <option value="绵羊">绵羊</option>
                <option value="蛋鸡">蛋鸡</option>
                <option value="肉鸡">肉鸡</option>
              </select>
            </div>
            <div class="form-row">
              <label>数量 <span class="required">*</span></label>
              <input type="number" placeholder="动物数量"
                .value=${this.form.animal_count}
                @input=${(e) => { this.form.animal_count = e.target.value; }} />
              ${this.errors.animal_count ? html`<div class="error">${this.errors.animal_count}</div>` : ''}
            </div>
            <div class="form-row">
              <label>巡检员 <span class="required">*</span></label>
              <input type="text" placeholder="巡检员姓名"
                .value=${this.form.inspector_name}
                @input=${(e) => { this.form.inspector_name = e.target.value; }} />
              ${this.errors.inspector_name ? html`<div class="error">${this.errors.inspector_name}</div>` : ''}
            </div>
            <div class="form-row">
              <label>巡检日期 <span class="required">*</span></label>
              <input type="date"
                .value=${this.form.inspection_date}
                @input=${(e) => { this.form.inspection_date = e.target.value; }} />
              ${this.errors.inspection_date ? html`<div class="error">${this.errors.inspection_date}</div>` : ''}
            </div>
            <div class="form-actions">
              <button class="btn btn-plain" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>取消</button>
              <button class="btn btn-primary" @click=${this._submit}>提交</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('ticket-create', TicketCreate);
