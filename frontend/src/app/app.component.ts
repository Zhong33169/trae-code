import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './core/auth.service';
import { DEMO_ACCOUNTS, ROLE_LABELS, ROLE_AVATARS, ROLE_LIST, AppUser, Role } from './core/models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (auth.user(); as u) {
      <header class="topbar">
        <div class="brand">
          <span class="title">续保任务批量变更复核系统</span>
          <span class="sub">Renewal Review Workbench</span>
        </div>

        <nav class="navlinks">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="navlink">续保任务队列</a>
          <a routerLink="/batches" routerLinkActive="active" class="navlink">批量变更工作台</a>
        </nav>

        <div class="spacer"></div>

        <div class="role-switch" role="tablist" aria-label="切换演示角色">
          @for (r of roles; track r) {
            <button
              [class.active]="u.role === r"
              (click)="switchRole(r)"
              [title]="'以 ' + label(r) + ' 身份重新登录（演示快速切换）'">
              {{ label(r) }}
            </button>
          }
        </div>

        <div class="userbox">
          <div class="userchip">
            <span class="av">{{ avatar(u) }}</span>
            <span>
              <div class="nm">{{ u.displayName }}</div>
              <div class="rl">{{ label(u.role) }} · {{ u.username }}</div>
            </span>
          </div>
          <button class="btn btn-sm" (click)="logout()">退出</button>
        </div>
      </header>
    }

    <router-outlet />
  `,
})
export class AppComponent {
  auth = inject(AuthService);
  private router = inject(Router);

  roles = ROLE_LIST;
  readonly switching = signal(false);

  label = (r: Role) => ROLE_LABELS[r];
  avatar = (u: AppUser) => ROLE_AVATARS[u.role];

  async switchRole(role: Role) {
    if (this.switching()) return;
    this.switching.set(true);
    try {
      await this.auth.switchRole(role);
      this.router.navigate(['/']);
    } catch {
      // keep current session on failure
    } finally {
      this.switching.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
