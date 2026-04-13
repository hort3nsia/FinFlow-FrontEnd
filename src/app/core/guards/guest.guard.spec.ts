import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { vi } from 'vitest';
import { guestGuard } from './guest.guard';
import { AuthService } from '../auth/auth.service';

const route = new ActivatedRouteSnapshot();
const state = { url: '/login' } as RouterStateSnapshot;

describe('guestGuard', () => {
  const authService = {
    hasWorkspace: vi.fn(),
    accountSession: vi.fn(),
  };

  beforeEach(() => {
    authService.hasWorkspace.mockReset();
    authService.accountSession.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    });
  });

  it('redirects active workspace sessions to the dashboard', () => {
    const router = TestBed.inject(Router);
    authService.hasWorkspace.mockReturnValue(true);
    authService.accountSession.mockReturnValue(null);

    const result = TestBed.runInInjectionContext(() => guestGuard(route, state));

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/app/dashboard');
  });

  it('redirects account-only sessions to the workspace hub', () => {
    const router = TestBed.inject(Router);
    authService.hasWorkspace.mockReturnValue(false);
    authService.accountSession.mockReturnValue({
      accessToken: 'account-access',
      refreshToken: 'account-refresh',
      id: 'account-1',
      email: 'demo@finflow.local',
      sessionKind: 'account',
    });

    const result = TestBed.runInInjectionContext(() => guestGuard(route, state));

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/workspaces');
  });

  it('allows anonymous users to access guest routes', () => {
    authService.hasWorkspace.mockReturnValue(false);
    authService.accountSession.mockReturnValue(null);

    const result = TestBed.runInInjectionContext(() => guestGuard(route, state));

    expect(result).toBe(true);
  });
});
