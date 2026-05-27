import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, defer, map, Observable, switchMap, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { isAuthInvalidMessage } from '../../../core/auth/auth-error.utils';
import { API_BASE_URL } from '../../../core/config/api-base-url.token';

interface GraphQlError {
  message: string;
}

interface GraphQlResponse<TData> {
  data?: TData;
  errors?: GraphQlError[];
}

export interface PaymentQueueItemResponse {
  paymentId: string | null;
  documentId: string;
  reference: string;
  documentFileName: string;
  employeeName: string;
  employeeMembershipId: string;
  employeeCode: string | null;
  merchantName: string | null;
  department: string;
  amount: number;
  currencyCode: string;
  amountInBaseCurrency: number;
  expenseDate: string;
  submittedAt: string;
  queueStatus: 'ReadyToPay' | 'Scheduled' | 'Paid' | 'Failed';
  paymentMethod: string | null;
  recordedAt: string | null;
  confirmedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
}

export interface PaymentDetailResponse {
  paymentId: string | null;
  documentId: string;
  reference: string;
  settlementRef: string | null;
  approvalRecordId: string | null;
  employeeName: string;
  employeeMembershipId: string;
  employeeCode: string | null;
  merchantName: string | null;
  department: string;
  costCenter: string | null;
  amount: number;
  currencyCode: string;
  amountInBaseCurrency: number;
  expenseDate: string;
  paymentMethod: string | null;
  queueStatus: string;
  documentFileName: string;
  documentDownloadUrl: string | null;
  documentViewUrl: string | null;
  auditTrail: PaymentAuditTrailItemResponse[];
  methodSource: string | null;
  methodEditable: boolean;
}

export interface PaymentAuditTrailItemResponse {
  type: string;
  title: string;
  actor: string;
  timestamp: string;
  note: string | null;
}

export interface RecordPaymentInput {
  documentId: string;
  paymentMethod: string;
  notes?: string;
}

export type RejectType =
  | 'INSUFFICIENT_DOCUMENTATION'
  | 'DUPLICATE_CLAIM'
  | 'POLICY_VIOLATION'
  | 'INVALID_AMOUNT'
  | 'NOT_REIMBURSABLE'
  | 'OTHER';

interface PaymentQueueQueryResponse {
  paymentQueue: PaymentQueueItemResponse[];
}

interface PaymentDetailQueryResponse {
  paymentDetail: PaymentDetailResponse | null;
}

const PAYMENT_QUEUE_QUERY = `
  query PaymentQueue($status: String, $search: String) {
    paymentQueue(status: $status, search: $search) {
      paymentId
      documentId
      reference
      documentFileName
      employeeName
      employeeMembershipId
      employeeCode
      merchantName
      department
      amount
      currencyCode
      amountInBaseCurrency
      expenseDate
      submittedAt
      queueStatus
      paymentMethod
      recordedAt
      confirmedAt
      rejectionReason
      notes
    }
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null => errors?.[0]?.message ?? null;

@Injectable({
  providedIn: 'root',
})
export class PaymentsApiService {
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

  getPaymentQueue(
    status: 'ReadyToPay' | 'Scheduled' | 'Paid' | 'Failed' | 'ALL' = 'ALL',
    search: string | null = null,
  ): Observable<PaymentQueueItemResponse[]> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<PaymentQueueQueryResponse>>(this.endpoint, {
          query: PAYMENT_QUEUE_QUERY,
          variables: {
            status,
            search,
          },
        }),
      'PaymentQueue query did not include settlement queue data.',
      (data) => data.paymentQueue,
    );
  }

  private readonly PAYMENT_DETAIL_QUERY = `
    query PaymentDetail($paymentId: UUID, $documentId: UUID) {
      paymentDetail(paymentId: $paymentId, documentId: $documentId) {
        paymentId
        documentId
        reference
        settlementRef
        approvalRecordId
        employeeName
        employeeMembershipId
        employeeCode
        merchantName
        department
        costCenter
        amount
        currencyCode
        amountInBaseCurrency
        expenseDate
        paymentMethod
        queueStatus
        documentFileName
        documentDownloadUrl
        documentViewUrl
        auditTrail {
          type
          title
          actor
          timestamp
          note
        }
        methodSource
        methodEditable
      }
    }
  `;

  private readonly RECORD_PAYMENT_MUTATION = `
    mutation RecordPayment($input: RecordPaymentInput!) {
      recordPayment(input: $input) {
        id
        documentId
        amount
        currencyCode
        amountInBaseCurrency
        paymentMethod
        status
        recordedAt
        recordedByMembershipId
        notes
      }
    }
  `;

  private readonly CONFIRM_PAYMENT_MUTATION = `
    mutation ConfirmPayment($paymentId: UUID!, $executionReference: String) {
      confirmPayment(paymentId: $paymentId, executionReference: $executionReference) {
        id
        documentId
        amount
        currencyCode
        amountInBaseCurrency
        paymentMethod
        status
        recordedAt
        recordedByMembershipId
        notes
      }
    }
  `;

  private readonly REJECT_PAYMENT_MUTATION = `
    mutation RejectPayment($paymentId: UUID!, $type: RejectType!, $reason: String) {
      rejectPayment(paymentId: $paymentId, type: $type, reason: $reason) {
        id
        documentId
        amount
        currencyCode
        amountInBaseCurrency
        paymentMethod
        status
        recordedAt
        recordedByMembershipId
        notes
      }
    }
  `;

  getPaymentDetail(paymentId: string | null = null, documentId: string | null = null): Observable<PaymentDetailResponse | null> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<PaymentDetailQueryResponse>>(this.endpoint, {
          query: this.PAYMENT_DETAIL_QUERY,
          variables: { paymentId, documentId },
        }),
      'PaymentDetail query did not return data.',
      (data) => data.paymentDetail,
    );
  }

  recordPayment(input: RecordPaymentInput): Observable<unknown> {
    interface RecordPaymentResponse {
      recordPayment: unknown;
    }

    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<RecordPaymentResponse>>(this.endpoint, {
          query: this.RECORD_PAYMENT_MUTATION,
          variables: { input },
        }),
      'RecordPayment mutation failed.',
      (data) => data.recordPayment,
    );
  }

  confirmPayment(paymentId: string, executionReference?: string): Observable<unknown> {
    interface ConfirmPaymentResponse {
      confirmPayment: unknown;
    }

    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<ConfirmPaymentResponse>>(this.endpoint, {
          query: this.CONFIRM_PAYMENT_MUTATION,
          variables: { paymentId, executionReference },
        }),
      'ConfirmPayment mutation failed.',
      (data) => data.confirmPayment,
    );
  }

  rejectPayment(paymentId: string, type: RejectType, reason?: string): Observable<unknown> {
    interface RejectPaymentResponse {
      rejectPayment: unknown;
    }

    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<RejectPaymentResponse>>(this.endpoint, {
          query: this.REJECT_PAYMENT_MUTATION,
          variables: { paymentId, type, reason },
        }),
      'RejectPayment mutation failed.',
      (data) => data.rejectPayment,
    );
  }
}
