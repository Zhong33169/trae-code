import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { QueueComponent } from './pages/queue/queue.component';
import { OrderDetailComponent } from './pages/order-detail/order-detail.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'queue', component: QueueComponent, canActivate: [AuthGuard] },
  { path: 'order/:id', component: OrderDetailComponent, canActivate: [AuthGuard] },
  { path: '', redirectTo: '/queue', pathMatch: 'full' },
  { path: '**', redirectTo: '/queue' }
];
