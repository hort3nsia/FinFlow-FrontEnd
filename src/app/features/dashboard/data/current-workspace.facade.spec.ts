import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { CurrentWorkspaceApiService } from './current-workspace.api.service';
import { CurrentWorkspaceFacade } from './current-workspace.facade';

describe('CurrentWorkspaceFacade', () => {
  let request$: Subject<unknown>;
  let authService: {
    workspaceSession: () => unknown;
  };
  let currentWorkspaceApiService: {
    getCurrentWorkspace: () => Observable<unknown>;
  };

  beforeEach(() => {
    request$ = new Subject<unknown>();
    authService = {
      workspaceSession: () => ({
        accessToken: 'workspace-access',
        refreshToken: 'workspace-refresh',
        id: 'account-1',
        membershipId: 'membership-123',
        email: 'demo@finflow.local',
        role: 'TENANT_ADMIN',
        idTenant: 'tenant-123',
        sessionKind: 'workspace',
      }),
    };
    currentWorkspaceApiService = {
      getCurrentWorkspace: () => request$.asObservable(),
    };

    TestBed.configureTestingModule({
      providers: [
        CurrentWorkspaceFacade,
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: CurrentWorkspaceApiService,
          useValue: currentWorkspaceApiService,
        },
      ],
    });
  });

  it('starts idle and refreshes workspace data on demand', () => {
    const facade = TestBed.inject(CurrentWorkspaceFacade);

    expect(facade.state().loading).toBe(false);
    expect(facade.state().error).toBeNull();
    expect(facade.state().workspace).toBeNull();

    facade.refresh();

    expect(facade.state().loading).toBe(true);

    request$.next({
      accountId: 'acc-123',
      email: 'demo@finflow.local',
      membershipId: 'membership-123',
      role: 'TENANT_ADMIN',
      tenantId: 'tenant-123',
      tenantCode: 'finflow',
      tenantName: 'FinFlow Demo Tenant',
    });
    request$.complete();

    expect(facade.state()).toEqual({
      loading: false,
      error: null,
      statusLabel: 'Backend-backed workspace snapshot',
      workspace: {
        accountId: 'acc-123',
        email: 'demo@finflow.local',
        membershipId: 'membership-123',
        role: 'TENANT_ADMIN',
        tenantId: 'tenant-123',
        tenantCode: 'finflow',
        tenantName: 'FinFlow Demo Tenant',
      },
    });
  });

  it('captures request errors in the workspace state', () => {
    const facade = TestBed.inject(CurrentWorkspaceFacade);

    facade.refresh();
    request$.error(new Error('Workspace context unavailable.'));

    expect(facade.state().loading).toBe(false);
    expect(facade.state().workspace).toBeNull();
    expect(facade.state().error).toBe('Workspace context unavailable.');
  });

  it('stays idle when there is no active workspace session', () => {
    authService.workspaceSession = () => null;
    const getCurrentWorkspaceSpy = vi.spyOn(currentWorkspaceApiService, 'getCurrentWorkspace');
    const facade = TestBed.inject(CurrentWorkspaceFacade);

    facade.refresh();

    expect(getCurrentWorkspaceSpy).not.toHaveBeenCalled();
    expect(facade.state()).toEqual({
      loading: false,
      error: null,
      statusLabel: 'Backend-backed workspace snapshot',
      workspace: null,
    });
  });
});
