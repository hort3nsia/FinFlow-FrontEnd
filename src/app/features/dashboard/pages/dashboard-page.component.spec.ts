import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import {
  CurrentWorkspaceFacade,
  type CurrentWorkspaceState,
} from '../data/current-workspace.facade';
import { DashboardPageComponent } from './dashboard-page.component';

const createWorkspaceState = (): CurrentWorkspaceState => ({
  loading: false,
  error: null,
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

  const queryText = (fixture: { nativeElement: HTMLElement }, selector: string) =>
    fixture.nativeElement.querySelector(selector)?.textContent?.trim();

  beforeEach(async () => {
    state.set(createWorkspaceState());
    currentWorkspaceFacade.refresh.mockReset();

    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: CurrentWorkspaceFacade,
          useValue: currentWorkspaceFacade,
        },
      ],
    }).compileComponents();
  });

  it('renders the workspace overview surface', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();

    expect(queryText(fixture, '[data-testid="overview-title"]')).toBe('Workspace Overview');
    expect(queryText(fixture, '[data-testid="overview-copy"]')).toContain(
      'Operational task management and document processing',
    );
    expect(queryText(fixture, '[data-testid="overview-cta-upload"]')).toBe('Upload Docs');
    expect(queryText(fixture, '[data-testid="overview-cta-expense"]')).toBe('New Expense');
    expect(fixture.nativeElement.textContent).not.toContain('Backend-backed workspace snapshot');
    expect(fixture.nativeElement.textContent).toContain('Finance Workspace');
    expect(fixture.nativeElement.textContent).toContain('Operating in FinFlow Demo Tenant');
  });

  it('renders explicit layout zones for responsive overview composition', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.dashboard-page__hero-row')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.dashboard-page__overview-main')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.dashboard-page__overview-rail')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.dashboard-page__summary-row')).toBeTruthy();
  });

  it('renders finance operations KPI cards', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();

    expect(queryText(fixture, '[data-testid="kpi-documents"] .dashboard-page__kpi-label')).toBe(
      'Documents Pending Review',
    );
    expect(queryText(fixture, '[data-testid="kpi-approvals"] .dashboard-page__kpi-label')).toBe(
      'Approvals Waiting',
    );
    expect(queryText(fixture, '[data-testid="kpi-expenses"] .dashboard-page__kpi-label')).toBe(
      'Flagged Expenses',
    );
    expect(queryText(fixture, '[data-testid="kpi-ocr"] .dashboard-page__kpi-label')).toBe(
      'OCR Extraction Accuracy',
    );
  });

  it('renders recent activity, priority actions, spend trend, and workspace health', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();

    expect(queryText(fixture, '[data-testid="activity-title"]')).toBe('Recent Workspace Activity');
    expect(queryText(fixture, '[data-testid="priority-actions-title"]')).toBe('Priority Actions');
    expect(queryText(fixture, '[data-testid="spend-trend-title"]')).toBe('7-Day Spend Trend');
    expect(queryText(fixture, '[data-testid="workspace-health-title"]')).toBe('Workspace Health');

    expect(fixture.nativeElement.textContent).toContain('Review incoming documents');
    expect(fixture.nativeElement.textContent).toContain('Process pending approvals');
    expect(fixture.nativeElement.textContent).toContain('Review flagged expenses');
    expect(fixture.nativeElement.textContent).toContain('Reconcile OCR exceptions');
  });

  it('renders a lightweight recent expenses summary', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();

    expect(queryText(fixture, '[data-testid="recent-expenses-title"]')).toBe(
      'Recent Expenses Summary',
    );
    expect(fixture.nativeElement.textContent).toContain('AWS Infrastructure');
    expect(fixture.nativeElement.textContent).toContain('United Airlines');
    expect(fixture.nativeElement.textContent).toContain('Blue Ginger Bistro');
  });

  it('renders the loading state', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    state.set({
      loading: true,
      error: null,
      workspace: null,
    });
    fixture.detectChanges();

    expect(queryText(fixture, '[data-testid="workspace-loading"]')).toBe(
      'Loading workspace overview...',
    );
  });

  it('renders the error state', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    state.set({
      loading: false,
      error: 'Workspace context unavailable.',
      workspace: null,
    });
    fixture.detectChanges();

    expect(queryText(fixture, '[data-testid="overview-title"]')).toBe('Workspace Overview');
    expect(queryText(fixture, '[data-testid="workspace-error"]')).toBe(
      'Workspace context unavailable.',
    );
    expect(queryText(fixture, '[data-testid="priority-actions-title"]')).toBe('Priority Actions');
  });

  it('refreshes the workspace when the dashboard is entered', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();

    expect(currentWorkspaceFacade.refresh).toHaveBeenCalledTimes(1);
  });
});
