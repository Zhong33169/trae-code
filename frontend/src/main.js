import { LitElement, html, css } from 'lit';
import { api, setToken, clearToken, getToken } from './services/api.js';
import './components/app-login.js';
import './components/app-layout.js';
import './components/app-form-list.js';
import './components/app-form-detail.js';
import './components/app-form-create.js';
import './components/app-statistics.js';
import './components/app-timeout-records.js';

class AppShell extends LitElement {
  static properties = {
    user: { type: Object },
    route: { type: String },
    routeParams: { type: Object },
    loading: { type: Boolean },
  };

  static styles = css`
    :host { display: block; min-height: 100vh; }
  `;

  constructor() {
    super();
    this.user = null;
    this.route = 'login';
    this.routeParams = {};
    this.loading = true;
    this._tryAutoLogin();
  }

  async _tryAutoLogin() {
    const token = getToken();
    if (token) {
      try {
        const me = await api.getMe();
        this.user = me;
        this.route = 'list';
      } catch {
        clearToken();
        this.route = 'login';
      }
    }
    this.loading = false;
  }

  _navigate(route, params = {}) {
    this.route = route;
    this.routeParams = params;
  }

  _onLogin(e) {
    this.user = e.detail.user;
    setToken(e.detail.token);
    this.route = 'list';
  }

  _onLogout() {
    clearToken();
    this.user = null;
    this.route = 'login';
  }

  render() {
    if (this.loading) {
      return html`<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#666;">加载中...</div>`;
    }

    if (this.route === 'login' || !this.user) {
      return html`<app-login @login=${this._onLogin}></app-login>`;
    }

    return html`
      <app-layout
        .user=${this.user}
        @navigate=${(e) => this._navigate(e.detail.route, e.detail.params || {})}
        @logout=${this._onLogout}
      >
        ${this._renderRoute()}
      </app-layout>
    `;
  }

  _renderRoute() {
    switch (this.route) {
      case 'list':
        return html`<app-form-list
          .user=${this.user}
          @navigate=${(e) => this._navigate(e.detail.route, e.detail.params || {})}
        ></app-form-list>`;
      case 'detail':
        return html`<app-form-detail
          .user=${this.user}
          .formId=${this.routeParams.id}
          @navigate=${(e) => this._navigate(e.detail.route, e.detail.params || {})}
        ></app-form-detail>`;
      case 'create':
        return html`<app-form-create
          .user=${this.user}
          @navigate=${(e) => this._navigate(e.detail.route, e.detail.params || {})}
        ></app-form-create>`;
      case 'statistics':
        return html`<app-statistics .user=${this.user}></app-statistics>`;
      case 'timeout-records':
        return html`<app-timeout-records .user=${this.user}></app-timeout-records>`;
      default:
        return html`<app-form-list
          .user=${this.user}
          @navigate=${(e) => this._navigate(e.detail.route, e.detail.params || {})}
        ></app-form-list>`;
    }
  }
}

customElements.define('app-shell', AppShell);
