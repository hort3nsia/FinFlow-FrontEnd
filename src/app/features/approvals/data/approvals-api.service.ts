import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, defer, map, Observable, switchMap, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { isAuthInvalidMessage } from '../../../core/auth/auth-error.utils';
import { API_BASE_URL } from '../../../core/config/api-base-url.token';

interface GraphQlError {
  message: string;
  extensions?: {
    code?: string;
  };
}

interface GraphQlResponse<TData> {
  data?: TData;
  errors?: GraphQlError[];
}

export interface PendingApprovalItemResponse {
  documentId: string;
  title: string;
  vendorName: string;
  requester: string;
  requesterEmail: string;
  department: string;
  amount: number;
  currency: string;
  expenseDate: string;
  submittedAt: string;
  priority: string;
  status: string;
  policySummary: string | null;
}

export type ApprovalStatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ApprovalQueuePageResponse {
  items: PendingApprovalItemResponse[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ExportApprovalQueueResponse {
  fileName: string;
  downloadUrl: string;
}

export interface ApprovalDetailLineItemResponse {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ApprovalDetailResponse {
  documentId: string;
  requestCode: string;
  title: string;
  vendorName: string;
  requesterName: string;
  requesterEmail: string;
  department: string;
  amount: number;
  currency: string;
  expenseDate: string;
  submittedAt: string;
  priority: string;
  status: string;
  policySummary: string | null;
  lineItems: ApprovalDetailLineItemResponse[];
}

export interface ReviewedApprovalActionResponse {
  documentId: string;
  status: string;
  submittedAt: string;
  vendorName: string;
  reference: string;
  totalAmount: number;
  reviewedByStaff: string;
}

interface ApprovalQueueQueryResponse {
  approvalQueue: ApprovalQueuePageResponse;
}

interface ExportApprovalQueueQueryResponse {
  exportApprovalQueue: ExportApprovalQueueResponse;
}

interface ApprovalDetailQueryResponse {
  approvalDetail: ApprovalDetailResponse | null;
}

interface ApproveReviewedDocumentMutationResponse {
  approveReviewedDocument: ReviewedApprovalActionResponse;
}

interface RejectReviewedDocumentMutationResponse {
  rejectReviewedDocument: ReviewedApprovalActionResponse;
}

const APPROVAL_QUEUE_QUERY = `
  query ApprovalQueue(
    $status: ApprovalStatusFilter = ALL
    $search: String
    $page: Int = 1
    $pageSize: Int = 20
  ) {
    approvalQueue(
      status: $status
      search: $search
      page: $page
      pageSize: $pageSize
    ) {
      items {
        documentId
        title
        vendorName
        requester
        requesterEmail
        department
        amount
        currency
        expenseDate
        submittedAt
        priority
        status
        policySummary
      }
      page
      pageSize
      totalCount
      totalPages
    }
  }
`;

const EXPORT_APPROVAL_QUEUE_QUERY = `
  query ExportApprovalQueue(
    $status: ApprovalStatusFilter = ALL
    $search: String
  ) {
    exportApprovalQueue(
      status: $status
      search: $search
    ) {
      fileName
      downloadUrl
    }
  }
`;

const APPROVAL_DETAIL_QUERY = `
  query ApprovalDetail($documentId: UUID!) {
    approvalDetail(documentId: $documentId) {
      documentId
      requestCode
      title
      vendorName
      requesterName
      requesterEmail
      department
      amount
      currency
      expenseDate
      submittedAt
      priority
      status
      policySummary
      lineItems {
        description
        quantity
        unitPrice
        total
      }
    }
  }
`;

const APPROVE_REVIEWED_DOCUMENT_MUTATION = `
  mutation ApproveReviewedDocument($input: ApproveReviewedDocumentInput!) {
    approveReviewedDocument(input: $input) {
      documentId
      status
      submittedAt
      vendorName
      reference
      totalAmount
      reviewedByStaff
    }
  }
`;

const REJECT_REVIEWED_DOCUMENT_MUTATION = `
  mutation RejectReviewedDocument($input: RejectReviewedDocumentInput!) {
    rejectReviewedDocument(input: $input) {
      documentId
      status
      submittedAt
      vendorName
      reference
      totalAmount
      reviewedByStaff
    }
  }
`;

const APPROVAL_ERROR_MESSAGES_VI: Record<string, string> = {
  'ReviewedDocument.NotFound': 'Không tìm thấy chứng từ cần xử lý.',
  'ReviewedDocument.SelfApprovalNotAllowed':
    'Bạn không thể tự phê duyệt hoặc từ chối chứng từ do chính mình gửi. Vui lòng chuyển cho người phê duyệt khác.',
  'ReviewedDocument.ForbiddenApproval': 'Bạn không có quyền phê duyệt chứng từ trong workspace này.',
  'ReviewedDocument.AlreadyProcessed': 'Chứng từ này đã được xử lý trước đó.',
  'Budget.HardBlocked': 'Không thể phê duyệt vì ngân sách hiện tại không đủ.',
  'Budget.OverrideRequired': 'Chứng từ vượt ngân sách và cần lý do phê duyệt vượt hạn mức.',
  'Budget.OverrideJustificationRequired': 'Vui lòng nhập lý do phê duyệt vượt ngân sách.',
};

const APPROVAL_ERROR_FALLBACK_MESSAGES_VI: Record<string, string> = {
  'Submitter cannot approve their own reviewed document.':
    APPROVAL_ERROR_MESSAGES_VI['ReviewedDocument.SelfApprovalNotAllowed'],
};

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null => {
  const error = errors?.[0];
  if (!error) {
    return null;
  }

  const code = error.extensions?.code;
  if (code && APPROVAL_ERROR_MESSAGES_VI[code]) {
    return APPROVAL_ERROR_MESSAGES_VI[code];
  }

  return APPROVAL_ERROR_FALLBACK_MESSAGES_VI[error.message] ?? error.message;
};

const extractRawGraphQlMessage = (errors?: GraphQlError[]): string | null => errors?.[0]?.message ?? null;

@Injectable({
  providedIn: 'root',
})
export class ApprovalsApiService {
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
      return isAuthInvalidMessage(extractRawGraphQlMessage(error.error?.errors) ?? error.message);
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

  getApprovalQueue(
    status: ApprovalStatusFilter = 'ALL',
    search: string | null = null,
    page = 1,
    pageSize = 20,
  ): Observable<ApprovalQueuePageResponse> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<ApprovalQueueQueryResponse>>(this.endpoint, {
          query: APPROVAL_QUEUE_QUERY,
          variables: {
            status,
            search,
            page,
            pageSize,
          },
        }),
      'ApprovalQueue query did not include approval queue data.',
      (data) => data.approvalQueue,
    );
  }

  exportApprovalQueue(
    status: ApprovalStatusFilter = 'ALL',
    search: string | null = null,
  ): Observable<ExportApprovalQueueResponse> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<ExportApprovalQueueQueryResponse>>(this.endpoint, {
          query: EXPORT_APPROVAL_QUEUE_QUERY,
          variables: {
            status,
            search,
          },
        }),
      'ExportApprovalQueue query did not include export queue data.',
      (data) => data.exportApprovalQueue,
    );
  }

  getApprovalDetail(documentId: string): Observable<ApprovalDetailResponse | null> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<ApprovalDetailQueryResponse>>(this.endpoint, {
          query: APPROVAL_DETAIL_QUERY,
          variables: {
            documentId,
          },
        }),
      'ApprovalDetail query did not include approval detail.',
      (data) => data.approvalDetail,
    );
  }

  approveReviewedDocument(
    documentId: string,
    comment?: string | null,
  ): Observable<ReviewedApprovalActionResponse> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<ApproveReviewedDocumentMutationResponse>>(this.endpoint, {
          query: APPROVE_REVIEWED_DOCUMENT_MUTATION,
          variables: {
            input: {
              documentId,
              comment: comment ?? null,
            },
          },
        }),
      'ApproveReviewedDocument response did not include approval action data.',
      (data) => data.approveReviewedDocument,
    );
  }

  rejectReviewedDocument(
    documentId: string,
    reason: string,
    comment?: string | null,
  ): Observable<ReviewedApprovalActionResponse> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<RejectReviewedDocumentMutationResponse>>(this.endpoint, {
          query: REJECT_REVIEWED_DOCUMENT_MUTATION,
          variables: {
            input: {
              documentId,
              reason,
              comment: comment ?? null,
            },
          },
        }),
      'RejectReviewedDocument response did not include approval action data.',
      (data) => data.rejectReviewedDocument,
    );
  }
}
