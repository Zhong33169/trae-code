import { Routes } from '@angular/router';
import { LoginPage } from './pages/login.page';
import { QueuePage } from './pages/queue.page';
import { PlanDetailPage } from './pages/plan-detail.page';
import { BatchesPage } from './pages/batches.page';
import { BatchDetailPage } from './pages/batch-detail.page';
import { AuditPage } from './pages/audit.page';
import { authGuardFn } from './auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'queue' },
  { path: 'login', component: LoginPage },
  { path: 'queue', component: QueuePage, canActivate: [authGuardFn] },
  { path: 'plan/:id', component: PlanDetailPage, canActivate: [authGuardFn] },
  { path: 'batches', component: BatchesPage, canActivate: [authGuardFn] },
  { path: 'batch/:id', component: BatchDetailPage, canActivate: [authGuardFn] },
  { path: 'audit', component: AuditPage, canActivate: [authGuardFn] },
  { path: '**', redirectTo: 'queue' }
];
