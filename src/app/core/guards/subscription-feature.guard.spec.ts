import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';
import { SubscriptionApiService } from '../../features/subscription/data/subscription-api.service';
import { documentsOcrGuard, paidPlanGuard } from './subscription-feature.guard';

describe('subscription feature guards', () => {
  const subscriptionApi = {
    getCurrentSubscription: vi.fn(),
  };

  const subscription = {
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
  };

  beforeEach(() => {
    subscriptionApi.getCurrentSubscription.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SubscriptionApiService, useValue: subscriptionApi },
      ],
    });
  });

  it('allows paid plan routes for paid workspaces', async () => {
    subscriptionApi.getCurrentSubscription.mockReturnValue(of(subscription));

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(paidPlanGuard({} as never, {} as never) as never),
    );

    expect(result).toBe(true);
  });

  it('redirects paid plan routes for Free workspaces', async () => {
    subscriptionApi.getCurrentSubscription.mockReturnValue(
      of({
        ...subscription,
        planTier: 'Free',
        entitlements: {
          ...subscription.entitlements,
          documentsOcrEnabled: false,
          chatbotEnabled: false,
        },
      }),
    );

    const router = TestBed.inject(Router);
    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(paidPlanGuard({} as never, {} as never) as never),
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/app/subscription');
  });

  it('redirects OCR upload when OCR entitlement is not included', async () => {
    subscriptionApi.getCurrentSubscription.mockReturnValue(
      of({
        ...subscription,
        entitlements: {
          ...subscription.entitlements,
          documentsOcrEnabled: false,
        },
      }),
    );

    const router = TestBed.inject(Router);
    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(documentsOcrGuard({} as never, {} as never) as never),
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/app/subscription');
  });
});
