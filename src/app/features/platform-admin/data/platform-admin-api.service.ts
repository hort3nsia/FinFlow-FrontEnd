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

export interface PlatformMemberDto {
  id: string;
  accountId: string;
  tenantId: string;
  departmentId: string | null;
  fullName: string | null;
  email: string | null;
  departmentName: string | null;
  role: string;
  isOwner: boolean;
  isActive: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  deactivatedAt: string | null;
  deactivatedBy: string | null;
  deactivatedReason: string | null;
}

export interface PlatformMutationPayload {
  success: boolean;
  message: string | null;
}

const PLATFORM_MEMBERS_QUERY = `
  query GetPlatformMembers {
    getPlatformMembers {
      id
      accountId
      tenantId
      departmentId
      fullName
      email
      departmentName
      role
      isOwner
      isActive
      createdAt
      lastActiveAt
      deactivatedAt
      deactivatedBy
      deactivatedReason
    }
  }
`;

const PAUSE_SUBSCRIPTION_MUTATION = `
  mutation PlatformPauseSubscription($input: PlatformSubscriptionStateInput!) {
    platformPauseSubscription(input: $input) { success message }
  }
`;

const RESUME_SUBSCRIPTION_MUTATION = `
  mutation PlatformResumeSubscription($input: PlatformSubscriptionStateInput!) {
    platformResumeSubscription(input: $input) { success message }
  }
`;

const REACTIVATE_SUBSCRIPTION_MUTATION = `
  mutation PlatformReactivateSubscription($input: PlatformSubscriptionStateInput!) {
    platformReactivateSubscription(input: $input) { success message }
  }
`;

const REMOVE_MEMBER_MUTATION = `
  mutation PlatformRemoveMember($input: PlatformRemoveMemberInput!) {
    platformRemoveMember(input: $input) { success message }
  }
`;

const TRANSFER_OWNERSHIP_MUTATION = `
  mutation PlatformTransferOwnership($input: PlatformTransferOwnershipInput!) {
    platformTransferOwnership(input: $input) { success message }
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null =>
  errors?.[0]?.message ?? null;

@Injectable({ providedIn: 'root' })
export class PlatformAdminApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = inject(API_BASE_URL);

  getMembers(): Observable<PlatformMemberDto[]> {
    return this.http
      .post<GraphQlResponse<{ getPlatformMembers: PlatformMemberDto[] }>>(this.endpoint, {
        query: PLATFORM_MEMBERS_QUERY,
      })
      .pipe(
        map(
          (response) =>
            this.extractData(response, 'GetPlatformMembers did not return data.')
              .getPlatformMembers,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  pauseSubscription(tenantId: string): Observable<PlatformMutationPayload> {
    return this.callMutation(PAUSE_SUBSCRIPTION_MUTATION, { tenantId }, 'platformPauseSubscription');
  }

  resumeSubscription(tenantId: string): Observable<PlatformMutationPayload> {
    return this.callMutation(
      RESUME_SUBSCRIPTION_MUTATION,
      { tenantId },
      'platformResumeSubscription',
    );
  }

  reactivateSubscription(tenantId: string): Observable<PlatformMutationPayload> {
    return this.callMutation(
      REACTIVATE_SUBSCRIPTION_MUTATION,
      { tenantId },
      'platformReactivateSubscription',
    );
  }

  removeMember(membershipId: string, reason: string): Observable<PlatformMutationPayload> {
    return this.callMutation(
      REMOVE_MEMBER_MUTATION,
      { membershipId, reason },
      'platformRemoveMember',
    );
  }

  transferOwnership(membershipId: string, tenantId: string): Observable<PlatformMutationPayload> {
    return this.callMutation(
      TRANSFER_OWNERSHIP_MUTATION,
      { membershipId, tenantId },
      'platformTransferOwnership',
    );
  }

  private callMutation(
    query: string,
    input: unknown,
    fieldName: string,
  ): Observable<PlatformMutationPayload> {
    return this.http
      .post<GraphQlResponse<Record<string, PlatformMutationPayload>>>(this.endpoint, {
        query,
        variables: { input },
      })
      .pipe(
        map((response) => {
          const data = this.extractData(response, 'Mutation did not return data.');
          return data[fieldName];
        }),
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
