import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import { WorkspaceSelectionPageComponent } from './workspace-selection-page.component';

describe('WorkspaceSelectionPageComponent', () => {
  const authService = {
    userEmail: () => 'demo@finflow.local',
    loadWorkspaces: vi.fn(),
    selectWorkspace: vi.fn(),
    goToDashboard: vi.fn(),
    goToCreateWorkspace: vi.fn(),
    logout: vi.fn(),
  };

  beforeEach(() => {
    authService.loadWorkspaces.mockReset();
    authService.selectWorkspace.mockReset();
    authService.goToDashboard.mockReset();
    authService.goToCreateWorkspace.mockReset();
    authService.logout.mockReset();

    TestBed.configureTestingModule({
      imports: [WorkspaceSelectionPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    });
  });

  it('loads workspaces on init and renders them as selectable rows', () => {
    authService.loadWorkspaces.mockReturnValue(
      of([
        {
          workspaceId: 'workspace-1',
          tenantId: 'tenant-1',
          tenantCode: 'alpha',
          tenantName: 'Alpha Finance',
          membershipId: 'membership-1',
          role: 'Owner',
        },
        {
          workspaceId: 'workspace-2',
          tenantId: 'tenant-2',
          tenantCode: 'beta',
          tenantName: 'Beta Ops',
          membershipId: 'membership-2',
          role: 'Member',
        },
      ]),
    );

    const fixture = TestBed.createComponent(WorkspaceSelectionPageComponent);
    fixture.detectChanges();

    expect(authService.loadWorkspaces).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Chọn workspace để tiếp tục');
    expect(fixture.debugElement.queryAll(By.css('[data-testid="workspace-row"]')).length).toBe(2);
  });

  it('redirects the account to create workspace when no workspace exists', () => {
    authService.loadWorkspaces.mockReturnValue(of([]));

    const fixture = TestBed.createComponent(WorkspaceSelectionPageComponent);
    fixture.detectChanges();

    expect(authService.goToCreateWorkspace).toHaveBeenCalledTimes(1);
  });

  it('retries loading after a failed workspace query', () => {
    authService.loadWorkspaces
      .mockReturnValueOnce(throwError(() => new Error('Unable to load workspaces')))
      .mockReturnValueOnce(of([]));

    const fixture = TestBed.createComponent(WorkspaceSelectionPageComponent);
    fixture.detectChanges();
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="retry-load-workspaces"]'))
      .triggerEventHandler('click', {});

    fixture.detectChanges();

    expect(authService.loadWorkspaces).toHaveBeenCalledTimes(2);
  });

  it('selects the chosen workspace then enters the dashboard', () => {
    const select$ = new Subject<unknown>();

    authService.loadWorkspaces.mockReturnValue(
      of([
        {
          workspaceId: 'workspace-1',
          tenantId: 'tenant-1',
          tenantCode: 'alpha',
          tenantName: 'Alpha Finance',
          membershipId: 'membership-1',
          role: 'Owner',
        },
        {
          workspaceId: 'workspace-2',
          tenantId: 'tenant-2',
          tenantCode: 'beta',
          tenantName: 'Beta Ops',
          membershipId: 'membership-2',
          role: 'Member',
        },
      ]),
    );
    authService.selectWorkspace.mockReturnValue(select$.asObservable());

    const fixture = TestBed.createComponent(WorkspaceSelectionPageComponent);
    fixture.detectChanges();

    fixture.debugElement
      .queryAll(By.css('[data-testid="workspace-row"]'))[0]
      .triggerEventHandler('click', {});

    expect(authService.selectWorkspace).toHaveBeenCalledWith('membership-1');

    select$.next({
      accessToken: 'workspace-access',
      refreshToken: 'workspace-refresh',
      id: 'account-1',
      membershipId: 'membership-1',
      email: 'demo@finflow.local',
      role: 'Owner',
      idTenant: 'tenant-1',
      sessionKind: 'workspace',
    });
    select$.complete();

    expect(authService.goToDashboard).toHaveBeenCalledTimes(1);
  });

  it('keeps a single workspace visible so the user can still choose it explicitly', () => {
    authService.loadWorkspaces.mockReturnValue(
      of([
        {
          workspaceId: 'workspace-1',
          tenantId: 'tenant-1',
          tenantCode: 'alpha',
          tenantName: 'Alpha Finance',
          membershipId: 'membership-1',
          role: 'Owner',
        },
      ]),
    );

    const fixture = TestBed.createComponent(WorkspaceSelectionPageComponent);
    fixture.detectChanges();

    expect(authService.selectWorkspace).not.toHaveBeenCalled();
    expect(authService.goToDashboard).not.toHaveBeenCalled();
    expect(fixture.debugElement.queryAll(By.css('[data-testid="workspace-row"]')).length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Alpha Finance');
  });

  it('keeps the user on the hub and shows an error if switching fails', () => {
    authService.loadWorkspaces.mockReturnValue(
      of([
        {
          workspaceId: 'workspace-1',
          tenantId: 'tenant-1',
          tenantCode: 'alpha',
          tenantName: 'Alpha Finance',
          membershipId: 'membership-1',
          role: 'Owner',
        },
        {
          workspaceId: 'workspace-2',
          tenantId: 'tenant-2',
          tenantCode: 'beta',
          tenantName: 'Beta Ops',
          membershipId: 'membership-2',
          role: 'Member',
        },
      ]),
    );
    authService.selectWorkspace.mockReturnValue(
      throwError(() => new Error('Workspace switch failed')),
    );

    const fixture = TestBed.createComponent(WorkspaceSelectionPageComponent);
    fixture.detectChanges();

    fixture.debugElement
      .queryAll(By.css('[data-testid="workspace-row"]'))[0]
      .triggerEventHandler('click', {});

    fixture.detectChanges();

    expect(authService.goToDashboard).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Workspace switch failed');
  });

  it('opens the create workspace flow from the hub CTA', async () => {
    authService.loadWorkspaces.mockReturnValue(
      of([
        {
          workspaceId: 'workspace-1',
          tenantId: 'tenant-1',
          tenantCode: 'alpha',
          tenantName: 'Alpha Finance',
          membershipId: 'membership-1',
          role: 'Owner',
        },
        {
          workspaceId: 'workspace-2',
          tenantId: 'tenant-2',
          tenantCode: 'beta',
          tenantName: 'Beta Ops',
          membershipId: 'membership-2',
          role: 'Member',
        },
      ]),
    );

    const fixture = TestBed.createComponent(WorkspaceSelectionPageComponent);
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="create-workspace-cta"]'))
      .triggerEventHandler('click', {});

    expect(authService.goToCreateWorkspace).toHaveBeenCalledTimes(1);
  });
});
