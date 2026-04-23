import { inject, Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { catchError, map, Observable, throwError } from 'rxjs';
import {
  CREATE_MANUAL_DOCUMENT_DRAFT_MUTATION,
  DELETE_DOCUMENT_DRAFT_MUTATION,
  MY_DOCUMENT_DRAFT_QUERY,
  MY_DOCUMENT_DRAFTS_QUERY,
  MY_SUBMITTED_DOCUMENTS_QUERY,
  SUBMIT_REVIEWED_DOCUMENT_MUTATION,
  UPLOAD_DOCUMENT_FOR_REVIEW_MUTATION,
} from './documents.graphql';
import {
  CreateManualDocumentDraftInput,
  DeleteDocumentDraftInput,
  DocumentDraftDetail,
  DocumentDraftSummary,
  PaginatedDocuments,
  SubmitReviewedDocumentInput,
  SubmitReviewedDocumentPayload,
  SubmittedDocumentSummary,
  UploadDocumentForReviewInput,
} from './documents.models';

interface GraphQlError {
  message?: string;
}

interface QueryResultWithErrors<TData> {
  data?: TData;
  errors?: readonly GraphQlError[];
  error?: {
    message?: string;
    errors?: readonly GraphQlError[];
  };
}

interface MyDocumentDraftsQueryResponse {
  myDocumentDrafts: PaginatedDocuments<DocumentDraftSummary> | null;
}

interface MyDocumentDraftQueryResponse {
  myDocumentDraft: DocumentDraftDetail | null;
}

interface MySubmittedDocumentsQueryResponse {
  mySubmittedDocuments: PaginatedDocuments<SubmittedDocumentSummary> | null;
}

interface UploadDocumentForReviewMutationResponse {
  uploadDocumentForReview: DocumentDraftDetail | null;
}

interface CreateManualDocumentDraftMutationResponse {
  createManualDocumentDraft: DocumentDraftDetail | null;
}

interface SubmitReviewedDocumentMutationResponse {
  submitReviewedDocument: SubmitReviewedDocumentPayload | null;
}

interface DeleteDocumentDraftMutationResponse {
  deleteDocumentDraft: boolean | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const isDocumentLineItem = (value: unknown): value is DocumentDraftDetail['lineItems'][number] => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value['itemName']) &&
    isNumber(value['quantity']) &&
    isNumber(value['unitPrice']) &&
    isNumber(value['total'])
  );
};

const isDocumentDraftSummary = (value: unknown): value is DocumentDraftSummary => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value['documentId']) &&
    isString(value['originalFileName']) &&
    isString(value['vendorName']) &&
    isString(value['reference']) &&
    isNumber(value['totalAmount']) &&
    isString(value['confidenceLabel']) &&
    isString(value['ownerEmail']) &&
    isString(value['uploadedAt'])
  );
};

const isSubmittedDocumentSummary = (value: unknown): value is SubmittedDocumentSummary => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value['documentId']) &&
    isString(value['originalFileName']) &&
    isString(value['vendorName']) &&
    isString(value['reference']) &&
    isNumber(value['totalAmount']) &&
    isString(value['status']) &&
    isString(value['submittedByEmail']) &&
    isString(value['submittedAt']) &&
    isString(value['lastUpdatedAt']) &&
    (value['rejectionReason'] === null || isString(value['rejectionReason']))
  );
};

const isDocumentDraftDetail = (value: unknown): value is DocumentDraftDetail => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value['documentId']) &&
    isString(value['originalFileName']) &&
    isString(value['contentType']) &&
    isString(value['vendorName']) &&
    isString(value['reference']) &&
    isString(value['documentDate']) &&
    isString(value['dueDate']) &&
    isString(value['category']) &&
    (value['vendorTaxId'] === null || isString(value['vendorTaxId'])) &&
    isNumber(value['subtotal']) &&
    isNumber(value['vat']) &&
    isNumber(value['totalAmount']) &&
    isString(value['source']) &&
    isString(value['reviewedByStaff']) &&
    isString(value['confidenceLabel']) &&
    isBoolean(value['hasImage']) &&
    Array.isArray(value['lineItems']) &&
    value['lineItems'].every((lineItem) => isDocumentLineItem(lineItem))
  );
};

const isSubmitReviewedDocumentPayload = (value: unknown): value is SubmitReviewedDocumentPayload => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value['documentId']) &&
    isString(value['status']) &&
    isString(value['submittedAt']) &&
    isString(value['vendorName']) &&
    isString(value['reference']) &&
    isNumber(value['totalAmount']) &&
    isString(value['dueDate']) &&
    isString(value['reviewedByStaff'])
  );
};

const isPaginatedDocuments = <TItem>(
  value: unknown,
  itemGuard: (item: unknown) => item is TItem,
): value is PaginatedDocuments<TItem> => {
  if (!isRecord(value) || !Array.isArray(value['items'])) {
    return false;
  }

  return (
    value['items'].every((item) => itemGuard(item)) &&
    isNumber(value['totalCount']) &&
    isNumber(value['skip']) &&
    isNumber(value['take'])
  );
};

@Injectable({
  providedIn: 'root',
})
export class DocumentsApiService {
  private readonly apollo = inject(Apollo);

  getDrafts(skip: number, take: number): Observable<PaginatedDocuments<DocumentDraftSummary>> {
    return this.apollo
      .query<MyDocumentDraftsQueryResponse, { skip: number; take: number }>({
        query: MY_DOCUMENT_DRAFTS_QUERY,
        variables: { skip, take },
        fetchPolicy: 'no-cache',
      })
      .pipe(
        map((response) => {
          const drafts = this.extractData(
            response,
            'MyDocumentDrafts query did not include data.',
          ).myDocumentDrafts;

          if (!isPaginatedDocuments(drafts, isDocumentDraftSummary)) {
            throw new Error('MyDocumentDrafts query returned an invalid drafts payload.');
          }

          return drafts;
        }),
        catchError((error: unknown) => this.handleError(error)),
      );
  }

  getDraft(documentId: string): Observable<DocumentDraftDetail> {
    return this.apollo
      .query<MyDocumentDraftQueryResponse, { documentId: string }>({
        query: MY_DOCUMENT_DRAFT_QUERY,
        variables: { documentId },
        fetchPolicy: 'no-cache',
      })
      .pipe(
        map((response) => {
          const draft = this.extractData(
            response,
            'MyDocumentDraft query did not include data.',
          ).myDocumentDraft;

          if (!isDocumentDraftDetail(draft)) {
            throw new Error('MyDocumentDraft query returned an invalid draft payload.');
          }

          return draft;
        }),
        catchError((error: unknown) => this.handleError(error)),
      );
  }

  getSubmitted(skip: number, take: number): Observable<PaginatedDocuments<SubmittedDocumentSummary>> {
    return this.apollo
      .query<MySubmittedDocumentsQueryResponse, { skip: number; take: number }>({
        query: MY_SUBMITTED_DOCUMENTS_QUERY,
        variables: { skip, take },
        fetchPolicy: 'no-cache',
      })
      .pipe(
        map((response) => {
          const submitted = this.extractData(
            response,
            'MySubmittedDocuments query did not include data.',
          ).mySubmittedDocuments;

          if (!isPaginatedDocuments(submitted, isSubmittedDocumentSummary)) {
            throw new Error('MySubmittedDocuments query returned an invalid submitted payload.');
          }

          return submitted;
        }),
        catchError((error: unknown) => this.handleError(error)),
      );
  }

  uploadForReview(input: UploadDocumentForReviewInput): Observable<DocumentDraftDetail> {
    return this.apollo
      .mutate<UploadDocumentForReviewMutationResponse, { input: UploadDocumentForReviewInput }>({
        mutation: UPLOAD_DOCUMENT_FOR_REVIEW_MUTATION,
        variables: { input },
        fetchPolicy: 'no-cache',
      })
      .pipe(
        map((response) => {
          const draft = this.extractData(
            response,
            'UploadDocumentForReview mutation did not include data.',
          ).uploadDocumentForReview;

          if (!isDocumentDraftDetail(draft)) {
            throw new Error('UploadDocumentForReview mutation returned an invalid draft payload.');
          }

          return draft;
        }),
        catchError((error: unknown) => this.handleError(error)),
      );
  }

  createManualDraft(input: CreateManualDocumentDraftInput): Observable<DocumentDraftDetail> {
    return this.apollo
      .mutate<CreateManualDocumentDraftMutationResponse, { input: CreateManualDocumentDraftInput }>({
        mutation: CREATE_MANUAL_DOCUMENT_DRAFT_MUTATION,
        variables: { input },
        fetchPolicy: 'no-cache',
      })
      .pipe(
        map((response) => {
          const draft = this.extractData(
            response,
            'CreateManualDocumentDraft mutation did not include data.',
          ).createManualDocumentDraft;

          if (!isDocumentDraftDetail(draft)) {
            throw new Error('CreateManualDocumentDraft mutation returned an invalid draft payload.');
          }

          return draft;
        }),
        catchError((error: unknown) => this.handleError(error)),
      );
  }

  submitReviewedDocument(
    input: SubmitReviewedDocumentInput,
  ): Observable<SubmitReviewedDocumentPayload> {
    return this.apollo
      .mutate<SubmitReviewedDocumentMutationResponse, { input: SubmitReviewedDocumentInput }>({
        mutation: SUBMIT_REVIEWED_DOCUMENT_MUTATION,
        variables: { input },
        fetchPolicy: 'no-cache',
      })
      .pipe(
        map((response) => {
          const submitted = this.extractData(
            response,
            'SubmitReviewedDocument mutation did not include data.',
          ).submitReviewedDocument;

          if (!isSubmitReviewedDocumentPayload(submitted)) {
            throw new Error(
              'SubmitReviewedDocument mutation returned an invalid reviewed payload.',
            );
          }

          return submitted;
        }),
        catchError((error: unknown) => this.handleError(error)),
      );
  }

  deleteDraft(documentId: string): Observable<boolean> {
    return this.apollo
      .mutate<DeleteDocumentDraftMutationResponse, { input: DeleteDocumentDraftInput }>({
        mutation: DELETE_DOCUMENT_DRAFT_MUTATION,
        variables: { input: { documentId } },
        fetchPolicy: 'no-cache',
      })
      .pipe(
        map((response) => {
          const deleted = this.extractData(
            response,
            'DeleteDocumentDraft mutation did not include data.',
          ).deleteDocumentDraft;

          if (!isBoolean(deleted)) {
            throw new Error('DeleteDocumentDraft mutation did not include a boolean result.');
          }

          return deleted;
        }),
        catchError((error: unknown) => this.handleError(error)),
      );
  }

  private extractData<TData>(
    response: QueryResultWithErrors<TData>,
    missingMessage: string,
  ): TData {
    const graphQlMessage =
      response.errors?.[0]?.message ??
      response.error?.errors?.[0]?.message ??
      response.error?.message;

    if (graphQlMessage) {
      throw new Error(graphQlMessage);
    }

    if (!response.data) {
      throw new Error(missingMessage);
    }

    return response.data;
  }
  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'object' && error !== null) {
      const candidate = error as {
        message?: string;
        errors?: readonly GraphQlError[];
      };

      return new Error(
        candidate.errors?.[0]?.message ?? candidate.message ?? 'Unable to complete the request.',
      );
    }

    return new Error('Unable to complete the request.');
  }

  private handleError(error: unknown): Observable<never> {
    return throwError(() => this.normalizeError(error));
  }
}
