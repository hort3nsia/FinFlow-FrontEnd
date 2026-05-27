import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ApprovalsApiService } from '../../approvals/data/approvals-api.service';
import { NotificationsApiService } from '../../notifications/data/notifications-api.service';
import { ReportingApiService } from '../../reporting/data/reporting-api.service';
import { CurrentSubscriptionFacade } from '../../subscription/data/current-subscription.facade';
import { CurrentWorkspaceFacade } from '../data/current-workspace.facade';
import { DashboardPageComponent } from './dashboard-page.component';

describe('DashboardPageComponent', () => {
  const workspaceState = signal({
    workspace: {
      accountId: 'account-1',
      email: 'director.kim@meridian.test',
      membershipId: 'membership-1',
      role: 'TenantAdmin',
      tenantId: 'tenant-1',
      tenantCode: 'meridian',
      tenantName: 'Meridian Corp',
    },
    loading: false,
    error: null,
  });

  const currentWorkspaceFacade = {
    state: workspaceState.asReadonly(),
    refresh: vi.fn(),
  };

  const proSubscriptionState = {
    subscription: {
      planTier: 'Pro',
      status: 'Active',
      currentPeriodStart: '2026-05-01T00:00:00.000Z',
      currentPeriodEnd: '2026-06-01T00:00:00.000Z',
      entitlements: {
        documentsManualEntryEnabled: true,
        documentsOcrEnabled: true,
        chatbotEnabled: true,
        storageLimitBytes: 10_737_418_240,
        workspaceMonthlyOcrPages: 1000,
        memberMonthlyOcrPages: 100,
        workspaceMonthlyChatbotMessages: 10000,
        memberMonthlyChatbotMessages: 500,
      },
      usage: {
        ocrPagesUsed: 0,
        chatbotMessagesUsed: 0,
        storageUsedBytes: 0,
      },
      currentMemberUsage: {
        ocrPagesUsed: 0,
        chatbotMessagesUsed: 0,
        remainingOcrPages: 100,
        remainingChatbotMessages: 500,
      },
    },
    loading: false,
    error: null,
    tenantId: 'tenant-1',
  };
  let subscriptionState = proSubscriptionState;
  const currentSubscriptionFacade = {
    state: () => subscriptionState,
    ensureLoaded: vi.fn(),
  };

  const reportingApi = {
    expenseSummary: vi.fn(),
    monthlyTrend: vi.fn(),
    topVendors: vi.fn(),
    pendingPaymentQueue: vi.fn(),
    budgetUtilization: vi.fn(),
  };

  const approvalsApi = {
    getApprovalQueue: vi.fn(),
  };

  const notificationsApi = {
    getMyNotifications: vi.fn(),
  };

  const createComponent = (): ComponentFixture<DashboardPageComponent> => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    currentWorkspaceFacade.refresh.mockReset();
    reportingApi.expenseSummary.mockReset();
    reportingApi.monthlyTrend.mockReset();
    reportingApi.topVendors.mockReset();
    reportingApi.pendingPaymentQueue.mockReset();
    reportingApi.budgetUtilization.mockReset();
    approvalsApi.getApprovalQueue.mockReset();
    notificationsApi.getMyNotifications.mockReset();
    currentSubscriptionFacade.ensureLoaded.mockReset();
    subscriptionState = proSubscriptionState;

    reportingApi.expenseSummary.mockReturnValue(
      of({
        expenseCount: 0,
        totalInBaseCurrency: 0,
        baseCurrencyCode: 'VND',
        byCategory: [],
        byDepartment: [],
        byCurrency: [],
      }),
    );
    reportingApi.monthlyTrend.mockReturnValue(of([]));
    reportingApi.topVendors.mockReturnValue(of([]));
    reportingApi.pendingPaymentQueue.mockReturnValue(of([]));
    reportingApi.budgetUtilization.mockReturnValue(of([]));
    notificationsApi.getMyNotifications.mockReturnValue(of([]));
    approvalsApi.getApprovalQueue.mockReturnValue(
      of({
        items: [
          {
            documentId: 'document-1',
            title: 'BÁCH HÓA XANH · 21070052990051966',
            vendorName: 'BÁCH HÓA XANH',
            requester: 'Director Kim',
            requesterEmail: 'director.kim@meridian.test',
            department: 'Finance',
            amount: 187954,
            currency: 'VND',
            expenseDate: '2021-07-16',
            submittedAt: '2026-04-24T16:46:00Z',
            priority: 'Medium',
            status: 'ReadyForApproval',
            policySummary: 'Auto-approved by amount policy',
          },
          {
            documentId: 'document-2',
            title: 'BÁCH HÓA XANH · 21070052990051966',
            vendorName: 'BÁCH HÓA XANH',
            requester: 'Director Kim',
            requesterEmail: 'director.kim@meridian.test',
            department: 'Finance',
            amount: 187954,
            currency: 'VND',
            expenseDate: '2021-07-16',
            submittedAt: '2026-04-24T16:41:00Z',
            priority: 'Medium',
            status: 'ReadyForApproval',
            policySummary: null,
          },
          {
            documentId: 'document-3',
            title: 'abc · abc',
            vendorName: 'abc',
            requester: 'loin2181',
            requesterEmail: 'loin2181@gmail.com',
            department: 'Department unavailable',
            amount: 0.1,
            currency: 'VND',
            expenseDate: '1111-11-11',
            submittedAt: '2026-04-29T17:50:00Z',
            priority: 'Low',
            status: 'ReadyForApproval',
            policySummary: 'Auto-approved',
          },
        ],
        page: 1,
        pageSize: 5,
        totalCount: 3,
        totalPages: 1,
      }),
    );

    TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        provideRouter([]),
        { provide: CurrentWorkspaceFacade, useValue: currentWorkspaceFacade },
        { provide: CurrentSubscriptionFacade, useValue: currentSubscriptionFacade },
        { provide: ReportingApiService, useValue: reportingApi },
        { provide: ApprovalsApiService, useValue: approvalsApi },
        { provide: NotificationsApiService, useValue: notificationsApi },
      ],
    });
  });

  it('surfaces real operational approval data when reporting tables are empty', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(approvalsApi.getApprovalQueue).toHaveBeenCalledWith('PENDING', null, 1, 5);
    expect(text).toContain('Chứng từ chờ duyệt');
    expect(text).toContain('3 chứng từ đang ở hàng đợi phê duyệt');
    expect(text).toContain('Giá trị đang xử lý');
    expect(text).toContain('375.908 ₫');
    expect(text).toContain('BÁCH HÓA XANH');
    expect(text).toContain('abc · abc');
  });

  it('does not expose OCR or AI dashboard actions when Free plan entitlements are disabled', () => {
    subscriptionState = {
      ...proSubscriptionState,
      subscription: {
        ...proSubscriptionState.subscription,
        planTier: 'Free',
        entitlements: {
          ...proSubscriptionState.subscription.entitlements,
          documentsOcrEnabled: false,
          chatbotEnabled: false,
        },
      },
    };

    const fixture = createComponent();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';

    expect(root.querySelector('[data-testid="dashboard-ocr-action"]')).toBeNull();
    expect(root.querySelector('[data-testid="dashboard-chat-action"]')).toBeNull();
    expect(root.querySelector('[data-testid="dashboard-ocr-upgrade-action"]')).not.toBeNull();
    expect(text).toContain('Nâng cấp OCR');
    expect(text).toContain('Nhập tay');
    expect(text).not.toContain('Hỏi trợ lý AI');
    expect(currentSubscriptionFacade.ensureLoaded).toHaveBeenCalledWith('tenant-1');
  });
});
