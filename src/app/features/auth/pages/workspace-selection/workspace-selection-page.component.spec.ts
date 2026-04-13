import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import { WorkspaceSelectionPageComponent } from './workspace-selection-page.component';

describe('WorkspaceSelectionPageComponent', () => {
  const authService = {
    loadWorkspaces: vi.fn(),
    switchWorkspace: vi.fn(),
    goToDashboard: vi.fn(),
  };

  beforeEach(() => {
    authService.loadWorkspaces.mockReset();
    authService.switchWorkspace.mockReset();
    authService.goToDashboard.mockReset();

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
      ]),
    );

    const fixture = TestBed.createComponent(WorkspaceSelectionPageComponent);
    fixture.detectChanges();

    expect(authService.loadWorkspaces).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Alpha Finance');
    expect(fixture.nativeElement.textContent).toContain('alpha');
  });

  it('shows the empty state when the account has no workspaces yet', () => {
    authService.loadWorkspaces.mockReturnValue(of([]));

    const fixture = TestBed.createComponent(WorkspaceSelectionPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Create your first workspace');
    expect(fixture.nativeElement.textContent).toContain('Create workspace');
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

  it('switches the selected workspace then enters the dashboard', () => {
    const switch$ = new Subject<unknown>();

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
    authService.switchWorkspace.mockReturnValue(switch$.asObservable());

    const fixture = TestBed.createComponent(WorkspaceSelectionPageComponent);
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="workspace-row-membership-1"]'))
      .triggerEventHandler('click', {});

    expect(authService.switchWorkspace).toHaveBeenCalledWith('membership-1');

    switch$.next({
      accessToken: 'workspace-access',
      refreshToken: 'workspace-refresh',
      id: 'account-1',
      membershipId: 'membership-1',
      email: 'demo@finflow.local',
      role: 'Owner',
      idTenant: 'tenant-1',
      sessionKind: 'workspace',
    });
    switch$.complete();

    expect(authService.goToDashboard).toHaveBeenCalledTimes(1);
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
      ]),
    );
    authService.switchWorkspace.mockReturnValue(
      throwError(() => new Error('Workspace switch failed')),
    );

    const fixture = TestBed.createComponent(WorkspaceSelectionPageComponent);
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="workspace-row-membership-1"]'))
      .triggerEventHandler('click', {});

    fixture.detectChanges();

    expect(authService.goToDashboard).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Workspace switch failed');
  });

  it('opens the create workspace flow from the hub CTA', async () => {
    authService.loadWorkspaces.mockReturnValue(of([]));
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(WorkspaceSelectionPageComponent);
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="create-workspace-cta"]'))
      .triggerEventHandler('click', {});

    expect(router.navigateByUrl).toHaveBeenCalledWith('/create-workspace');
  });
});
