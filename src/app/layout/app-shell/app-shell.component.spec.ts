import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { TenantBrandingDocumentService } from '../../core/branding/tenant-branding-document.service';
import { CurrentWorkspaceFacade } from '../../features/dashboard/data/current-workspace.facade';
import { NotificationsApiService } from '../../features/notifications/data/notifications-api.service';
import { TenantBrandingFacade } from '../../features/settings/data/tenant-branding.facade';
import { CurrentSubscriptionFacade } from '../../features/subscription/data/current-subscription.facade';
import { AppShellComponent } from './app-shell.component';

@Component({ template: '' })
class EmptyRouteComponent {}

describe('AppShellComponent', () => {
  const authService = {
    userEmail: () => 'director.kim@meridian.test',
    logout: vi.fn(),
  };

  const notificationsApi = {
    getUnreadCount: vi.fn(),
  };

  const currentWorkspaceFacade = {
    state: () => ({
      workspace: {
        tenantId: 'tenant-1',
        tenantName: 'Meridian Corp',
        role: 'TenantAdmin',
      },
    }),
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
  const tenantBrandingFacade = {
    state: () => ({
      branding: {
        logoUrl: 'https://cdn.example.com/meridian-logo.svg',
        faviconUrl: 'https://cdn.example.com/meridian.ico',
        primaryColor: '#0f766e',
        companyDisplayName: 'Meridian Finance',
        locale: 'vi-VN',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      loading: false,
      error: null,
      tenantId: 'tenant-1',
    }),
    ensureLoaded: vi.fn(),
  };
  const tenantBrandingDocument = {
    apply: vi.fn(),
  };

  const createComponent = async (
    url: string,
    state = proSubscriptionState,
  ): Promise<ComponentFixture<AppShellComponent>> => {
    subscriptionState = state;
    TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [
        provideRouter([
          {
            path: 'app',
            component: EmptyRouteComponent,
            children: [
              { path: 'documents/list', component: EmptyRouteComponent },
              { path: 'documents/upload', component: EmptyRouteComponent },
              { path: 'documents/submitted/:id', component: EmptyRouteComponent },
            ],
          },
        ]),
        { provide: AuthService, useValue: authService },
        { provide: NotificationsApiService, useValue: notificationsApi },
        { provide: CurrentWorkspaceFacade, useValue: currentWorkspaceFacade },
        { provide: CurrentSubscriptionFacade, useValue: currentSubscriptionFacade },
        { provide: TenantBrandingFacade, useValue: tenantBrandingFacade },
        { provide: TenantBrandingDocumentService, useValue: tenantBrandingDocument },
      ],
    });

    notificationsApi.getUnreadCount.mockReturnValue(of(0));
    currentWorkspaceFacade.refresh.mockClear();
    currentSubscriptionFacade.ensureLoaded.mockClear();
    tenantBrandingFacade.ensureLoaded.mockClear();
    tenantBrandingDocument.apply.mockClear();

    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);

    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('renders parent breadcrumb as a back link on document detail routes', async () => {
    const fixture = await createComponent('/app/documents/submitted/document-1');
    const root = fixture.nativeElement as HTMLElement;

    const parentLink = root.querySelector<HTMLAnchorElement>('[data-testid="shell-breadcrumb-parent"]');
    const currentCrumb = root.querySelector('[data-testid="shell-breadcrumb-current"]');

    expect(parentLink?.textContent?.trim()).toBe('Tài liệu');
    expect(parentLink?.getAttribute('href')).toBe('/app/documents/list');
    expect(currentCrumb?.textContent?.trim()).toBe('Chi tiết chứng từ');
  });

  it('labels nested page breadcrumb links as back navigation', async () => {
    const fixture = await createComponent('/app/documents/upload');
    const root = fixture.nativeElement as HTMLElement;

    const parentLink = root.querySelector<HTMLAnchorElement>('[data-testid="shell-breadcrumb-parent"]');
    const currentCrumb = root.querySelector('[data-testid="shell-breadcrumb-current"]');

    expect(parentLink?.textContent?.trim()).toBe('Tài liệu');
    expect(parentLink?.getAttribute('href')).toBe('/app/documents/list');
    expect(parentLink?.getAttribute('aria-label')).toBe('Quay lại Tài liệu');
    expect(currentCrumb?.textContent?.trim()).toBe('Tải lên & OCR');
  });

  it('keeps the shell frame and sidebar dimensions stable across module routes', async () => {
    const fixture = await createComponent('/app/documents/list');
    const root = fixture.nativeElement as HTMLElement;

    const shellFrame = root.querySelector<HTMLElement>('[data-testid="app-shell-frame"]');
    const sidebar = root.querySelector<HTMLElement>('[data-testid="app-shell-sidebar"]');
    const mainColumn = root.querySelector<HTMLElement>('[data-testid="app-shell-main-column"]');

    expect(shellFrame?.className).toContain('h-screen');
    expect(shellFrame?.className).toContain('overflow-hidden');
    expect(sidebar?.className).toContain('w-64');
    expect(sidebar?.className).toContain('flex-none');
    expect(mainColumn?.className).toContain('overflow-hidden');
  });

  it('applies tenant branding to the workspace identity and browser chrome', async () => {
    const fixture = await createComponent('/app/documents/list');
    const root = fixture.nativeElement as HTMLElement;

    const logo = root.querySelector<HTMLImageElement>('[data-testid="workspace-brand-logo"]');

    expect(root.textContent).toContain('Meridian Finance');
    expect(root.textContent).not.toContain('Meridian Corp');
    expect(logo?.getAttribute('src')).toBe('https://cdn.example.com/meridian-logo.svg');
    expect(logo?.getAttribute('alt')).toBe('Meridian Finance logo');
    expect(tenantBrandingFacade.ensureLoaded).toHaveBeenCalledWith('tenant-1');
    expect(tenantBrandingDocument.apply).toHaveBeenCalledWith(
      tenantBrandingFacade.state().branding,
      'Meridian Corp',
    );
  });

  it('keeps core workspace modules visible and hides add-on modules on a Free plan', async () => {
    const freeSubscriptionState = {
      subscription: {
        planTier: 'Free',
        status: 'Active',
        currentPeriodStart: '2026-05-01T00:00:00.000Z',
        currentPeriodEnd: '2026-06-01T00:00:00.000Z',
        entitlements: {
          documentsManualEntryEnabled: true,
          documentsOcrEnabled: false,
          chatbotEnabled: false,
          storageLimitBytes: 1_073_741_824,
          workspaceMonthlyOcrPages: 0,
          memberMonthlyOcrPages: 0,
          workspaceMonthlyChatbotMessages: 0,
          memberMonthlyChatbotMessages: 0,
        },
        usage: {
          ocrPagesUsed: 0,
          chatbotMessagesUsed: 0,
          storageUsedBytes: 0,
        },
        currentMemberUsage: {
          ocrPagesUsed: 0,
          chatbotMessagesUsed: 0,
          remainingOcrPages: 0,
          remainingChatbotMessages: 0,
        },
      },
      loading: false,
      error: null,
      tenantId: 'tenant-1',
    };

    const fixture = await createComponent('/app/documents/list', freeSubscriptionState);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Tài liệu');
    expect(text).toContain('Phê duyệt');
    expect(text).toContain('Thanh toán');
    expect(text).toContain('Thành viên');
    expect(text).not.toContain('Nhà cung cấp');
    expect(text).toContain('Ngân sách');
    expect(text).toContain('Phòng ban');
    expect(text).toContain('Tổng quan');
    expect(text).toContain('Gói & Hạn mức');
    expect(text).not.toContain('Báo cáo');
    expect(text).not.toContain('Trợ lý AI');
    expect(currentSubscriptionFacade.ensureLoaded).toHaveBeenCalledWith('tenant-1');
  });
});
