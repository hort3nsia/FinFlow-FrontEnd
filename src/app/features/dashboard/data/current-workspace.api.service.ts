import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, defer, map, Observable, switchMap, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { isAuthInvalidMessage } from '../../../core/auth/auth-error.utils';
import { API_BASE_URL } from '../../../core/config/api-base-url.token';
import { CurrentWorkspace } from './current-workspace.models';

interface GraphQlError {
  message: string;
}

interface GraphQlResponse<TData> {
  data?: TData;
  errors?: GraphQlError[];
}

interface CurrentWorkspaceQueryResponse {
  currentWorkspace: CurrentWorkspace | null;
}

const CURRENT_WORKSPACE_QUERY = `
  query CurrentWorkspace {
    currentWorkspace {
      accountId
      email
      membershipId
      role
      tenantId
      tenantCode
      tenantName
      departmentId
    }
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null => errors?.[0]?.message ?? null;

const isCurrentWorkspace = (value: unknown): value is CurrentWorkspace => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate['accountId'] === 'string' &&
    typeof candidate['email'] === 'string' &&
    typeof candidate['membershipId'] === 'string' &&
    typeof candidate['role'] === 'string' &&
    typeof candidate['tenantId'] === 'string' &&
    typeof candidate['tenantCode'] === 'string' &&
    typeof candidate['tenantName'] === 'string' &&
    (candidate['departmentId'] === null || typeof candidate['departmentId'] === 'string')
  );
};

@Injectable({
  providedIn: 'root',
})
export class CurrentWorkspaceApiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly endpoint = inject(API_BASE_URL);

  private extractData<TData>(response: GraphQlResponse<TData>, missingMessage: string): TData {
    const graphQlMessage = extractGraphQlMessage(response.errors);
    if (graphQlMessage) {
      throw new Error(graphQlMessage);
    }

    if (!response.data) {
      throw new Error(missingMessage);
    }

    return response.data;
  }

  private mapTransportError(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      const graphQlMessage = extractGraphQlMessage(error.error?.errors);
      return throwError(
        () => new Error(graphQlMessage ?? error.message ?? 'Unable to complete the request.'),
      );
    }

    if (error instanceof Error) {
      return throwError(() => error);
    }

    return throwError(() => new Error('Unable to complete the request.'));
  }

  private isAuthInvalidError(error: unknown): boolean {
    if (error instanceof HttpErrorResponse) {
      return isAuthInvalidMessage(extractGraphQlMessage(error.error?.errors) ?? error.message);
    }

    if (error instanceof Error) {
      return isAuthInvalidMessage(error.message);
    }

    return false;
  }

  private withRefreshRetry<TData, TResult>(
    requestFactory: () => Observable<GraphQlResponse<TData>>,
    missingMessage: string,
    select: (data: TData) => TResult,
    hasRetried = false,
  ): Observable<TResult> {
    return defer(requestFactory).pipe(
      map((response) => select(this.extractData(response, missingMessage))),
      catchError((error: unknown) => {
        if (hasRetried || !this.isAuthInvalidError(error)) {
          return this.mapTransportError(error);
        }

        return this.authService.refreshToken().pipe(
          switchMap(() => this.withRefreshRetry(requestFactory, missingMessage, select, true)),
          catchError((refreshError: unknown) => this.mapTransportError(refreshError)),
        );
      }),
    );
  }

  getCurrentWorkspace(): Observable<CurrentWorkspace> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<CurrentWorkspaceQueryResponse>>(this.endpoint, {
          query: CURRENT_WORKSPACE_QUERY,
        }),
      'Current workspace response did not include workspace data.',
      (data) => {
        const workspace = data.currentWorkspace;

        if (!isCurrentWorkspace(workspace)) {
          throw new Error('Current workspace response did not include workspace data.');
        }

        return workspace;
      },
    );
  }
}
