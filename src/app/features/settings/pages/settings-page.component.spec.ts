import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import { CurrentSubscriptionFacade } from '../../subscription/data/current-subscription.facade';
import { SettingsApiService } from '../data/settings-api.service';
import { SettingsPageComponent } from './settings-page.component';

describe('SettingsPageComponent', () => {
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
        storageLimitBytes: 10_737_418_240,
        workspaceMonthlyOcrPages: 2_000,
        memberMonthlyOcrPages: 100,
        workspaceMonthlyChatbotMessages: 1_000,
        memberMonthlyChatbotMessages: 200,
      },
      usage: {
        ocrPagesUsed: 847,
        chatbotMessagesUsed: 234,
        storageUsedBytes: 1_288_490_188,
      },
      currentMemberUsage: {
        ocrPagesUsed: 47,
        chatbotMessagesUsed: 23,
        remainingOcrPages: 53,
        remainingChatbotMessages: 177,
      },
    },
    loading: false,
    error: null,
    tenantId: 'tenant-1',
  });

  const settings = {
    id: 'settings-1',
    branding: {
      logoUrl: 'https://cdn.example.com/logo.svg',
      faviconUrl: null,
      primaryColor: '#2563eb',
      companyDisplayName: 'Meridian Finance',
      locale: 'vi-VN',
      timezone: 'Asia/Ho_Chi_Minh',
    },
    approvalPolicy: {
      autoApproveThreshold: 500000,
      escalationThreshold: 5000000,
      escalationApproverRole: 'TenantAdmin',
      requireDifferentApprover: true,
      maxApprovalAgeHours: 48,
      isEscalationEnabled: true,
    },
    budgetPolicy: {
      defaultEnforcementMode: 'SoftBlock',
      defaultCarryOverPercent: 15,
      warningThreshold1: 70,
      warningThreshold2: 90,
    },
    reimbursementPolicy: {
      maxClaimAmount: 20000000,
      receiptRequiredAbove: 500000,
    },
    notificationPreferences: {
      emailDigestEnabled: true,
      emailDigestFrequency: 'weekly',
    },
    updatedAt: '2026-05-24T09:30:00Z',
  };

  const settingsApi = {
    getSettings: vi.fn(),
    updateBranding: vi.fn(),
    updateApprovalPolicy: vi.fn(),
    updateBudgetPolicy: vi.fn(),
    updateReimbursementPolicy: vi.fn(),
    updateNotificationPreferences: vi.fn(),
    uploadBrandingAsset: vi.fn(),
  };

  const currentSubscriptionFacade = {
    state: subscriptionState.asReadonly(),
    ensureLoaded: vi.fn(),
    refresh: vi.fn(),
  };

  const createComponent = (): ComponentFixture<SettingsPageComponent> => {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    settingsApi.getSettings.mockReset();
    settingsApi.updateBranding.mockReset();
    settingsApi.updateApprovalPolicy.mockReset();
    settingsApi.updateBudgetPolicy.mockReset();
    settingsApi.updateReimbursementPolicy.mockReset();
    settingsApi.updateNotificationPreferences.mockReset();
    settingsApi.uploadBrandingAsset.mockReset();
    currentSubscriptionFacade.ensureLoaded.mockReset();
    currentSubscriptionFacade.refresh.mockReset();
    settingsApi.getSettings.mockReturnValue(of(settings));

    TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [
        { provide: SettingsApiService, useValue: settingsApi },
        { provide: CurrentWorkspaceFacade, useValue: { state: workspaceState.asReadonly() } },
        { provide: CurrentSubscriptionFacade, useValue: currentSubscriptionFacade },
        provideRouter([]),
      ],
    });
  });

  it('renders a MagicPath-style settings workspace with real settings and subscription data', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(settingsApi.getSettings).toHaveBeenCalledOnce();
    expect(currentSubscriptionFacade.ensureLoaded).toHaveBeenCalledWith('tenant-1');
    expect(text).toContain('Cấu hình');
    expect(text).toContain('Cấu hình tổ chức');
    expect(text).toContain('Meridian Finance');
    expect(text).toContain('TenantAdmin');
    expect(text).toContain('Cập nhật cuối');
    expect(text).toContain('Thương hiệu & vùng');
    expect(text).toContain('Phê duyệt');
    expect(text).toContain('Ngân sách');
    expect(text).toContain('Hoàn tiền');
    expect(text).toContain('Thông báo');
    expect(text).toContain('Hạn mức');
    expect(text).toContain('SoftBlock');
    expect(text).toContain('48 giờ');
    expect(text).toContain('Digest hằng tuần');
    expect(text).toContain('Pro');
    expect(text).toContain('847 / 2.000 trang');
    expect(text).toContain('234 / 1.000 tin');
    expect(text).toContain('Tải logo');
    expect(text).toContain('Tải favicon');
    expect(text).not.toContain('URL logo');
    expect(text).not.toContain('URL favicon');
  });

  it('uploads a selected logo image and persists the returned asset url on save', () => {
    const uploadedLogoUrl = '/uploads/tenant-branding/tenant-1/logo-123.png';
    settingsApi.uploadBrandingAsset.mockReturnValue(of({ url: uploadedLogoUrl }));
    settingsApi.updateBranding.mockReturnValue(
      of({
        ...settings,
        branding: {
          ...settings.branding,
          logoUrl: uploadedLogoUrl,
        },
      }),
    );
    const fixture = createComponent();
    const component = fixture.componentInstance as unknown as {
      uploadBrandingAsset(kind: 'logo' | 'favicon', event: Event): void;
      saveBranding(): void;
    };
    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });

    component.uploadBrandingAsset('logo', { target: input } as unknown as Event);
    component.saveBranding();

    expect(settingsApi.uploadBrandingAsset).toHaveBeenCalledWith('logo', file);
    expect(settingsApi.updateBranding).toHaveBeenCalledWith(
      expect.objectContaining({ logoUrl: uploadedLogoUrl }),
    );
  });

  it('only renders settings options accepted by the backend contract', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as unknown as {
      setActiveTab(tab: 'approval' | 'notifications'): void;
    };

    component.setActiveTab('approval');
    fixture.detectChanges();
    let text = fixture.nativeElement.textContent;

    expect(text).toContain('Tenant Admin');
    expect(text).toContain('Accountant');
    expect(text).not.toContain('Manager');

    component.setActiveTab('notifications');
    fixture.detectChanges();
    text = fixture.nativeElement.textContent;

    expect(text).toContain('Hằng ngày');
    expect(text).toContain('Hằng tuần');
    expect(text).toContain('Tắt');
    expect(text).not.toContain('Hằng tháng');
  });

  it('saves notification preferences with backend-accepted digest codes', () => {
    settingsApi.updateNotificationPreferences.mockReturnValue(of(settings));
    const fixture = createComponent();
    const component = fixture.componentInstance as unknown as {
      saveNotifications(): void;
    };

    component.saveNotifications();

    expect(settingsApi.updateNotificationPreferences).toHaveBeenCalledWith({
      emailDigestEnabled: true,
      emailDigestFrequency: 'weekly',
    });
  });
});
