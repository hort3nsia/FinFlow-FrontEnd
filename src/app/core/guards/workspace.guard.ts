import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

// Keep the create-workspace route reachable from the app shell.
// AuthGuard already blocks anonymous users, so this guard intentionally
// stays permissive for authenticated users.
export const noWorkspaceGuard: CanActivateFn = () => {
  return true;
};

// App shell routes require an existing workspace context.
export const workspaceGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasWorkspace()) {
    return true;
  }

  // If no workspace, redirect to workspace selection
  return router.createUrlTree(['/workspaces']);
};
