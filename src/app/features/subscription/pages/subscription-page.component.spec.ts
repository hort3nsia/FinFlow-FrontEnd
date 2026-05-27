import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import { MembersApiService } from '../../members/data/members-api.service';
import { CurrentSubscriptionFacade } from '../data/current-subscription.facade';
import { SubscriptionApiService } from '../data/subscription-api.service';
import { SubscriptionPageComponent } from './subscription-page.component';

describe('SubscriptionPageComponent', () => {
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

  const subscriptionState = signal({
    subscription: {
      planTier: 'Pro',
      status: 'Active',
      currentPeriodStart: '2026-05-01T00:00:00Z',
      currentPeriodEnd: '2026-06-01T00:00:00Z',
      entitlements: {
        documentsManualEntryEnabled: true,
        documentsOcrEnabled: true,
        chatbotEnabled: true,
        storageLimitBytes: 5_368_709_120,
        workspaceMonthlyOcrPages: 2_000,
        memberMonthlyOcrPages: 50,
        workspaceMonthlyChatbotMessages: 1_000,
        memberMonthlyChatbotMessages: 100,
      },
      usage: {
        ocrPagesUsed: 847,
        chatbotMessagesUsed: 234,
        storageUsedBytes: 1_288_490_188,
      },
      currentMemberUsage: {
        ocrPagesUsed: 47,
        chatbotMessagesUsed: 23,
        remainingOcrPages: 3,
        remainingChatbotMessages: 77,
      },
    },
    loading: false,
    error: null,
    tenantId: 'tenant-1',
  });

  const currentSubscriptionFacade = {
    state: subscriptionState.asReadonly(),
    ensureLoaded: vi.fn(),
    refresh: vi.fn(),
  };

  const subscriptionApi = {
    cancelSubscription: vi.fn(),
    changePlan: vi.fn(),
  };

  const membersApi = {
    getWorkspaceMembers: vi.fn(),
  };

  const createComponent = (): ComponentFixture<SubscriptionPageComponent> => {
    const fixture = TestBed.createComponent(SubscriptionPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    workspaceState.set({
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
    subscriptionState.set({
      subscription: {
        planTier: 'Pro',
        status: 'Active',
        currentPeriodStart: '2026-05-01T00:00:00Z',
        currentPeriodEnd: '2026-06-01T00:00:00Z',
        entitlements: {
          documentsManualEntryEnabled: true,
          documentsOcrEnabled: true,
          chatbotEnabled: true,
          storageLimitBytes: 5_368_709_120,
          workspaceMonthlyOcrPages: 2_000,
          memberMonthlyOcrPages: 50,
          workspaceMonthlyChatbotMessages: 1_000,
          memberMonthlyChatbotMessages: 100,
        },
        usage: {
          ocrPagesUsed: 847,
          chatbotMessagesUsed: 234,
          storageUsedBytes: 1_288_490_188,
        },
        currentMemberUsage: {
          ocrPagesUsed: 47,
          chatbotMessagesUsed: 23,
          remainingOcrPages: 3,
          remainingChatbotMessages: 77,
        },
      },
      loading: false,
      error: null,
      tenantId: 'tenant-1',
    });
    currentSubscriptionFacade.ensureLoaded.mockReset();
    currentSubscriptionFacade.refresh.mockReset();
    subscriptionApi.cancelSubscription.mockReset();
    subscriptionApi.changePlan.mockReset();
    subscriptionApi.changePlan.mockReturnValue(of({ success: true, message: 'Plan changed.' }));
    membersApi.getWorkspaceMembers.mockReset();
    membersApi.getWorkspaceMembers.mockReturnValue(
      of([
        {
          id: 'membership-1',
          accountId: 'account-1',
          tenantId: 'tenant-1',
          departmentId: 'dept-finance',
          fullName: 'Director Kim',
          email: 'director.kim@meridian.test',
          departmentName: 'Tài chính',
          role: 'TenantAdmin',
          isOwner: true,
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
          lastActiveAt: '2026-05-20T00:00:00Z',
          deactivatedAt: null,
          deactivatedBy: null,
          deactivatedReason: null,
        },
        {
          id: 'membership-2',
          accountId: 'account-2',
          tenantId: 'tenant-1',
          departmentId: 'dept-ops',
          fullName: 'Operator Linh',
          email: 'linh@meridian.test',
          departmentName: 'Vận hành',
          role: 'Staff',
          isOwner: false,
          isActive: true,
          createdAt: '2026-02-01T00:00:00Z',
          lastActiveAt: null,
          deactivatedAt: null,
          deactivatedBy: null,
          deactivatedReason: null,
        },
      ]),
    );

    TestBed.configureTestingModule({
      imports: [SubscriptionPageComponent],
      providers: [
        { provide: CurrentWorkspaceFacade, useValue: { state: workspaceState.asReadonly() } },
        { provide: CurrentSubscriptionFacade, useValue: currentSubscriptionFacade },
        { provide: SubscriptionApiService, useValue: subscriptionApi },
        { provide: MembersApiService, useValue: membersApi },
      ],
    });
  });

  it('renders MagicPath-style subscription workspace with real subscription and member data', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(currentSubscriptionFacade.ensureLoaded).toHaveBeenCalledWith('tenant-1');
    expect(membersApi.getWorkspaceMembers).toHaveBeenCalledWith('tenant-1');
    expect(text).toContain('Gói & Hạn mức sử dụng');
    expect(text).toContain('Theo dõi mức sử dụng workspace và quản lý gói cước');
    expect(text).toContain('Pro');
    expect(text).toContain('Đang hoạt động');
    expect(text).toContain('Plan overview');
    expect(text).toContain('Kỳ hiện tại');
    expect(text).toContain('Thanh toán');
    expect(text).toContain('Chi tiết gói');
    expect(text).toContain('Tự động gia hạn vào 01/06/2026');
    expect(text).toContain('Hạn mức Workspace tháng này');
    expect(text).toContain('OCR Pages');
    expect(text).toContain('847 / 2.000 trang');
    expect(text).toContain('Chatbot Messages');
    expect(text).toContain('234 / 1.000 tin nhắn');
    expect(text).toContain('Storage');
    expect(text).toContain('Hạn mức theo thành viên');
    expect(text).toContain('Tất cả phòng ban');
    expect(text).toContain('Sử dụng cao nhất');
    expect(text).toContain('Director Kim');
    expect(text).toContain('47/50');
    expect(text).toContain('Operator Linh');
    expect(text).toContain('Chưa có telemetry usage');
    expect(text).toContain('So sánh các gói');
    expect(text).toContain('Lịch sử thanh toán');
    expect(text).toContain('Chưa có dữ liệu hóa đơn từ backend');
  });

  it('upgrades plan through subscription mutation instead of showing a coming-soon button', () => {
    const fixture = createComponent();
    const root = fixture.nativeElement as HTMLElement;

    const upgradeButton = [...root.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Nâng cấp'),
    ) as HTMLButtonElement;
    upgradeButton.click();
    fixture.detectChanges();

    const businessButton = [...root.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Chuyển sang Business'),
    ) as HTMLButtonElement;
    expect(businessButton.disabled).toBe(false);

    businessButton.click();
    fixture.detectChanges();

    expect(subscriptionApi.changePlan).toHaveBeenCalledWith('Enterprise');
    expect(currentSubscriptionFacade.refresh).toHaveBeenCalled();
  });

  it('does not render cancel action for an already cancelled paid subscription', () => {
    subscriptionState.set({
      ...subscriptionState(),
      subscription: {
        ...subscriptionState().subscription!,
        planTier: 'Pro',
        status: 'Cancelled',
      },
    });

    const fixture = createComponent();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Đã huỷ');
    expect(root.textContent).toContain('Gói đã được hủy');
    expect(
      [...root.querySelectorAll('button')].some((button) =>
        button.textContent?.includes('Hủy gói'),
      ),
    ).toBe(false);
  });

  it('opens upgrade dialog with the next recommended plan without changing plan immediately', () => {
    subscriptionState.set({
      ...subscriptionState(),
      subscription: {
        ...subscriptionState().subscription!,
        planTier: 'Free',
        status: 'Active',
      },
    });

    const fixture = createComponent();
    const root = fixture.nativeElement as HTMLElement;

    const upgradeButton = [...root.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Nâng cấp'),
    ) as HTMLButtonElement;
    upgradeButton.click();
    fixture.detectChanges();

    expect(subscriptionApi.changePlan).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Gợi ý tiếp theo');
    expect(root.textContent).toContain('Chuyển sang Pro');
  });

  it('uses non-billing wording for Free plan period and quota reset', () => {
    subscriptionState.set({
      ...subscriptionState(),
      subscription: {
        ...subscriptionState().subscription!,
        planTier: 'Free',
        status: 'Active',
        entitlements: {
          ...subscriptionState().subscription!.entitlements,
          workspaceMonthlyOcrPages: 0,
          workspaceMonthlyChatbotMessages: 0,
          memberMonthlyOcrPages: 0,
          memberMonthlyChatbotMessages: 0,
        },
      },
    });

    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Kỳ sử dụng');
    expect(text).toContain('Reset hạn mức vào 01/06/2026');
    expect(text).toContain('Không phát sinh thanh toán');
    expect(text).toContain('Tổng cho toàn bộ workspace · Reset hạn mức vào 01/06/2026');
    expect(text).not.toContain('Tự động gia hạn vào 01/06/2026');
    expect(text).not.toContain('Theo chu kỳ workspace');
  });
});
