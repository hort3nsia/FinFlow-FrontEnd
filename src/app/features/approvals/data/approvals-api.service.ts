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

export interface PendingApprovalItemResponse {
  documentId: string;
  title: string;
  requester: string;
  department: string;
  amount: number;
  dueDate: string;
  priority: string;
  status: string;
}

interface PendingApprovalItemsQueryResponse {
  pendingApprovalItems: PendingApprovalItemResponse[];
}

const PENDING_APPROVAL_ITEMS_QUERY = `
  query PendingApprovalItems {
    pendingApprovalItems {
      documentId
      title
      requester
      department
      amount
      dueDate
      priority
      status
    }
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null => errors?.[0]?.message ?? null;

@Injectable({
  providedIn: 'root',
})
export class ApprovalsApiService {
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

  getPendingApprovalItems(): Observable<PendingApprovalItemResponse[]> {
    return this.http
      .post<GraphQlResponse<PendingApprovalItemsQueryResponse>>(this.endpoint, {
        query: PENDING_APPROVAL_ITEMS_QUERY,
      })
      .pipe(
        map((response) => {
          const data = this.extractData(
            response,
            'PendingApprovalItems query did not include approval data.',
          );
          return data.pendingApprovalItems;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }
}
