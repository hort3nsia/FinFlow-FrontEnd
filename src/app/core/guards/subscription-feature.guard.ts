import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { SubscriptionApiService } from '../../features/subscription/data/subscription-api.service';

type SubscriptionFeature = 'paidPlan' | 'documentsOcr' | 'documentsManual' | 'chatbot';

const isPaidPlan = (planTier: string): boolean => {
  const normalized = planTier.toLowerCase();
  return normalized === 'pro' || normalized === 'enterprise' || normalized === 'business';
};

export const requireSubscriptionFeature = (feature: SubscriptionFeature): CanActivateFn => () => {
  const subscriptionApi = inject(SubscriptionApiService);
  const router = inject(Router);
  const upgradeRoute = router.createUrlTree(['/app/subscription']);

  return subscriptionApi.getCurrentSubscription().pipe(
    map((subscription) => {
      switch (feature) {
        case 'documentsOcr':
          return subscription.entitlements.documentsOcrEnabled ? true : upgradeRoute;
        case 'documentsManual':
          return subscription.entitlements.documentsManualEntryEnabled ? true : upgradeRoute;
        case 'chatbot':
          return subscription.entitlements.chatbotEnabled ? true : upgradeRoute;
        case 'paidPlan':
          return isPaidPlan(subscription.planTier) ? true : upgradeRoute;
      }
    }),
    catchError(() => of(upgradeRoute)),
  );
};

export const paidPlanGuard = requireSubscriptionFeature('paidPlan');
export const documentsOcrGuard = requireSubscriptionFeature('documentsOcr');
export const documentsManualGuard = requireSubscriptionFeature('documentsManual');
export const chatbotGuard = requireSubscriptionFeature('chatbot');
