import { LitElement, html, css } from 'lit';
import { api } from '../services/api.js';

class AppLogin extends LitElement {
  static properties = {
    username: { type: String },
    password: { type: String },
    error: { type: String },
    loading: { type: Boolean },
  };

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .login-card {
      background: white;
      border-radius: 12px;
      padding: 40px;
      width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
    }
    h1 {
      text-align: center;
      color: #333;
      margin-bottom: 8px;
      font-size: 24px;
    }
    .subtitle {
      text-align: center;
      color: #888;
      margin-bottom: 32px;
      font-size: 14px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #555;
      margin-bottom: 6px;
    }
    input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
    }
    button {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover { opacity: 0.9; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .error {
      background: #fee;
      color: #c33;
      padding: 10px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 16px;
      border: 1px solid #fcc;
    }
    .demo-accounts {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
    .demo-accounts h3 {
      font-size: 13px;
      color: #999;
      margin-bottom: 10px;
    }
    .demo-item {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
      color: #666;
    }
    .demo-item span:first-child { font-weight: 500; }
    .demo-item .cred { color: #999; font-family: monospace; }
  `;

  constructor() {
    super();
    this.username = '';
    this.password = '';
    this.error = '';
    this.loading = false;
  }

  async _submit() {
    if (!this.username || !this.password) {
      this.error = '请输入用户名和密码';
      return;
    }
    this.loading = true;
    this.error = '';
    try {
      const res = await api.login(this.username, this.password);
      this.dispatchEvent(new CustomEvent('login', {
        detail: { user: { id: res.id, username: res.username, role: res.role, display_name: res.display_name }, token: res.token },
        bubbles: true, composed: true,
      }));
    } catch (e) {
      this.error = e.message;
    }
    this.loading = false;
  }

  _quickLogin(username, password) {
    this.username = username;
    this.password = password;
    this._submit();
  }

  render() {
    return html`
      <div class="login-card">
        <h1>讲师排课单管理系统</h1>
        <p class="subtitle">请登录以继续操作</p>
        ${this.error ? html`<div class="error">${this.error}</div>` : ''}
        <div class="form-group">
          <label>用户名</label>
          <input type="text" .value=${this.username} @input=${(e) => this.username = e.target.value} @keydown=${(e) => e.key === 'Enter' && this._submit()} placeholder="请输入用户名" />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input type="password" .value=${this.password} @input=${(e) => this.password = e.target.value} @keydown=${(e) => e.key === 'Enter' && this._submit()} placeholder="请输入密码" />
        </div>
        <button ?disabled=${this.loading} @click=${this._submit}>
          ${this.loading ? '登录中...' : '登 录'}
        </button>
        <div class="demo-accounts">
          <h3>演示账号（点击快速登录）</h3>
          <div class="demo-item" style="cursor:pointer" @click=${() => this._quickLogin('clerk1', 'clerk1')}>
            <span>张登记（讲师排课登记员）</span>
            <span class="cred">clerk1 / clerk1</span>
          </div>
          <div class="demo-item" style="cursor:pointer" @click=${() => this._quickLogin('supervisor1', 'supervisor1')}>
            <span>李审核（讲师排课审核主管）</span>
            <span class="cred">supervisor1 / supervisor1</span>
          </div>
          <div class="demo-item" style="cursor:pointer" @click=${() => this._quickLogin('manager1', 'manager1')}>
            <span>王复核（企业培训公司复核负责人）</span>
            <span class="cred">manager1 / manager1</span>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('app-login', AppLogin);
