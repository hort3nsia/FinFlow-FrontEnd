import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthApiService } from './auth-api.service';
import { AuthService } from './auth.service';

const createAccountSession = () => ({
  accessToken: 'account-token-123',
  refreshToken: 'account-refresh-123',
  id: 'account-1',
  email: 'demo@finflow.local',
  sessionKind: 'account' as const,
});

const createWorkspaceSession = () => ({
  accessToken: 'workspace-token-123',
  refreshToken: 'workspace-refresh-123',
  id: 'account-1',
  membershipId: 'membership-1',
  email: 'demo@finflow.local',
  role: 'Owner',
  idTenant: 'tenant-1',
  sessionKind: 'workspace' as const,
});

const createRegistrationPending = () => ({
  accountId: 'account-1',
  email: 'demo@finflow.local',
  requiresEmailVerification: true,
  cooldownSeconds: 90,
});

describe('AuthService', () => {
  const authApiService = {
    login: vi.fn(),
    register: vi.fn(),
    verifyEmailByToken: vi.fn(),
    verifyEmailByOtp: vi.fn(),
    resendEmailVerification: vi.fn(),
    refreshToken: vi.fn(),
    logout: vi.fn(),
    createWorkspace: vi.fn(),
    switchWorkspace: vi.fn(),
    getMyWorkspaces: vi.fn(),
  };

  beforeEach(() => {
    localStorage.clear();
    Object.values(authApiService).forEach((mockFn) => mockFn.mockReset());

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthApiService,
          useValue: authApiService,
        },
      ],
    });
  });

  it('starts unauthenticated when there is no stored session', () => {
    const service = TestBed.inject(AuthService);

    expect(service.isAuthenticated()).toBe(false);
    expect(service.userEmail()).toBeNull();
    expect(service.getAccessToken()).toBeNull();
  });

  it('restores an account session from local storage', () => {
    localStorage.setItem(
      'finflow_account_session',
      JSON.stringify(createAccountSession()),
    );

    const service = TestBed.inject(AuthService);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentSessionKind()).toBe('account');
    expect(service.userEmail()).toBe('demo@finflow.local');
    expect(service.getAccessToken()).toBe('account-token-123');
  });

  it('prefers the workspace session token when one is active', () => {
    localStorage.setItem(
      'finflow_account_session',
      JSON.stringify(createAccountSession()),
    );
    localStorage.setItem(
      'finflow_workspace_session',
      JSON.stringify(createWorkspaceSession()),
    );

    const service = TestBed.inject(AuthService);

    expect(service.hasWorkspace()).toBe(true);
    expect(service.currentSessionKind()).toBe('workspace');
    expect(service.getAccessToken()).toBe('workspace-token-123');
  });

  it('does not persist a session after register and returns verification-pending data', () => {
    authApiService.register.mockReturnValue(of(createRegistrationPending()));

    const service = TestBed.inject(AuthService);
    let result: unknown;

    service.register({
      email: 'demo@finflow.local',
      password: 'Pass@word1',
      name: 'Demo User',
    }).subscribe((value) => {
      result = value;
    });

    expect(result).toEqual(createRegistrationPending());
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('finflow_account_session')).toBeNull();
  });

  it('verifies email by token without mutating local session state', () => {
    authApiService.verifyEmailByToken.mockReturnValue(of(true));

    const service = TestBed.inject(AuthService);
    let result: boolean | undefined;

    service.verifyEmailByToken('token-123').subscribe((value) => {
      result = value;
    });

    expect(authApiService.verifyEmailByToken).toHaveBeenCalledWith('token-123');
    expect(result).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('resends verification using the supplied email', () => {
    authApiService.resendEmailVerification.mockReturnValue(
      of({ accepted: true, cooldownSeconds: 90 }),
    );

    const service = TestBed.inject(AuthService);
    let result: unknown;

    service.resendEmailVerification('demo@finflow.local').subscribe((value) => {
      result = value;
    });

    expect(authApiService.resendEmailVerification).toHaveBeenCalledWith('demo@finflow.local');
    expect(result).toEqual({ accepted: true, cooldownSeconds: 90 });
  });

  it('revokes the current refresh token and clears both session layers on logout', () => {
    localStorage.setItem(
      'finflow_account_session',
      JSON.stringify(createAccountSession()),
    );

    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const logout$ = new Subject<boolean>();
    authApiService.logout.mockReturnValue(logout$.asObservable());

    const service = TestBed.inject(AuthService);

    service.logout();

    expect(authApiService.logout).toHaveBeenCalledWith('account-refresh-123');
    expect(service.isAuthenticated()).toBe(true);

    logout$.next(true);
    logout$.complete();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.userEmail()).toBeNull();
    expect(service.getAccessToken()).toBeNull();
    expect(localStorage.getItem('finflow_account_session')).toBeNull();
    expect(localStorage.getItem('finflow_workspace_session')).toBeNull();
  });

  it('still clears local auth state if backend logout fails', () => {
    localStorage.setItem(
      'finflow_workspace_session',
      JSON.stringify(createWorkspaceSession()),
    );

    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    authApiService.logout.mockReturnValue(
      throwError(() => new Error('network failed')),
    );

    const service = TestBed.inject(AuthService);

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.userEmail()).toBeNull();
    expect(service.getAccessToken()).toBeNull();
  });
});
