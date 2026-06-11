import { LitElement, html } from 'lit';
import { getUser, clearUser, request, showToast, roleDisplayName } from './utils.js';

import './pages/LoginPage.js';
import './pages/ApplicationListPage.js';
import './pages/ApplicationFormPage.js';
import './pages/ApplicationDetailPage.js';
import './pages/HandoverPage.js';
import './pages/StatisticsPage.js';

class AppRoot extends LitElement {
  static properties = {
    route: { type: String },
    user: { type: Object },
  };

  constructor() {
    super();
    this.user = getUser();
    this.route = location.hash || '#/applications';
    window.addEventListener('hashchange', () => {
      this.route = location.hash || '#/applications';
      this.user = getUser();
      this.requestUpdate();
    });
  }

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    this.validateAuth();
  }

  async validateAuth() {
    const token = localStorage.getItem('auth_token');
    const publicRoutes = ['#/login', '#/'];
    const current = location.hash.split('?')[0];
    if (!token && !publicRoutes.includes(current)) {
      location.hash = '#/login';
      return;
    }
    if (token) {
      try {
        const data = await request('/auth/current');
        if (data.code === 0 && data.data) {
          this.user = data.data;
          localStorage.setItem('current_user', JSON.stringify(data.data));
          if (location.hash === '#/login' || location.hash === '' || location.hash === '#/') {
            location.hash = '#/applications';
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }
  }

  async logout() {
    try { await request('/auth/logout', { method: 'POST' }); } catch {}
    clearUser();
    this.user = null;
    showToast('已退出登录', 'info');
    location.hash = '#/login';
  }

  renderNav() {
    if (!this.user) return '';
    const u = this.user;
    const current = location.hash.split('?')[0];
    const isActive = (p) => (current === p ? 'active' : '');

    const registerLinks = html`
      <a href="#/applications" class="${isActive('#/applications')}">申请列表</a>
      <a href="#/applications/new" class="${isActive('#/applications/new')}">新建申请</a>
      <a href="#/handovers" class="${isActive('#/handovers')}">交接管理</a>
    `;
    const auditorLinks = html`
      <a href="#/applications" class="${isActive('#/applications')}">申请列表</a>
      <a href="#/handovers" class="${isActive('#/handovers')}">交接管理</a>
    `;
    const reviewerLinks = html`
      <a href="#/applications" class="${isActive('#/applications')}">申请列表</a>
      <a href="#/handovers" class="${isActive('#/handovers')}">交接管理</a>
      <a href="#/statistics" class="${isActive('#/statistics')}">统计看板</a>
    `;

    return html`
      <div class="nav-bar">
        <div class="nav-logo">
          <span style="font-size:22px;">💧</span>
          <span>水务营业厅开户申请管理系统</span>
        </div>
        <div class="nav-menu">
          ${u.role === 'register' ? registerLinks : ''}
          ${u.role === 'auditor' ? auditorLinks : ''}
          ${u.role === 'reviewer' ? reviewerLinks : ''}
        </div>
        <div class="nav-user">
          <span class="role-tag">${u.roleDisplay || roleDisplayName(u.role)}</span>
          <span>${u.realName} <span style="opacity:.6;font-size:12px;">(${u.shift})</span></span>
          <button @click="${this.logout}">退出</button>
        </div>
      </div>
    `;
  }

  renderPage() {
    const hash = location.hash || '#/login';
    const [path] = hash.split('?');

    if (path === '#/login' || path === '#/' || path === '') {
      return html`<login-page></login-page>`;
    }

    if (!this.user) {
      return html`<login-page></login-page>`;
    }

    if (path === '#/applications') {
      return html`<application-list-page .user="${this.user}"></application-list-page>`;
    }
    if (path === '#/applications/new') {
      if (this.user.role !== 'register') {
        return html`<div class="page-wrap"><div class="card">仅开户登记员可以新建申请</div></div>`;
      }
      return html`<application-form-page .user="${this.user}"></application-form-page>`;
    }
    if (path.startsWith('#/applications/')) {
      const id = path.split('/')[2];
      if (!isNaN(parseInt(id))) {
        return html`<application-detail-page .appId="${parseInt(id)}" .user="${this.user}"></application-detail-page>`;
      }
    }
    if (path === '#/handovers') {
      return html`<handover-page .user="${this.user}"></handover-page>`;
    }
    if (path === '#/statistics') {
      if (this.user.role !== 'reviewer') {
        return html`<div class="page-wrap"><div class="card">仅水务营业厅复核负责人可查看统计</div></div>`;
      }
      return html`<statistics-page></statistics-page>`;
    }

    return html`<div class="page-wrap"><div class="card">页面不存在：${path}</div></div>`;
  }

  render() {
    const needNav = this.user && location.hash !== '#/login' && location.hash !== '' && location.hash !== '#/';
    return html`
      ${needNav ? this.renderNav() : ''}
      ${this.renderPage()}
    `;
  }
}

customElements.define('app-root', AppRoot);

const app = document.getElementById('app');
app.innerHTML = '';
app.appendChild(document.createElement('app-root'));
