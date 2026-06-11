import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'orders' },
  {
    path: 'orders',
    loadComponent: () =>
      import('./components/order-list/order-list.component').then((m) => m.OrderListComponent),
  },
  {
    path: 'batches',
    loadComponent: () =>
      import('./components/batch-list/batch-list.component').then((m) => m.BatchListComponent),
  },
];
