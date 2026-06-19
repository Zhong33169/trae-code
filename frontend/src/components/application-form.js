import { LitElement, html, css } from 'lit';
import { api, TYPE_LABELS } from '../api.js';

export class ApplicationForm extends LitElement {
  static properties = {
    employees: { type: Array },
    form: { type: Object },
    loading: { type: Boolean },
    submitting: { type: Boolean },
    error: { type: String }
  };

  static styles = css`
    .card { background: #fff; border-radius: 6px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); max-width: 800px; margin: 0 auto; }
    h2 { margin: 0 0 20px; font-size: 18px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field { margin-bottom: 16px; }
    label { display: block; font-size: 13px; color: #595959; margin-bottom: 6px; }
    label .req { color: #f5222d; margin-right: 3px; }
    input, select, textarea {
      width: 100%; padding: 8px 10px; border: 1px solid #d9d9d9; border-radius: 4px;
      font-size: 13px; outline: none; font-family: inherit; box-sizing: border-box;
    }
    input:focus, select:focus, textarea:focus { border-color: #1890ff; }
    textarea { resize: vertical; min-height: 80px; }
    .section { margin: 20px 0 12px; font-size: 14px; font-weight: 600; color: #262626; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0; }
    .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
    .btn {
      padding: 8px 20px; border-radius: 4px; border: 1px solid transparent; cursor: pointer; font-size: 13px;
    }
    .btn-primary { background: #1890ff; color: #fff; }
    .btn-primary:hover { background: #40a9ff; }
    .btn-primary:disabled { background: #91caff; cursor: not-allowed; }
    .btn-default { background: #fff; border-color: #d9d9d9; color: #333; }
    .btn-default:hover { border-color: #1890ff; color: #1890ff; }
    .error { color: #f5222d; font-size: 13px; min-height: 18px; }
    .info { padding: 10px; background: #f6f8fa; border-radius: 4px; font-size: 12px; color: #666; margin-bottom: 16px; }
  `;

  constructor() {
    super();
    this.employees = [];
    this.loading = true;
    this.submitting = false;
    this.error = '';
    this.form = {
      employee_id: '',
      type: 'both',
      from_department: '',
      to_department: '',
      from_position: '',
      to_position: '',
      from_salary: '',
      to_salary: '',
      reason: ''
    };
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadEmployees();
  }

  async loadEmployees() {
    this.loading = true;
    try {
      this.employees = await api.listEmployees();
    } catch (e) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  }

  onEmployeeChange(e) {
    const id = parseInt(e.target.value) || 0;
    const emp = this.employees.find(x => x.id === id);
    this.form = {
      ...this.form,
      employee_id: id,
      from_department: emp?.department || '',
      from_position: emp?.position || '',
      from_salary: emp?.current_salary || ''
    };
  }

  setField(k, v) {
    this.form = { ...this.form, [k]: v };
  }

  validate() {
    if (!this.form.employee_id) return '请选择员工';
    if (!this.form.type) return '请选择异动类型';
    if (this.form.type !== 'salary_adjustment') {
      if (!this.form.to_department) return '请填写调岗后部门';
      if (!this.form.to_position) return '请填写调岗后岗位';
    }
    if (this.form.type !== 'transfer') {
      if (!this.form.to_salary && this.form.to_salary !== 0) return '请填写调薪后薪资';
    }
    if (!this.form.reason) return '请填写异动原因';
    return '';
  }

  async handleSubmit(e) {
    e.preventDefault();
    const err = this.validate();
    if (err) { this.error = err; return; }
    this.error = '';
    this.submitting = true;
    try {
      const data = { ...this.form };
      data.from_salary = parseFloat(data.from_salary) || 0;
      data.to_salary = parseFloat(data.to_salary) || 0;
      const result = await api.createApplication(data);
      this.dispatchEvent(new CustomEvent('created', { detail: result.id }));
    } catch (e) {
      this.error = e.message;
    } finally {
      this.submitting = false;
    }
  }

  render() {
    const showTransfer = this.form.type !== 'salary_adjustment';
    const showSalary = this.form.type !== 'transfer';
    const selectedEmp = this.employees.find(e => e.id === parseInt(this.form.employee_id));

    return html`
      <div class="card">
        <h2>发起异动申请</h2>
        <div class="info">申请人事专员将发起申请，依次由薪酬主管处理预算和调薪、HRBP负责人最终确认。每个节点需在 24 小时内完成。</div>
        <form @submit=${this.handleSubmit}>
          <div class="section">基础信息</div>
          <div class="row">
            <div class="field">
              <label><span class="req">*</span>选择员工</label>
              <select .value=${this.form.employee_id} @change=${this.onEmployeeChange}>
                <option value="">请选择</option>
                ${this.employees.map(e => html`
                  <option value=${e.id}>${e.employee_no} - ${e.name} (${e.department} · ${e.position})</option>
                `)}
              </select>
            </div>
            <div class="field">
              <label><span class="req">*</span>异动类型</label>
              <select .value=${this.form.type} @change=${e => this.setField('type', e.target.value)}>
                <option value="transfer">${TYPE_LABELS.transfer}</option>
                <option value="salary_adjustment">${TYPE_LABELS.salary_adjustment}</option>
                <option value="both">${TYPE_LABELS.both}</option>
              </select>
            </div>
          </div>

          ${showTransfer ? html`
            <div class="section">调岗信息</div>
            <div class="row">
              <div class="field">
                <label>调岗前部门</label>
                <input .value=${this.form.from_department} readonly />
              </div>
              <div class="field">
                <label><span class="req">*</span>调岗后部门</label>
                <input .value=${this.form.to_department} @input=${e => this.setField('to_department', e.target.value)} placeholder="请输入" />
              </div>
              <div class="field">
                <label>调岗前岗位</label>
                <input .value=${this.form.from_position} readonly />
              </div>
              <div class="field">
                <label><span class="req">*</span>调岗后岗位</label>
                <input .value=${this.form.to_position} @input=${e => this.setField('to_position', e.target.value)} placeholder="请输入" />
              </div>
            </div>
          ` : ''}

          ${showSalary ? html`
            <div class="section">调薪信息</div>
            <div class="row">
              <div class="field">
                <label>调岗前薪资</label>
                <input type="number" .value=${this.form.from_salary} readonly />
              </div>
              <div class="field">
                <label><span class="req">*</span>调薪后薪资</label>
                <input type="number" .value=${this.form.to_salary} @input=${e => this.setField('to_salary', e.target.value)} placeholder="请输入" />
              </div>
            </div>
          ` : ''}

          <div class="section">其他信息</div>
          <div class="field">
            <label><span class="req">*</span>异动原因</label>
            <textarea .value=${this.form.reason} @input=${e => this.setField('reason', e.target.value)} placeholder="请详细描述异动原因和依据"></textarea>
          </div>

          <div class="error">${this.error}</div>

          <div class="actions">
            <button type="button" class="btn btn-default" @click=${() => this.dispatchEvent(new CustomEvent('navigate', { detail: '/list' }))}>取消</button>
            <button type="submit" class="btn btn-primary" ?disabled=${this.submitting}>${this.submitting ? '提交中...' : '提交申请'}</button>
          </div>
        </form>
      </div>
    `;
  }
}

customElements.define('application-form', ApplicationForm);
