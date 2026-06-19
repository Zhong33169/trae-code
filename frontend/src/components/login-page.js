import { LitElement, html, css } from 'lit';
import { api, ROLE_LABELS } from '../api.js';

export class LoginPage extends LitElement {
  static properties = {
    username: { type: String },
    password: { type: String },
    loading: { type: Boolean },
    error: { type: String }
  };

  static styles = css`
    .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%); }
    .card { background: #fff; padding: 40px; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); width: 380px; }
    h2 { margin: 0 0 24px; font-size: 22px; text-align: center; color: #262626; }
    .field { margin-bottom: 16px; }
    label { display: block; font-size: 13px; color: #595959; margin-bottom: 6px; }
    input { width: 100%; padding: 10px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 14px; outline: none; }
    input:focus { border-color: #1890ff; }
    button {
      width: 100%; padding: 11px; background: #1890ff; color: #fff; border: none;
      border-radius: 4px; font-size: 15px; cursor: pointer; transition: background 0.2s;
    }
    button:hover { background: #40a9ff; }
    button:disabled { background: #91caff; cursor: not-allowed; }
    .error { color: #f5222d; font-size: 13px; margin-top: 10px; min-height: 18px; text-align: center; }
    .tips { margin-top: 20px; padding: 12px; background: #f6f8fa; border-radius: 4px; font-size: 12px; color: #666; line-height: 1.8; }
    .tips b { color: #1890ff; }
  `;

  constructor() {
    super();
    this.username = '';
    this.password = '';
    this.loading = false;
    this.error = '';
  }

  render() {
    return html`
      <div class="wrap">
        <div class="card">
          <h2>异动申请审批系统</h2>
          <form @submit=${this.handleSubmit}>
            <div class="field">
              <label>账号</label>
              <input .value=${this.username} @input=${e => this.username = e.target.value} placeholder="请输入账号" autocomplete="username" />
            </div>
            <div class="field">
              <label>密码</label>
              <input type="password" .value=${this.password} @input=${e => this.password = e.target.value} placeholder="请输入密码" autocomplete="current-password" />
            </div>
            <button type="submit" ?disabled=${this.loading || !this.username || !this.password}>
              ${this.loading ? '登录中...' : '登 录'}
            </button>
            <div class="error">${this.error}</div>
          </form>
          <div class="tips">
            测试账号：<br/>
            <b>hr01 / 123456</b> - ${ROLE_LABELS.hr_specialist}<br/>
            <b>salary01 / 123456</b> - ${ROLE_LABELS.salary_supervisor}<br/>
            <b>hrbp01 / 123456</b> - ${ROLE_LABELS.hrbp_leader}
          </div>
        </div>
      </div>
    `;
  }

  async handleSubmit(e) {
    e.preventDefault();
    this.error = '';
    this.loading = true;
    try {
      const result = await api.login(this.username, this.password);
      this.dispatchEvent(new CustomEvent('login-success', { detail: result, bubbles: true, composed: true }));
    } catch (err) {
      this.error = err.message;
    } finally {
      this.loading = false;
    }
  }
}

customElements.define('login-page', LoginPage);
