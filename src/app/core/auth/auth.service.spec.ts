import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthApiService } from './auth-api.service';
import { AuthService } from './auth.service';
import { WorkspaceInfo, WorkspaceSession } from './auth.models';

const createAccountSession = () => ({
  accessToken: 'account-token-123',
  refreshToken: 'account-refresh-123',
  id: 'account-1',
  email: 'demo@finflow.local',
  sessionKind: 'account' as const,
});

const createWorkspaceSession = (overrides: Partial<ReturnType<typeof createWorkspaceSessionBase>> = {}) => ({
  ...createWorkspaceSessionBase(),
  ...overrides,
});

const createWorkspaceSessionBase = () => ({
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

const createWorkspaceInfo = (overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo => ({
  workspaceId: 'workspace-1',
  tenantId: 'tenant-1',
  tenantCode: 'alpha',
  tenantName: 'Alpha Finance',
  membershipId: 'membership-1',
  role: 'Owner',
  ...overrides,
});

describe('AuthService', () => {
  const authApiService = {
    login: vi.fn(),
    register: vi.fn(),
    verifyEmailByToken: vi.fn(),
    verifyEmailByOtp: vi.fn(),
    resendEmailVerification: vi.fn(),
    forgotPassword: vi.fn(),
    verifyPasswordResetToken: vi.fn(),
    resetPasswordByToken: vi.fn(),
    resetPasswordByOtp: vi.fn(),
    refreshToken: vi.fn(),
    logout: vi.fn(),
    createWorkspace: vi.fn(),
    selectWorkspace: vi.fn(),
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

  it('requests a forgot password challenge with the supplied email', () => {
    authApiService.forgotPassword.mockReturnValue(
      of({ accepted: true, cooldownSeconds: 120 }),
    );

    const service = TestBed.inject(AuthService);
    let result: unknown;

    service.forgotPassword('demo@finflow.local').subscribe((value) => {
      result = value;
    });

    expect(authApiService.forgotPassword).toHaveBeenCalledWith('demo@finflow.local');
    expect(result).toEqual({ accepted: true, cooldownSeconds: 120 });
  });

  it('verifies a password reset token without mutating local session state', () => {
    authApiService.verifyPasswordResetToken.mockReturnValue(of(true));

    const service = TestBed.inject(AuthService);
    let result: boolean | undefined;

    service.verifyPasswordResetToken('reset-token-123').subscribe((value) => {
      result = value;
    });

    expect(authApiService.verifyPasswordResetToken).toHaveBeenCalledWith('reset-token-123');
    expect(result).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('resets a password by token without creating a session', () => {
    authApiService.resetPasswordByToken.mockReturnValue(of(true));

    const service = TestBed.inject(AuthService);
    let result: boolean | undefined;

    service.resetPasswordByToken('reset-token-123', 'Pass@word2').subscribe((value) => {
      result = value;
    });

    expect(authApiService.resetPasswordByToken).toHaveBeenCalledWith('reset-token-123', 'Pass@word2');
    expect(result).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('resets a password by otp without creating a session', () => {
    authApiService.resetPasswordByOtp.mockReturnValue(of(true));

    const service = TestBed.inject(AuthService);
    let result: boolean | undefined;

    service.resetPasswordByOtp({
      email: 'demo@finflow.local',
      otp: '654321',
      newPassword: 'Pass@word2',
    }).subscribe((value) => {
      result = value;
    });

    expect(authApiService.resetPasswordByOtp).toHaveBeenCalledWith({
      email: 'demo@finflow.local',
      otp: '654321',
      newPassword: 'Pass@word2',
    });
    expect(result).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('tracks workspace counts and the primary workspace after loading workspaces', () => {
    const loadedWorkspaces = [
      createWorkspaceInfo(),
      createWorkspaceInfo({
        workspaceId: 'workspace-2',
        tenantId: 'tenant-2',
        tenantCode: 'beta',
        tenantName: 'Beta Operations',
        membershipId: 'membership-2',
        role: 'Staff',
      }),
    ];
    authApiService.getMyWorkspaces.mockReturnValue(of(loadedWorkspaces));

    const service = TestBed.inject(AuthService);
    let result: WorkspaceInfo[] | undefined;

    service.loadWorkspaces().subscribe((value) => {
      result = value;
    });

    expect(result).toEqual(loadedWorkspaces);
    expect(service.workspaceCount()).toBe(2);
    expect(service.hasSingleWorkspace()).toBe(false);
    expect(service.hasMultipleWorkspaces()).toBe(true);
    expect(service.hasNoWorkspaces()).toBe(false);
    expect(service.primaryWorkspace()).toEqual(loadedWorkspaces[0]);
  });

  it('navigates to workspace selection and create workspace entry points', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const service = TestBed.inject(AuthService);

    service.goToWorkspaceSelection();
    service.goToCreateWorkspace();

    expect(navigateSpy).toHaveBeenNthCalledWith(1, '/workspaces');
    expect(navigateSpy).toHaveBeenNthCalledWith(2, '/create-workspace');
  });

  it('selects a workspace from an account session and upgrades into a workspace session', () => {
    localStorage.setItem(
      'finflow_account_session',
      JSON.stringify(createAccountSession()),
    );
    authApiService.selectWorkspace.mockReturnValue(of(createWorkspaceSession()));

    const service = TestBed.inject(AuthService);
    let result: WorkspaceSession | undefined;

    service.selectWorkspace('membership-1').subscribe((value: WorkspaceSession) => {
      result = value;
    });

    expect(authApiService.selectWorkspace).toHaveBeenCalledWith('membership-1');
    expect(authApiService.switchWorkspace).not.toHaveBeenCalled();
    expect(result).toEqual(createWorkspaceSession());
    expect(service.currentSessionKind()).toBe('workspace');
    expect(service.getAccessToken()).toBe('workspace-token-123');
  });

  it('clears any stale workspace session when logging into an account session', () => {
    localStorage.setItem(
      'finflow_workspace_session',
      JSON.stringify(createWorkspaceSession({
        accessToken: 'stale-workspace-token',
        refreshToken: 'stale-workspace-refresh',
      })),
    );
    authApiService.login.mockReturnValue(of(createAccountSession()));

    const service = TestBed.inject(AuthService);
    let result: unknown;

    service.login({
      email: 'demo@finflow.local',
      password: 'Pass@word1',
    }).subscribe((value) => {
      result = value;
    });

    expect(result).toEqual(createAccountSession());
    expect(service.currentSessionKind()).toBe('account');
    expect(service.hasWorkspace()).toBe(false);
    expect(service.getAccessToken()).toBe('account-token-123');
    expect(localStorage.getItem('finflow_workspace_session')).toBeNull();
  });

  it('switches workspace with refresh-token rotation when a workspace session is already active', () => {
    localStorage.setItem(
      'finflow_workspace_session',
      JSON.stringify(createWorkspaceSession()),
    );
    authApiService.switchWorkspace.mockReturnValue(
      of(
        createWorkspaceSession({
          membershipId: 'membership-2',
          role: 'Staff',
          idTenant: 'tenant-2',
        }),
      ),
    );

    const service = TestBed.inject(AuthService);

    service.selectWorkspace('membership-2').subscribe();

    expect(authApiService.selectWorkspace).not.toHaveBeenCalled();
    expect(authApiService.switchWorkspace).toHaveBeenCalledWith('membership-2', 'workspace-refresh-123');
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

  it('clears only the workspace session and returns to workspace selection when resetting workspace context', () => {
    localStorage.setItem(
      'finflow_account_session',
      JSON.stringify(createAccountSession()),
    );
    localStorage.setItem(
      'finflow_workspace_session',
      JSON.stringify(createWorkspaceSession()),
    );

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const service = TestBed.inject(AuthService);

    service.resetWorkspaceContext({ redirectToSelection: true });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentSessionKind()).toBe('account');
    expect(service.hasWorkspace()).toBe(false);
    expect(service.getAccessToken()).toBe('account-token-123');
    expect(localStorage.getItem('finflow_account_session')).not.toBeNull();
    expect(localStorage.getItem('finflow_workspace_session')).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/workspaces'], {
      queryParams: { mode: 'manage' },
    });
  });
});
