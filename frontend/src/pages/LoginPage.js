import { LitElement, html } from 'lit';
import { request, showToast, storeUser } from '../utils.js';

class LoginPage extends LitElement {
  static properties = {
    username: { type: String },
    password: { type: String },
    loading: { type: Boolean },
  };

  constructor() {
    super();
    this.username = '';
    this.password = '';
    this.loading = false;
  }

  createRenderRoot() { return this; }

  async onSubmit(e) {
    e.preventDefault();
    if (!this.username || !this.password) {
      showToast('请输入用户名和密码', 'warning');
      return;
    }
    this.loading = true;
    try {
      const data = await request('/auth/login', {
        method: 'POST',
        body: { username: this.username, password: this.password },
      });
      if (data.code === 0) {
        storeUser(data.data.user, data.data.token);
        showToast('登录成功，欢迎 ' + data.data.user.realName, 'success');
        setTimeout(() => { location.hash = '#/applications'; }, 400);
      } else {
        showToast(data.message || '登录失败', 'error');
      }
    } catch (err) {
      showToast(err.message || '登录失败，请检查网络', 'error');
    } finally {
      this.loading = false;
    }
  }

  fillAccount(user, pwd) {
    this.username = user;
    this.password = pwd;
    this.requestUpdate();
  }

  render() {
    return html`
      <div class="login-page">
        <div class="login-box">
          <div class="login-title">💧 水务营业厅开户申请系统</div>
          <div class="login-subtitle">跨班组交接确认 · 全流程状态追踪</div>
          <form @submit="${this.onSubmit}">
            <div class="form-item">
              <label class="required">账号</label>
              <input
                type="text"
                placeholder="请输入账号"
                .value="${this.username}"
                @input="${(e) => (this.username = e.target.value)}"
                autocomplete="username"
              />
            </div>
            <div class="form-item">
              <label class="required">密码</label>
              <input
                type="password"
                placeholder="请输入密码"
                .value="${this.password}"
                @input="${(e) => (this.password = e.target.value)}"
                autocomplete="current-password"
              />
            </div>
            <button
              type="submit"
              class="btn btn-primary"
              ?disabled="${this.loading}"
              style="margin-top:6px;"
            >
              ${this.loading ? '登录中...' : '登 录'}
            </button>
          </form>
          <div class="login-tips">
            <strong>测试账号</strong><br/>
            登记员: register01 / 123456
            &nbsp;·&nbsp;
            <a href="javascript:void(0)" @click="${() => this.fillAccount('register01','123456')}">填入</a><br/>
            审核主管: auditor01 / 123456
            &nbsp;·&nbsp;
            <a href="javascript:void(0)" @click="${() => this.fillAccount('auditor01','123456')}">填入</a><br/>
            复核负责人: reviewer01 / 123456
            &nbsp;·&nbsp;
            <a href="javascript:void(0)" @click="${() => this.fillAccount('reviewer01','123456')}">填入</a>
          </div>
        </div>
      </div>
    `;
  }
}
customElements.define('login-page', LoginPage);
