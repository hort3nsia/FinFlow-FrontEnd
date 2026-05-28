import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export type WorkspaceRole = 'TenantAdmin' | 'Manager' | 'Accountant' | 'Staff' | 'SuperAdmin';

/**
 * Normalizes the workspace role string returned by the backend into a canonical value.
 */
export function normalizeWorkspaceRole(rawRole: string | null | undefined): WorkspaceRole | null {
  if (!rawRole) return null;
  const normalized = rawRole.toString().toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized.includes('superadmin')) return 'SuperAdmin';
  if (normalized.includes('tenantadmin') || normalized.includes('owner')) return 'TenantAdmin';
  if (normalized.includes('accountant')) return 'Accountant';
  if (normalized.includes('manager')) return 'Manager';
  if (normalized.includes('staff') || normalized.includes('employee')) return 'Staff';
  return null;
}

/**
 * Restricts a route to workspace members whose role is in the allowed list.
 * Uses AuthService.workspaceSession() which is available synchronously from
 * localStorage after login/workspace selection.
 */
export const roleGuard = (allowed: WorkspaceRole[]): CanActivateFn => () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const session = authService.workspaceSession();
  const role = normalizeWorkspaceRole(session?.role);

  // SuperAdmin always passes.
  if (role === 'SuperAdmin') return true;

  if (role && allowed.includes(role)) return true;

  return router.createUrlTree(['/app/forbidden']);
};
