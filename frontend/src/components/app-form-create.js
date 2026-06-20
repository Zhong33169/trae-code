import { LitElement, html, css } from 'lit';
import { api } from '../services/api.js';

class AppFormCreate extends LitElement {
  static properties = {
    user: { type: Object },
    form: { type: Object },
    error: { type: String },
    loading: { type: Boolean },
  };

  static styles = css`
    :host { display: block; }
    .back-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border: 1px solid #ddd; border-radius: 6px;
      background: white; color: #555; font-size: 13px; cursor: pointer; margin-bottom: 16px;
    }
    .back-btn:hover { background: #f5f5f5; }
    .card {
      background: white; border-radius: 10px; padding: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08); max-width: 640px;
    }
    h2 { font-size: 18px; margin-bottom: 20px; color: #333; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 13px; font-weight: 500; color: #555; margin-bottom: 4px; }
    .form-group label .required { color: #e53e3e; }
    .form-group input, .form-group textarea, .form-group select {
      width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px;
    }
    .form-group textarea { min-height: 80px; resize: vertical; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .btn-row { display: flex; gap: 8px; margin-top: 20px; }
    .btn {
      padding: 8px 20px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500;
    }
    .btn-primary { background: #667eea; color: white; }
    .btn-outline { background: white; color: #667eea; border: 1px solid #667eea; }
    .btn:hover { opacity: 0.85; }
    .error-msg { background: #fee2e2; color: #991b1b; padding: 8px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
  `;

  constructor() {
    super();
    this.form = { title: '', instructor_name: '', instructor_id: '', course_name: '', course_type: '', training_company: '', start_date: '', end_date: '', location: '', student_count: 0, description: '' };
    this.error = '';
    this.loading = false;
  }

  _updateField(field, value) {
    this.form = { ...this.form, [field]: value };
  }

  async _submit() {
    if (!this.form.title || !this.form.instructor_name || !this.form.course_name) {
      this.error = '标题、讲师姓名和课程名称为必填项';
      return;
    }
    this.loading = true;
    this.error = '';
    try {
      const result = await api.createForm(this.form);
      this.dispatchEvent(new CustomEvent('navigate', {
        detail: { route: 'detail', params: { id: result.id } },
        bubbles: true, composed: true,
      }));
    } catch (e) {
      this.error = e.message;
    }
    this.loading = false;
  }

  render() {
    return html`
      <button class="back-btn" @click=${() => this.dispatchEvent(new CustomEvent('navigate', { detail: { route: 'list' }, bubbles: true, composed: true }))}>← 返回列表</button>
      <div class="card">
        <h2>新建排课单</h2>
        ${this.error ? html`<div class="error-msg">${this.error}</div>` : ''}
        <div class="form-group">
          <label>标题 <span class="required">*</span></label>
          <input type="text" .value=${this.form.title} @input=${(e) => this._updateField('title', e.target.value)} placeholder="请输入排课单标题" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>讲师姓名 <span class="required">*</span></label>
            <input type="text" .value=${this.form.instructor_name} @input=${(e) => this._updateField('instructor_name', e.target.value)} />
          </div>
          <div class="form-group">
            <label>讲师编号</label>
            <input type="text" .value=${this.form.instructor_id} @input=${(e) => this._updateField('instructor_id', e.target.value)} />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>课程名称 <span class="required">*</span></label>
            <input type="text" .value=${this.form.course_name} @input=${(e) => this._updateField('course_name', e.target.value)} />
          </div>
          <div class="form-group">
            <label>课程类型</label>
            <select .value=${this.form.course_type} @change=${(e) => this._updateField('course_type', e.target.value)}>
              <option value="">请选择</option>
              <option value="技术培训">技术培训</option>
              <option value="管理培训">管理培训</option>
              <option value="综合培训">综合培训</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>培训公司</label>
          <input type="text" .value=${this.form.training_company} @input=${(e) => this._updateField('training_company', e.target.value)} />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>开始日期</label>
            <input type="date" .value=${this.form.start_date} @input=${(e) => this._updateField('start_date', e.target.value)} />
          </div>
          <div class="form-group">
            <label>结束日期</label>
            <input type="date" .value=${this.form.end_date} @input=${(e) => this._updateField('end_date', e.target.value)} />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>培训地点</label>
            <input type="text" .value=${this.form.location} @input=${(e) => this._updateField('location', e.target.value)} />
          </div>
          <div class="form-group">
            <label>学员人数</label>
            <input type="number" .value=${this.form.student_count} @input=${(e) => this._updateField('student_count', parseInt(e.target.value) || 0)} />
          </div>
        </div>
        <div class="form-group">
          <label>描述</label>
          <textarea .value=${this.form.description} @input=${(e) => this._updateField('description', e.target.value)} placeholder="请输入排课单描述"></textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" ?disabled=${this.loading} @click=${this._submit}>
            ${this.loading ? '提交中...' : '提交排课单'}
          </button>
          <button class="btn btn-outline" @click=${() => this.dispatchEvent(new CustomEvent('navigate', { detail: { route: 'list' }, bubbles: true, composed: true }))}>取消</button>
        </div>
      </div>
    `;
  }
}

customElements.define('app-form-create', AppFormCreate);
