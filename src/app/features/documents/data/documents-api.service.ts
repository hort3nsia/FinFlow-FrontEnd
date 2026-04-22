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

export interface OcrLineItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface DocumentReviewDraftResponse {
  documentId: string;
  originalFileName: string;
  contentType: string;
  vendorName: string;
  reference: string;
  documentDate: string;
  dueDate: string;
  category: string;
  vendorTaxId: string;
  subtotal: number;
  vat: number;
  totalAmount: number;
  source: string;
  reviewedByStaff: string;
  confidenceLabel: string;
  lineItems: OcrLineItem[];
}

export interface MyDocumentDraftResponse {
  documentId: string;
  originalFileName: string;
  vendorName: string;
  reference: string;
  totalAmount: number;
  confidenceLabel: string;
  ownerEmail: string;
  uploadedAt: string;
}

export interface MySubmittedDocumentResponse {
  documentId: string;
  originalFileName: string;
  vendorName: string;
  reference: string;
  totalAmount: number;
  status: string;
  submittedByEmail: string;
  submittedAt: string;
  lastUpdatedAt: string;
  rejectionReason: string | null;
}

export interface SubmitReviewedDocumentDraft {
  documentId: string;
  originalFileName: string;
  contentType: string;
  vendorName: string;
  reference: string;
  documentDate: string;
  dueDate: string;
  category: string;
  vendorTaxId: string;
  subtotal: number;
  vat: number;
  totalAmount: number;
  source: string;
  confidenceLabel: string;
  lineItems: OcrLineItem[];
}

export interface SubmittedReviewedDocumentResponse {
  documentId: string;
  status: string;
  submittedAt: string;
  vendorName: string;
  reference: string;
  totalAmount: number;
  dueDate: string;
  reviewedByStaff: string;
}

interface UploadDocumentForReviewMutationResponse {
  uploadDocumentForReview: DocumentReviewDraftResponse;
}

interface MyDocumentDraftsQueryResponse {
  myDocumentDrafts: MyDocumentDraftResponse[];
}

interface MyDocumentDraftQueryResponse {
  myDocumentDraft: DocumentReviewDraftResponse;
}

interface MySubmittedDocumentsQueryResponse {
  mySubmittedDocuments: MySubmittedDocumentResponse[];
}

interface SubmitReviewedDocumentMutationResponse {
  submitReviewedDocument: SubmittedReviewedDocumentResponse;
}

const UPLOAD_DOCUMENT_FOR_REVIEW_MUTATION = `
  mutation UploadDocumentForReview($input: UploadDocumentForReviewInput!) {
    uploadDocumentForReview(input: $input) {
      documentId
      originalFileName
      contentType
      vendorName
      reference
      documentDate
      dueDate
      category
      vendorTaxId
      subtotal
      vat
      totalAmount
      source
      reviewedByStaff
      confidenceLabel
      lineItems {
        itemName
        quantity
        unitPrice
        total
      }
    }
  }
`;

const MY_DOCUMENT_DRAFTS_QUERY = `
  query MyDocumentDrafts {
    myDocumentDrafts {
      documentId
      originalFileName
      vendorName
      reference
      totalAmount
      confidenceLabel
      ownerEmail
      uploadedAt
    }
  }
`;

const MY_DOCUMENT_DRAFT_QUERY = `
  query MyDocumentDraft($documentId: UUID!) {
    myDocumentDraft(documentId: $documentId) {
      documentId
      originalFileName
      contentType
      vendorName
      reference
      documentDate
      dueDate
      category
      vendorTaxId
      subtotal
      vat
      totalAmount
      source
      reviewedByStaff
      confidenceLabel
      lineItems {
        itemName
        quantity
        unitPrice
        total
      }
    }
  }
`;

const MY_SUBMITTED_DOCUMENTS_QUERY = `
  query MySubmittedDocuments {
    mySubmittedDocuments {
      documentId
      originalFileName
      vendorName
      reference
      totalAmount
      status
      submittedByEmail
      submittedAt
      lastUpdatedAt
      rejectionReason
    }
  }
`;

const SUBMIT_REVIEWED_DOCUMENT_MUTATION = `
  mutation SubmitReviewedDocument($input: SubmitReviewedDocumentInput!) {
    submitReviewedDocument(input: $input) {
      documentId
      status
      submittedAt
      vendorName
      reference
      totalAmount
      dueDate
      reviewedByStaff
    }
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null => errors?.[0]?.message ?? null;

@Injectable({
  providedIn: 'root',
})
export class DocumentsApiService {
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

  uploadDocumentForReview(
    fileName: string,
    contentType: string,
    base64Content: string,
  ): Observable<DocumentReviewDraftResponse> {
    return this.http
      .post<GraphQlResponse<UploadDocumentForReviewMutationResponse>>(this.endpoint, {
        query: UPLOAD_DOCUMENT_FOR_REVIEW_MUTATION,
        variables: {
          input: {
            fileName,
            contentType,
            base64Content,
          },
        },
      })
      .pipe(
        map((response) => {
          const draft = this.extractData(
            response,
            'UploadDocumentForReview response did not include draft data.',
          ).uploadDocumentForReview;

          if (!draft) {
            throw new Error('UploadDocumentForReview response did not include draft data.');
          }

          return draft;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getMyDocumentDrafts(): Observable<MyDocumentDraftResponse[]> {
    return this.http
      .post<GraphQlResponse<MyDocumentDraftsQueryResponse>>(this.endpoint, {
        query: MY_DOCUMENT_DRAFTS_QUERY,
      })
      .pipe(
        map((response) => this.extractData(response, 'MyDocumentDrafts response did not include draft data.').myDocumentDrafts),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getMyDocumentDraft(documentId: string): Observable<DocumentReviewDraftResponse> {
    return this.http
      .post<GraphQlResponse<MyDocumentDraftQueryResponse>>(this.endpoint, {
        query: MY_DOCUMENT_DRAFT_QUERY,
        variables: {
          documentId,
        },
      })
      .pipe(
        map((response) => {
          const draft = this.extractData(
            response,
            'MyDocumentDraft response did not include draft data.',
          ).myDocumentDraft;

          if (!draft) {
            throw new Error('MyDocumentDraft response did not include draft data.');
          }

          return draft;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getMySubmittedDocuments(): Observable<MySubmittedDocumentResponse[]> {
    return this.http
      .post<GraphQlResponse<MySubmittedDocumentsQueryResponse>>(this.endpoint, {
        query: MY_SUBMITTED_DOCUMENTS_QUERY,
      })
      .pipe(
        map((response) =>
          this.extractData(
            response,
            'MySubmittedDocuments response did not include submission history.',
          ).mySubmittedDocuments,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  submitReviewedDocument(
    draft: SubmitReviewedDocumentDraft,
  ): Observable<SubmittedReviewedDocumentResponse> {
    return this.http
      .post<GraphQlResponse<SubmitReviewedDocumentMutationResponse>>(this.endpoint, {
        query: SUBMIT_REVIEWED_DOCUMENT_MUTATION,
        variables: {
          input: draft,
        },
      })
      .pipe(
        map((response) => {
          const submitted = this.extractData(
            response,
            'SubmitReviewedDocument response did not include submission data.',
          ).submitReviewedDocument;

          if (!submitted) {
            throw new Error('SubmitReviewedDocument response did not include submission data.');
          }

          return submitted;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }
}
