import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { DEMO_ACCOUNTS, ROLE_LABELS, Role, ROLE_LIST, ApiError } from '../../core/models';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="login-wrap">
      <div class="login-card card">
        <div class="card-head">
          <div>
            <h3 style="font-size:18px">续保任务批量变更复核系统</h3>
            <div class="sub muted" style="margin-top:2px">演示登录 · 选择岗位快速进入</div>
          </div>
        </div>
        <div class="card-body">
          @if (err()) {
            <div class="alert alert-error" style="margin-bottom:12px">
              <span class="ico">!</span>
              <span><span class="err-tag">{{ err()?.code }}</span> {{ err()?.message }}</span>
            </div>
          }

          <div class="section-title">一键切换演示角色</div>
          <div class="role-quick">
            @for (r of roles; track r) {
              <button (click)="quick(r)" [disabled]="busy()">
                <span class="rl">{{ label(r) }}</span>
                <span class="ac">{{ account(r).username }} / {{ account(r).password }}</span>
              </button>
            }
          </div>

          <div style="margin:18px 0 8px" class="section-title">或手动登录</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="field">
              <label>用户名</label>
              <input class="input" [value]="username()" (input)="username.set($any($event.target).value)" placeholder="cm_demo / us_demo / bo_demo" />
            </div>
            <div class="field">
              <label>密码</label>
              <input class="input" type="password" [value]="password()" (input)="password.set($any($event.target).value)" placeholder="cm123 / us123 / bo123" />
            </div>
            <button class="btn btn-primary" (click)="manual()" [disabled]="busy()">
              @if (busy()) { <span class="spin"></span> } 登录
            </button>
          </div>

          <div class="alert alert-info" style="margin-top:14px">
            <span class="ico">i</span>
            <span>后端运行于 <b>8005</b>，前端运行于 <b>3005</b>；切换角色后页面与接口会联动刷新。</span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  roles = ROLE_LIST;
  label = (r: Role) => ROLE_LABELS[r];
  account = (r: Role) => DEMO_ACCOUNTS[r];

  username = signal('cm_demo');
  password = signal('cm123');
  busy = signal(false);
  err = signal<ApiError | null>(null);

  async quick(role: Role) {
    const acc = DEMO_ACCOUNTS[role];
    this.username.set(acc.username);
    this.password.set(acc.password);
    await this.doLogin(acc.username, acc.password);
  }

  async manual() {
    await this.doLogin(this.username(), this.password());
  }

  private async doLogin(u: string, p: string) {
    this.busy.set(true);
    this.err.set(null);
    try {
      await this.auth.login(u, p);
      this.router.navigate(['/']);
    } catch (e) {
      this.err.set(e as ApiError);
    } finally {
      this.busy.set(false);
    }
  }
}
