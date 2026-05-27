import { inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  CurrentSubscriptionResponse,
  SubscriptionApiService,
} from './subscription-api.service';

export interface CurrentSubscriptionState {
  subscription: CurrentSubscriptionResponse | null;
  loading: boolean;
  error: string | null;
  tenantId: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class CurrentSubscriptionFacade {
  private readonly subscriptionApi = inject(SubscriptionApiService);
  private requestSubscription: Subscription | null = null;
  private readonly stateSignal = signal<CurrentSubscriptionState>({
    subscription: null,
    loading: false,
    error: null,
    tenantId: null,
  });

  readonly state = this.stateSignal.asReadonly();

  ensureLoaded(tenantId: string | null | undefined): void {
    if (!tenantId) {
      this.reset();
      return;
    }

    const state = this.stateSignal();
    if (state.tenantId !== tenantId) {
      this.stateSignal.set({
        subscription: null,
        loading: false,
        error: null,
        tenantId,
      });
      this.refresh();
      return;
    }

    if (!state.subscription && !state.loading) {
      this.refresh();
    }
  }

  refresh(options?: { silent?: boolean }): void {
    const state = this.stateSignal();
    if (!state.tenantId) {
      return;
    }

    this.requestSubscription?.unsubscribe();
    this.stateSignal.update((current) => ({
      ...current,
      loading: !(options?.silent ?? false),
      error: null,
    }));

    this.requestSubscription = this.subscriptionApi.getCurrentSubscription().subscribe({
      next: (subscription) => {
        this.stateSignal.update((current) => ({
          ...current,
          subscription,
          loading: false,
          error: null,
        }));
      },
      error: (error: Error) => {
        this.stateSignal.update((current) => ({
          ...current,
          loading: false,
          error: error.message,
        }));
      },
    });
  }

  recordChatbotUsage(messageCount = 1): void {
    if (messageCount <= 0) {
      return;
    }

    this.stateSignal.update((current) => {
      if (!current.subscription) {
        return current;
      }

      const nextSubscription: CurrentSubscriptionResponse = {
        ...current.subscription,
        usage: {
          ...current.subscription.usage,
          chatbotMessagesUsed: current.subscription.usage.chatbotMessagesUsed + messageCount,
        },
        currentMemberUsage: {
          ...current.subscription.currentMemberUsage,
          chatbotMessagesUsed:
            current.subscription.currentMemberUsage.chatbotMessagesUsed + messageCount,
          remainingChatbotMessages: Math.max(
            0,
            current.subscription.currentMemberUsage.remainingChatbotMessages - messageCount,
          ),
        },
      };

      return {
        ...current,
        subscription: nextSubscription,
      };
    });
  }

  recordOcrUsage(pageCount = 1): void {
    if (pageCount <= 0) {
      return;
    }

    this.stateSignal.update((current) => {
      if (!current.subscription) {
        return current;
      }

      const nextSubscription: CurrentSubscriptionResponse = {
        ...current.subscription,
        usage: {
          ...current.subscription.usage,
          ocrPagesUsed: current.subscription.usage.ocrPagesUsed + pageCount,
        },
        currentMemberUsage: {
          ...current.subscription.currentMemberUsage,
          ocrPagesUsed: current.subscription.currentMemberUsage.ocrPagesUsed + pageCount,
          remainingOcrPages: Math.max(
            0,
            current.subscription.currentMemberUsage.remainingOcrPages - pageCount,
          ),
        },
      };

      return {
        ...current,
        subscription: nextSubscription,
      };
    });
  }

  reset(): void {
    this.requestSubscription?.unsubscribe();
    this.stateSignal.set({
      subscription: null,
      loading: false,
      error: null,
      tenantId: null,
    });
  }
}
