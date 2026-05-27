import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { SubscriptionApiService, type CurrentSubscriptionResponse } from './subscription-api.service';
import { CurrentSubscriptionFacade } from './current-subscription.facade';

describe('CurrentSubscriptionFacade', () => {
  let request$: Subject<CurrentSubscriptionResponse>;
  let subscriptionApi: {
    getCurrentSubscription: () => Observable<CurrentSubscriptionResponse>;
  };

  const sampleSubscription: CurrentSubscriptionResponse = {
    planTier: 'Pro',
    status: 'Active',
    currentPeriodStart: '2026-05-01T00:00:00Z',
    currentPeriodEnd: '2026-06-01T00:00:00Z',
    entitlements: {
      documentsManualEntryEnabled: true,
      documentsOcrEnabled: true,
      chatbotEnabled: true,
      storageLimitBytes: 10_000,
      workspaceMonthlyOcrPages: 1_000,
      memberMonthlyOcrPages: 100,
      workspaceMonthlyChatbotMessages: 10_000,
      memberMonthlyChatbotMessages: 500,
    },
    usage: {
      ocrPagesUsed: 8,
      chatbotMessagesUsed: 2,
      storageUsedBytes: 256,
    },
    currentMemberUsage: {
      ocrPagesUsed: 0,
      chatbotMessagesUsed: 2,
      remainingOcrPages: 100,
      remainingChatbotMessages: 498,
    },
  };

  beforeEach(() => {
    request$ = new Subject<CurrentSubscriptionResponse>();
    subscriptionApi = {
      getCurrentSubscription: () => request$.asObservable(),
    };

    TestBed.configureTestingModule({
      providers: [
        CurrentSubscriptionFacade,
        {
          provide: SubscriptionApiService,
          useValue: subscriptionApi,
        },
      ],
    });
  });

  it('loads current subscription when tenant is available', () => {
    const facade = TestBed.inject(CurrentSubscriptionFacade);

    facade.ensureLoaded('tenant-1');

    expect(facade.state().loading).toBe(true);
    expect(facade.state().tenantId).toBe('tenant-1');

    request$.next(sampleSubscription);
    request$.complete();

    expect(facade.state()).toEqual({
      subscription: sampleSubscription,
      loading: false,
      error: null,
      tenantId: 'tenant-1',
    });
  });

  it('optimistically increments chatbot usage for workspace and member quota', () => {
    const facade = TestBed.inject(CurrentSubscriptionFacade);

    facade.ensureLoaded('tenant-1');
    request$.next(sampleSubscription);
    request$.complete();

    facade.recordChatbotUsage(1);

    expect(facade.state().subscription?.usage.chatbotMessagesUsed).toBe(3);
    expect(facade.state().subscription?.currentMemberUsage.chatbotMessagesUsed).toBe(3);
    expect(facade.state().subscription?.currentMemberUsage.remainingChatbotMessages).toBe(497);
  });

  it('resets state when tenant becomes unavailable', () => {
    const facade = TestBed.inject(CurrentSubscriptionFacade);

    facade.ensureLoaded('tenant-1');
    request$.next(sampleSubscription);
    request$.complete();

    facade.ensureLoaded(null);

    expect(facade.state()).toEqual({
      subscription: null,
      loading: false,
      error: null,
      tenantId: null,
    });
  });
});


