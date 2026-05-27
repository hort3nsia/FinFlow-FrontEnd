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

export interface BrandingResponse {
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  companyDisplayName: string | null;
  locale: string;
  timezone: string;
}

export interface ApprovalPolicyResponse {
  autoApproveThreshold: number;
  escalationThreshold: number;
  escalationApproverRole: string;
  requireDifferentApprover: boolean;
  maxApprovalAgeHours: number;
  isEscalationEnabled: boolean;
}

export interface BudgetPolicyResponse {
  defaultEnforcementMode: string;
  defaultCarryOverPercent: number;
  warningThreshold1: number;
  warningThreshold2: number;
}

export interface ReimbursementPolicyResponse {
  maxClaimAmount: number;
  receiptRequiredAbove: number;
}

export interface NotificationPreferencesResponse {
  emailDigestEnabled: boolean;
  emailDigestFrequency: string;
}

export interface TenantSettingsResponse {
  id: string;
  branding: BrandingResponse;
  approvalPolicy: ApprovalPolicyResponse;
  budgetPolicy: BudgetPolicyResponse;
  reimbursementPolicy: ReimbursementPolicyResponse;
  notificationPreferences: NotificationPreferencesResponse;
  updatedAt: string;
}

export interface UpdateBrandingInput {
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  companyDisplayName?: string | null;
  locale?: string | null;
  timezone?: string | null;
}

export interface UpdateApprovalPolicyInput {
  autoApproveThreshold?: number | null;
  escalationThreshold?: number | null;
  escalationApproverRole?: string | null;
  requireDifferentApprover?: boolean | null;
  maxApprovalAgeHours?: number | null;
  isEscalationEnabled?: boolean | null;
}

export interface UpdateBudgetPolicyInput {
  defaultEnforcementMode?: string | null;
  defaultCarryOverPercent?: number | null;
  warningThreshold1?: number | null;
  warningThreshold2?: number | null;
}

export interface UpdateReimbursementPolicyInput {
  maxClaimAmount?: number | null;
  receiptRequiredAbove?: number | null;
}

export interface UpdateNotificationPreferencesInput {
  emailDigestEnabled?: boolean | null;
  emailDigestFrequency?: string | null;
}

const SETTINGS_FIELDS = `
  id
  branding {
    logoUrl
    faviconUrl
    primaryColor
    companyDisplayName
    locale
    timezone
  }
  approvalPolicy {
    autoApproveThreshold
    escalationThreshold
    escalationApproverRole
    requireDifferentApprover
    maxApprovalAgeHours
    isEscalationEnabled
  }
  budgetPolicy {
    defaultEnforcementMode
    defaultCarryOverPercent
    warningThreshold1
    warningThreshold2
  }
  reimbursementPolicy {
    maxClaimAmount
    receiptRequiredAbove
  }
  notificationPreferences {
    emailDigestEnabled
    emailDigestFrequency
  }
  updatedAt
`;

const GET_SETTINGS_QUERY = `
  query GetTenantSettings { getTenantSettings {${SETTINGS_FIELDS}} }
`;

const UPDATE_BRANDING = `
  mutation UpdateBranding($input: UpdateBrandingInput!) {
    updateBranding(input: $input) {${SETTINGS_FIELDS}}
  }
`;

const UPDATE_APPROVAL_POLICY = `
  mutation UpdateApprovalPolicy($input: UpdateApprovalPolicyInput!) {
    updateApprovalPolicy(input: $input) {${SETTINGS_FIELDS}}
  }
`;

const UPDATE_BUDGET_POLICY = `
  mutation UpdateBudgetPolicy($input: UpdateBudgetPolicyInput!) {
    updateBudgetPolicy(input: $input) {${SETTINGS_FIELDS}}
  }
`;

const UPDATE_REIMBURSEMENT_POLICY = `
  mutation UpdateReimbursementPolicy($input: UpdateReimbursementPolicyInput!) {
    updateReimbursementPolicy(input: $input) {${SETTINGS_FIELDS}}
  }
`;

const UPDATE_NOTIFICATION_PREFERENCES = `
  mutation UpdateNotificationPreferences($input: UpdateNotificationPreferencesInput!) {
    updateNotificationPreferences(input: $input) {${SETTINGS_FIELDS}}
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null =>
  errors?.[0]?.message ?? null;

@Injectable({ providedIn: 'root' })
export class SettingsApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = inject(API_BASE_URL);

  getSettings(): Observable<TenantSettingsResponse> {
    return this.callQuery<{ getTenantSettings: TenantSettingsResponse }>(GET_SETTINGS_QUERY).pipe(
      map((r) => r.getTenantSettings),
    );
  }

  updateBranding(input: UpdateBrandingInput): Observable<TenantSettingsResponse> {
    return this.callMutation<{ updateBranding: TenantSettingsResponse }>(
      UPDATE_BRANDING,
      input,
    ).pipe(map((r) => r.updateBranding));
  }

  updateApprovalPolicy(input: UpdateApprovalPolicyInput): Observable<TenantSettingsResponse> {
    return this.callMutation<{ updateApprovalPolicy: TenantSettingsResponse }>(
      UPDATE_APPROVAL_POLICY,
      input,
    ).pipe(map((r) => r.updateApprovalPolicy));
  }

  updateBudgetPolicy(input: UpdateBudgetPolicyInput): Observable<TenantSettingsResponse> {
    return this.callMutation<{ updateBudgetPolicy: TenantSettingsResponse }>(
      UPDATE_BUDGET_POLICY,
      input,
    ).pipe(map((r) => r.updateBudgetPolicy));
  }

  updateReimbursementPolicy(
    input: UpdateReimbursementPolicyInput,
  ): Observable<TenantSettingsResponse> {
    return this.callMutation<{ updateReimbursementPolicy: TenantSettingsResponse }>(
      UPDATE_REIMBURSEMENT_POLICY,
      input,
    ).pipe(map((r) => r.updateReimbursementPolicy));
  }

  updateNotificationPreferences(
    input: UpdateNotificationPreferencesInput,
  ): Observable<TenantSettingsResponse> {
    return this.callMutation<{ updateNotificationPreferences: TenantSettingsResponse }>(
      UPDATE_NOTIFICATION_PREFERENCES,
      input,
    ).pipe(map((r) => r.updateNotificationPreferences));
  }

  private callQuery<T>(query: string): Observable<T> {
    return this.http
      .post<GraphQlResponse<T>>(this.endpoint, { query })
      .pipe(
        map((response) => this.extractData(response, 'GraphQL did not return data.')),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  private callMutation<T>(query: string, input: unknown): Observable<T> {
    return this.http
      .post<GraphQlResponse<T>>(this.endpoint, { query, variables: { input } })
      .pipe(
        map((response) => this.extractData(response, 'GraphQL did not return data.')),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  private extractData<T>(response: GraphQlResponse<T>, missingMessage: string): T {
    const message = extractGraphQlMessage(response.errors);
    if (message) throw new Error(message);
    if (!response.data) throw new Error(missingMessage);
    return response.data;
  }

  private mapTransportError(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      const message = extractGraphQlMessage(error.error?.errors);
      return throwError(
        () => new Error(message ?? error.message ?? 'Unable to complete the request.'),
      );
    }
    if (error instanceof Error) return throwError(() => error);
    return throwError(() => new Error('Unable to complete the request.'));
  }
}
