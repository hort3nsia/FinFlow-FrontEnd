import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasWorkspace()) {
    return router.createUrlTree(['/app/dashboard']);
  }

  if (authService.accountSession() !== null) {
    return router.createUrlTree(['/workspaces']);
  }

  return true;
};
