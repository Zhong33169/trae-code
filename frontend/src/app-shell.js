import { LitElement, html, css } from 'lit';
import { api, ROLE_LABELS, NODE_LABELS, STATUS_LABELS, STATUS_COLORS, TYPE_LABELS } from './api.js';

export class AppShell extends LitElement {
  static properties = {
    user: { type: Object },
    route: { type: Object },
    loading: { type: Boolean }
  };

  static styles = css`
    .layout { display: flex; min-height: 100vh; }
    .sidebar {
      width: 220px; background: #001529; color: #fff; padding: 16px 0; flex-shrink: 0;
    }
    .logo { padding: 0 24px 20px; font-size: 18px; font-weight: 600; border-bottom: 1px solid #1f3a5c; margin-bottom: 12px; }
    .menu-item {
      display: block; padding: 12px 24px; color: #b8c2cc; cursor: pointer; text-decoration: none;
      border-left: 3px solid transparent; transition: all 0.2s;
    }
    .menu-item:hover { background: #112240; color: #fff; }
    .menu-item.active { background: #1890ff; color: #fff; border-left-color: #fff; }
    .main { flex: 1; display: flex; flex-direction: column; }
    .header {
      height: 56px; background: #fff; padding: 0 24px; display: flex;
      align-items: center; justify-content: space-between; box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }
    .header-right { display: flex; align-items: center; gap: 16px; }
    .role-tag { background: #e6f7ff; color: #1890ff; padding: 4px 10px; border-radius: 4px; font-size: 13px; }
    .logout-btn {
      background: transparent; border: 1px solid #d9d9d9; padding: 6px 14px;
      border-radius: 4px; cursor: pointer; color: #666; font-size: 13px;
    }
    .logout-btn:hover { border-color: #ff4d4f; color: #ff4d4f; }
    .content { padding: 24px; flex: 1; overflow: auto; }
  `;

  constructor() {
    super();
    this.user = api.getCurrentUser();
    this.loading = false;
    this.route = this.parseRoute();
    window.addEventListener('popstate', () => { this.route = this.parseRoute(); this.requestUpdate(); });
    window.addEventListener('app:logout', () => this.handleLogout());
  }

  parseRoute() {
    const hash = location.hash.slice(1) || '/list';
    const [path, queryStr] = hash.split('?');
    const params = {};
    if (queryStr) new URLSearchParams(queryStr).forEach((v, k) => params[k] = v);
    const parts = path.split('/').filter(Boolean);
    return { name: parts[0] || 'list', id: parts[1], params };
  }

  navigate(path) {
    location.hash = path;
    this.route = this.parseRoute();
    this.requestUpdate();
  }

  handleLogout() {
    api.clearToken();
    this.user = null;
    this.requestUpdate();
  }

  render() {
    if (!this.user) {
      return html`<login-page @login-success=${this.handleLoginSuccess}></login-page>`;
    }

    const menus = this.getMenus();
    const { name, id } = this.route;

    return html`
      <div class="layout">
        <aside class="sidebar">
          <div class="logo">异动申请系统</div>
          ${menus.map(m => html`
            <div class="menu-item ${name === m.key ? 'active' : ''}" @click=${() => this.navigate(m.path)}>
              ${m.label}
            </div>
          `)}
        </aside>
        <div class="main">
          <header class="header">
            <div></div>
            <div class="header-right">
              <span class="role-tag">${ROLE_LABELS[this.user.role] || this.user.role} · ${this.user.real_name}</span>
              <button class="logout-btn" @click=${this.handleLogout}>退出</button>
            </div>
          </header>
          <main class="content">
            ${name === 'list' ? html`<application-list @navigate=${(e) => this.navigate(e.detail)} .user=${this.user}></application-list>` : ''}
            ${name === 'create' ? html`<application-form @created=${(e) => this.navigate('/detail/' + e.detail)} .user=${this.user}></application-form>` : ''}
            ${name === 'detail' && id ? html`<application-detail .appId=${id} .user=${this.user} @back=${() => this.navigate('/list')}></application-detail>` : ''}
            ${name === 'statistics' ? html`<statistics-page .user=${this.user}></statistics-page>` : ''}
            ${name === 'logs' ? html`<logs-page></logs-page>` : ''}
          </main>
        </div>
      </div>
    `;
  }

  getMenus() {
    const all = [
      { key: 'list', path: '/list', label: '异动申请列表' },
      { key: 'statistics', path: '/statistics', label: '数据统计' },
    ];
    if (this.user?.role === 'hr_specialist') {
      all.splice(1, 0, { key: 'create', path: '/create', label: '发起异动申请' });
    }
    all.push({ key: 'logs', path: '/logs', label: '操作日志' });
    return all;
  }

  handleLoginSuccess(e) {
    const { token, user } = e.detail;
    api.setToken(token);
    api.setCurrentUser(user);
    this.user = user;
    this.route = this.parseRoute();
    this.requestUpdate();
  }
}

customElements.define('app-shell', AppShell);
export { ROLE_LABELS, NODE_LABELS, STATUS_LABELS, STATUS_COLORS, TYPE_LABELS };
