import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { Role } from './models/auth.model';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    loadComponent: () => import('./pages/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'releases',
        loadComponent: () => import('./pages/release-list/release-list.component').then(m => m.ReleaseListComponent)
      },
      {
        path: 'releases/new',
        loadComponent: () => import('./pages/release-form/release-form.component').then(m => m.ReleaseFormComponent),
        data: { roles: [Role.REGISTRAR] }
      },
      {
        path: 'releases/:id',
        loadComponent: () => import('./pages/release-detail/release-detail.component').then(m => m.ReleaseDetailComponent)
      },
      {
        path: 'releases/:id/edit',
        loadComponent: () => import('./pages/release-form/release-form.component').then(m => m.ReleaseFormComponent),
        data: { roles: [Role.REGISTRAR] }
      },
      {
        path: 'handovers',
        loadComponent: () => import('./pages/handover-list/handover-list.component').then(m => m.HandoverListComponent)
      },
      {
        path: 'logs',
        loadComponent: () => import('./pages/logs/logs.component').then(m => m.LogsComponent)
      }
    ]
  }
];
