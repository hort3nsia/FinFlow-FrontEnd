import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api-base-url.token';

interface GraphQlError {
  message: string;
}

interface GraphQlResponse<TData> {
  data?: TData;
  errors?: GraphQlError[];
}

export interface SubscriptionEntitlementsResponse {
  documentsManualEntryEnabled: boolean;
  documentsOcrEnabled: boolean;
  chatbotEnabled: boolean;
  storageLimitBytes: number;
  workspaceMonthlyOcrPages: number;
  memberMonthlyOcrPages: number;
  workspaceMonthlyChatbotMessages: number;
  memberMonthlyChatbotMessages: number;
}

export interface SubscriptionUsageResponse {
  ocrPagesUsed: number;
  chatbotMessagesUsed: number;
  storageUsedBytes: number;
}

export interface SubscriptionMemberUsageResponse {
  ocrPagesUsed: number;
  chatbotMessagesUsed: number;
  remainingOcrPages: number;
  remainingChatbotMessages: number;
}

export interface CurrentSubscriptionResponse {
  planTier: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  entitlements: SubscriptionEntitlementsResponse;
  usage: SubscriptionUsageResponse;
  currentMemberUsage: SubscriptionMemberUsageResponse;
}

export interface CancelSubscriptionResponse {
  success: boolean;
  message: string | null;
}

export interface ChangePlanResponse {
  success: boolean;
  message: string | null;
}

interface CurrentSubscriptionQueryResponse {
  currentSubscription: CurrentSubscriptionResponse;
}

interface CancelSubscriptionMutationResponse {
  cancelSubscription: CancelSubscriptionResponse;
}

interface ChangePlanMutationResponse {
  changeSubscriptionPlan: ChangePlanResponse;
}

const SUBSCRIPTION_FIELDS = `
  planTier
  status
  currentPeriodStart
  currentPeriodEnd
  entitlements {
    documentsManualEntryEnabled
    documentsOcrEnabled
    chatbotEnabled
    storageLimitBytes
    workspaceMonthlyOcrPages
    memberMonthlyOcrPages
    workspaceMonthlyChatbotMessages
    memberMonthlyChatbotMessages
  }
  usage {
    ocrPagesUsed
    chatbotMessagesUsed
    storageUsedBytes
  }
  currentMemberUsage {
    ocrPagesUsed
    chatbotMessagesUsed
    remainingOcrPages
    remainingChatbotMessages
  }
`;

const CURRENT_SUBSCRIPTION_QUERY = `
  query CurrentSubscription {
    currentSubscription {${SUBSCRIPTION_FIELDS}}
  }
`;

const CANCEL_SUBSCRIPTION_MUTATION = `
  mutation CancelSubscription {
    cancelSubscription {
      success
      message
    }
  }
`;

const CHANGE_PLAN_MUTATION = `
  mutation ChangeSubscriptionPlan($planTier: String!) {
    changeSubscriptionPlan(planTier: $planTier) {
      success
      message
    }
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null =>
  errors?.[0]?.message ?? null;

const toSafeSubscriptionError = (message: string): string => {
  if (
    message.includes('23505') &&
    message.includes('IX_tenant_subscription_id_tenant')
  ) {
    return 'Dữ liệu gói của workspace đang bị trùng ở backend nên chưa thể đổi gói. Vui lòng tải lại trang; nếu vẫn lỗi, cần đồng bộ lại bản ghi subscription của workspace.';
  }

  return message;
};

@Injectable({ providedIn: 'root' })
export class SubscriptionApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = inject(API_BASE_URL);

  getCurrentSubscription(): Observable<CurrentSubscriptionResponse> {
    return this.http
      .post<GraphQlResponse<CurrentSubscriptionQueryResponse>>(this.endpoint, {
        query: CURRENT_SUBSCRIPTION_QUERY,
      })
      .pipe(
        map((response) =>
          this.extractData(
            response,
            'CurrentSubscription query did not return data.',
          ).currentSubscription,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  cancelSubscription(): Observable<CancelSubscriptionResponse> {
    return this.http
      .post<GraphQlResponse<CancelSubscriptionMutationResponse>>(this.endpoint, {
        query: CANCEL_SUBSCRIPTION_MUTATION,
      })
      .pipe(
        map((response) =>
          this.extractData(
            response,
            'CancelSubscription mutation did not return data.',
          ).cancelSubscription,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  changePlan(planTier: string): Observable<ChangePlanResponse> {
    return this.http
      .post<GraphQlResponse<ChangePlanMutationResponse>>(this.endpoint, {
        query: CHANGE_PLAN_MUTATION,
        variables: { planTier },
      })
      .pipe(
        map((response) =>
          this.extractData(
            response,
            'ChangeSubscriptionPlan mutation did not return data.',
          ).changeSubscriptionPlan,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  private extractData<TData>(response: GraphQlResponse<TData>, missingMessage: string): TData {
    const message = extractGraphQlMessage(response.errors);
    if (message) {
      throw new Error(toSafeSubscriptionError(message));
    }
    if (!response.data) {
      throw new Error(missingMessage);
    }
    return response.data;
  }

  private mapTransportError(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      const message = extractGraphQlMessage(error.error?.errors);
      return throwError(
        () =>
          new Error(
            toSafeSubscriptionError(message ?? error.message ?? 'Unable to complete the request.'),
          ),
      );
    }
    if (error instanceof Error) {
      return throwError(() => new Error(toSafeSubscriptionError(error.message)));
    }
    return throwError(() => new Error('Unable to complete the request.'));
  }
}
