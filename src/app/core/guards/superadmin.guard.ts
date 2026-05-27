import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CurrentWorkspaceFacade } from '../../features/dashboard/data/current-workspace.facade';

/**
 * Restricts a route to authenticated users with the SuperAdmin role on
 * their current workspace membership. Falls back to /app/dashboard when
 * the role is missing or insufficient.
 */
export const superAdminGuard: CanActivateFn = () => {
  const facade = inject(CurrentWorkspaceFacade);
  const router = inject(Router);

  const role = (facade.state().workspace?.role ?? '').toString();
  const normalized = role.replace(/[\s_-]+/g, '').toLowerCase();
  if (normalized.includes('superadmin')) {
    return true;
  }

  return router.createUrlTree(['/app/dashboard']);
};
