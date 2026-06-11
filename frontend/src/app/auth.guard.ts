import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const authGuardFn: CanActivateFn = () => {
  const token = localStorage.getItem('lp_token');
  if (token) return true;
  const router = inject(Router);
  return router.parseUrl('/login');
};
