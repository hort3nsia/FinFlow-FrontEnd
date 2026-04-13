import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import {
  CurrentWorkspaceFacade,
  type CurrentWorkspaceState,
} from '../data/current-workspace.facade';
import { DashboardPageComponent } from './dashboard-page.component';

const createWorkspaceState = (): CurrentWorkspaceState => ({
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

describe('DashboardPageComponent', () => {
  const state = signal(createWorkspaceState());
  const currentWorkspaceFacade = {
    state,
    refresh: vi.fn(),
  };

  const getField = (fixture: { nativeElement: HTMLElement }, testId: string) =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;

  const expectField = (
    fixture: { nativeElement: HTMLElement },
    testId: string,
    label: string,
    value: string,
  ) => {
    const field = getField(fixture, testId);

    expect(field).not.toBeNull();
    expect(field?.querySelector('.dashboard-page__label')?.textContent?.trim()).toBe(label);
    expect(field?.querySelector('.dashboard-page__value')?.textContent?.trim()).toBe(value);
  };

  beforeEach(async () => {
    state.set(createWorkspaceState());
    currentWorkspaceFacade.refresh.mockReset();

    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        {
          provide: CurrentWorkspaceFacade,
          useValue: currentWorkspaceFacade,
        },
      ],
    }).compileComponents();
  });

  it('renders the current workspace summary', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();

    expect(getField(fixture, 'workspace-status')?.textContent?.trim()).toBe(
      'Backend-backed workspace snapshot',
    );
    expectField(fixture, 'workspace-field-account', 'Account ID', 'acc-123');
    expectField(fixture, 'workspace-field-email', 'Email', 'demo@finflow.local');
    expectField(fixture, 'workspace-field-role', 'Role', 'TENANT_ADMIN');
    expectField(fixture, 'workspace-field-membership', 'Membership ID', 'membership-123');
    expectField(fixture, 'workspace-field-tenant-id', 'Tenant ID', 'tenant-123');
    expectField(fixture, 'workspace-field-tenant-code', 'Tenant Code', 'finflow');
    expectField(fixture, 'workspace-field-tenant-name', 'Tenant Name', 'FinFlow Demo Tenant');
  });

  it('renders the loading state', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    state.set({
      loading: true,
      error: null,
      statusLabel: 'Backend-backed workspace snapshot',
      workspace: null,
    });
    fixture.detectChanges();

    expect(getField(fixture, 'workspace-status')?.textContent?.trim()).toBe(
      'Backend-backed workspace snapshot',
    );
    expect(getField(fixture, 'workspace-loading')?.textContent?.trim()).toBe('Loading current workspace...');
  });

  it('renders the error state', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    state.set({
      loading: false,
      error: 'Workspace context unavailable.',
      statusLabel: 'Backend-backed workspace snapshot',
      workspace: null,
    });
    fixture.detectChanges();

    expect(getField(fixture, 'workspace-status')?.textContent?.trim()).toBe(
      'Backend-backed workspace snapshot',
    );
    expect(getField(fixture, 'workspace-error')?.textContent?.trim()).toBe('Workspace context unavailable.');
  });

  it('refreshes the workspace when the dashboard is entered', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();

    expect(currentWorkspaceFacade.refresh).toHaveBeenCalledTimes(1);
  });
});
