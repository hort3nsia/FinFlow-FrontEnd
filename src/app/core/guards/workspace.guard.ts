import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

// Guard for routes that should only be accessible when user has NO workspace yet
export const noWorkspaceGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If already has workspace, redirect to dashboard
  if (authService.hasWorkspace()) {
    return router.createUrlTree(['/app/dashboard']);
  }

  return true;
};

// Guard for routes that should only be accessible when user has workspace
export const workspaceGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasWorkspace()) {
    return true;
  }

  // If no workspace, redirect to workspace selection
  return router.createUrlTree(['/workspaces']);
};
