import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
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
    typeof candidate['tenantName'] === 'string'
  );
};

@Injectable({
  providedIn: 'root',
})
export class CurrentWorkspaceApiService {
  private readonly http = inject(HttpClient);
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

  getCurrentWorkspace(): Observable<CurrentWorkspace> {
    return this.http
      .post<GraphQlResponse<CurrentWorkspaceQueryResponse>>(this.endpoint, {
        query: CURRENT_WORKSPACE_QUERY,
      })
      .pipe(
        map((response) => {
          const workspace = this.extractData(
            response,
            'Current workspace response did not include workspace data.',
          ).currentWorkspace;

          if (!isCurrentWorkspace(workspace)) {
            throw new Error('Current workspace response did not include workspace data.');
          }

          return workspace;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }
}
