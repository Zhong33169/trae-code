import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { QueueComponent } from './pages/queue/queue.component';
import { TaskDetailComponent } from './pages/task-detail/task-detail.component';
import { BatchListComponent } from './pages/batches/batch-list.component';
import { BatchDetailComponent } from './pages/batch-detail/batch-detail.component';
import { LoginComponent } from './pages/login/login.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: QueueComponent, canActivate: [authGuard] },
  { path: 'tasks/:id', component: TaskDetailComponent, canActivate: [authGuard] },
  { path: 'batches', component: BatchListComponent, canActivate: [authGuard] },
  { path: 'batches/:id', component: BatchDetailComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
