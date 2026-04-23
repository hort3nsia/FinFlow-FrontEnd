import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { computed, signal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { WorkspaceInfo } from '../../../core/auth/auth.models';
import { AuthenticatedHomePageComponent } from './authenticated-home-page.component';

describe('AuthenticatedHomePageComponent', () => {
  const workspaces = signal<WorkspaceInfo[]>([]);
  const isLoading = signal(false);

  const authService = {
    workspaces,
    workspaceCount: computed(() => workspaces().length),
    hasSingleWorkspace: computed(() => workspaces().length === 1),
    hasMultipleWorkspaces: computed(() => workspaces().length > 1),
    hasNoWorkspaces: computed(() => workspaces().length === 0),
    primaryWorkspace: computed(() => workspaces()[0] ?? null),
    isLoading,
    loadWorkspaces: vi.fn(),
    switchWorkspace: vi.fn(),
    goToDashboard: vi.fn(),
    goToWorkspaceSelection: vi.fn(),
    goToCreateWorkspace: vi.fn(),
  };

  const createWorkspace = (overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo => ({
    workspaceId: 'workspace-1',
    tenantId: 'tenant-1',
    tenantCode: 'alpha',
    tenantName: 'Alpha Finance',
    membershipId: 'membership-1',
    role: 'Owner',
    ...overrides,
  });

  beforeEach(() => {
    workspaces.set([]);
    isLoading.set(false);
    authService.loadWorkspaces.mockReset();
    authService.switchWorkspace.mockReset();
    authService.goToDashboard.mockReset();
    authService.goToWorkspaceSelection.mockReset();
    authService.goToCreateWorkspace.mockReset();

    TestBed.configureTestingModule({
      imports: [AuthenticatedHomePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    });
  });

  it('shows continue and create actions when one workspace exists', () => {
    const primaryWorkspace = createWorkspace();
    const switch$ = new Subject<unknown>();
    authService.loadWorkspaces.mockImplementation(() => {
      workspaces.set([primaryWorkspace]);
      return of([primaryWorkspace]);
    });
    authService.switchWorkspace.mockReturnValue(switch$.asObservable());

    const fixture = TestBed.createComponent(AuthenticatedHomePageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Alpha Finance');
    expect(fixture.nativeElement.textContent).toContain('Vào workspace');
    expect(fixture.nativeElement.textContent).toContain('Chọn workspace');
    expect(fixture.nativeElement.textContent).toContain('Tạo workspace');

    fixture.nativeElement
      .querySelector('[data-testid="authenticated-home-enter-workspace"]')
      .click();

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

  it('shows choose workspace as the primary action when multiple workspaces exist', () => {
    const firstWorkspace = createWorkspace();
    const secondWorkspace = createWorkspace({
      workspaceId: 'workspace-2',
      tenantId: 'tenant-2',
      tenantCode: 'beta',
      tenantName: 'Beta Operations',
      membershipId: 'membership-2',
      role: 'Staff',
    });

    authService.loadWorkspaces.mockImplementation(() => {
      workspaces.set([firstWorkspace, secondWorkspace]);
      return of([firstWorkspace, secondWorkspace]);
    });

    const fixture = TestBed.createComponent(AuthenticatedHomePageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('2 workspace');
    expect(fixture.nativeElement.textContent).toContain('Chọn workspace');

    fixture.nativeElement
      .querySelector('[data-testid="authenticated-home-multiple-choose-workspace"]')
      .click();

    expect(authService.goToWorkspaceSelection).toHaveBeenCalledTimes(1);
  });

  it('shows empty onboarding action when no workspace exists', () => {
    authService.loadWorkspaces.mockImplementation(() => {
      workspaces.set([]);
      return of([]);
    });

    const fixture = TestBed.createComponent(AuthenticatedHomePageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Tạo workspace đầu tiên');
    expect(fixture.nativeElement.textContent).toContain('Chưa có workspace');

    fixture.nativeElement
      .querySelector('[data-testid="authenticated-home-empty-create-workspace"]')
      .click();

    expect(authService.goToCreateWorkspace).toHaveBeenCalledTimes(1);
  });
});
