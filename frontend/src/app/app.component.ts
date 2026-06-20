import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { AuthService } from './services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent],
  template: `
    <div class="app-layout">
      <app-header *ngIf="authService.isLoggedIn()"></app-header>
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-layout { min-height: 100vh; background: #f0f2f5; }
    .main-content { padding: 16px; max-width: 1600px; margin: 0 auto; }
  `]
})
export class AppComponent {
  constructor(public authService: AuthService) {}
}
